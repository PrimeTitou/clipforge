import os
import json
from app.core.celery_app import celery_app
from app.workers.downloader import _update_job

HIGHLIGHT_KEYWORDS = [
    "oh", "non", "mort", "trésor", "légendaire", "incroyable",
    "wow", "noooon", "j'ai", "regarde", "putain", "impossible",
    "win", "kill", "boss", "attaque", "volé", "trouvé", "canon",
]
WINDOW = 30
MIN_SCORE = 0.45
TOP_N = 10


def _compute_scores(
    transcript: list[dict],
    visual: list[dict],
    audio_energy: dict[int, float],
    duration: float,
    window: int = WINDOW,
) -> list[dict]:
    if duration <= 0:
        return []

    results = []
    t = 0.0
    while t < duration:
        end = t + window

        audio_vals = [v for k, v in audio_energy.items() if t <= k < end]
        audio_score = sum(audio_vals) / len(audio_vals) if audio_vals else 0.0

        segs = [s for s in transcript if s["start"] >= t and s["start"] < end]
        text = " ".join(s["text"].lower() for s in segs)
        kw_hits = sum(1 for kw in HIGHLIGHT_KEYWORDS if kw in text)
        transcript_score = min(kw_hits / 3.0, 1.0)

        vis_segs = [v for v in visual if t <= v["ts"] < end]
        visual_score = sum(v["score"] for v in vis_segs) / len(vis_segs) if vis_segs else 0.1
        afk_count = sum(1 for v in vis_segs if v["type"] in ("afk", "loading"))
        if vis_segs and afk_count > len(vis_segs) * 0.5:
            visual_score = 0.0

        type_counts: dict[str, int] = {}
        for v in vis_segs:
            type_counts[v["type"]] = type_counts.get(v["type"], 0) + 1
        dominant_type = max(type_counts, key=type_counts.get) if type_counts else "normal"

        composite = audio_score * 0.3 + transcript_score * 0.4 + visual_score * 0.3

        if composite >= MIN_SCORE:
            results.append({
                "start": t,
                "end": end,
                "score": round(composite, 3),
                "clip_type": dominant_type,
                "transcript_excerpt": text[:200],
            })
        t += window / 2

    return sorted(results, key=lambda x: x["score"], reverse=True)


def _merge_windows(windows: list[dict], overlap: int = 10) -> list[dict]:
    if not windows:
        return []
    merged = [windows[0].copy()]
    for w in windows[1:]:
        last = merged[-1]
        if w["start"] <= last["end"] - overlap:
            last["end"] = max(last["end"], w["end"])
            last["score"] = max(last["score"], w["score"])
        else:
            merged.append(w.copy())
    return merged


@celery_app.task(name="workers.detect_clips")
def detect_clips_task(job_id: str, video_path: str, transcript_path: str, visual_path: str):
    from app.core.config import settings
    from app.core.database import SessionLocal
    from app.models.db import Clip, Job
    from app.services.audio import extract_audio_energy
    import cv2

    _update_job(job_id, step_current=4, progress=58.0)

    try:
        with open(transcript_path) as f:
            transcript = json.load(f)
        with open(visual_path) as f:
            visual = json.load(f)

        audio_energy = extract_audio_energy(video_path)

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        duration = frame_count / fps if fps > 0 else 0
        cap.release()

        windows = _compute_scores(transcript, visual, audio_energy, duration)
        merged = _merge_windows(windows[:TOP_N * 2])[:TOP_N]

        db = SessionLocal()
        try:
            for w in merged:
                clip = Clip(
                    job_id=job_id,
                    start_ts=w["start"],
                    end_ts=w["end"],
                    score=w["score"],
                    clip_type=w["clip_type"],
                    transcript_excerpt=w["transcript_excerpt"],
                )
                db.add(clip)
            db.commit()
        finally:
            db.close()

        _update_job(job_id, step_current=4, progress=70.0)

        db2 = SessionLocal()
        try:
            job = db2.query(Job).filter(Job.id == job_id).first()
            channel_handle = job.channel_handle if job else None
        finally:
            db2.close()

        from app.workers.script_writer import write_scripts_task
        from app.workers.yt_analyzer import analyze_channel_task

        if channel_handle:
            analyze_channel_task.apply_async(
                args=[channel_handle],
                link=write_scripts_task.signature(args=[job_id, transcript_path])
            )
        else:
            write_scripts_task.delay(job_id, transcript_path)

    except Exception as e:
        _update_job(job_id, status="error", error_message=str(e))
        raise
