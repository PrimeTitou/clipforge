import json
import uuid
from app.core.celery_app import celery_app
from app.workers.downloader import _update_job

SYSTEM_PROMPT = """Tu es un expert en création de contenu YouTube pour streamers gaming.
Tu dois créer des scripts YouTube percutants basés sur les meilleurs moments d'un live.
Le script doit coller exactement au style de la chaîne du streamer analysée.
Réponds UNIQUEMENT avec du JSON valide, aucun texte avant ou après."""


def _build_prompt(clips: list[dict], style_profile: dict) -> str:
    top_clips_desc = "\n".join([
        f"- [{c['clip_type'].upper()}] {c['start_ts']:.0f}s-{c['end_ts']:.0f}s (score {c['score'] * 100:.0f}%): {(c.get('transcript_excerpt') or '')[:100]}"
        for c in clips[:8]
    ])
    style_desc = (
        f"Formats récurrents: {', '.join(style_profile.get('top_formats', [])[:5])}\n"
        f"Longueur titre moyenne: {style_profile.get('avg_title_length', 50)} caractères\n"
        f"Top vidéos: {', '.join(v['title'] for v in style_profile.get('top_videos', [])[:3])}"
    )
    return f"""Voici les meilleurs clips détectés dans le live:
{top_clips_desc}

Style de la chaîne:
{style_desc}

Génère 2 scripts YouTube différents au format JSON:
{{
  "scripts": [
    {{
      "title": "Titre accrocheur dans le style de la chaîne (max 70 chars)",
      "hook": "Les 2-3 premières phrases du script pour accrocher (max 150 chars)",
      "body": "Script complet avec transitions entre les clips (400-600 mots)",
      "description": "Description YouTube optimisée SEO (150-200 chars)",
      "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
    }}
  ]
}}"""


@celery_app.task(name="workers.write_scripts")
def write_scripts_task(job_id: str, transcript_path: str, channel_result: dict = None):
    from app.core.config import settings
    from app.core.database import SessionLocal
    from app.models.db import Clip, Script, Channel, Job
    from groq import Groq

    _update_job(job_id, step_current=6, progress=80.0)

    try:
        db = SessionLocal()
        try:
            clips = db.query(Clip).filter(Clip.job_id == job_id).order_by(Clip.score.desc()).limit(8).all()
            clips_data = [
                {
                    "start_ts": c.start_ts,
                    "end_ts": c.end_ts,
                    "score": c.score,
                    "clip_type": c.clip_type,
                    "transcript_excerpt": c.transcript_excerpt,
                }
                for c in clips
            ]
            job = db.query(Job).filter(Job.id == job_id).first()
            channel_handle = job.channel_handle if job else None

            style_profile = {}
            if channel_handle:
                channel = db.query(Channel).filter(Channel.handle == channel_handle).first()
                if channel and channel.style_profile:
                    style_profile = channel.style_profile
        finally:
            db.close()

        client = Groq(api_key=settings.groq_api_key)
        prompt = _build_prompt(clips_data, style_profile)

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)
        scripts_data = result.get("scripts", [])

        db = SessionLocal()
        try:
            for s in scripts_data:
                script = Script(
                    id=str(uuid.uuid4()),
                    job_id=job_id,
                    title=s.get("title", ""),
                    hook=s.get("hook", ""),
                    body=s.get("body", ""),
                    description=s.get("description", ""),
                    tags=s.get("tags", []),
                )
                db.add(script)
            db.commit()
        finally:
            db.close()

        _update_job(job_id, status="done", step_current=6, progress=100.0)

    except Exception as e:
        _update_job(job_id, status="error", error_message=str(e))
        raise
