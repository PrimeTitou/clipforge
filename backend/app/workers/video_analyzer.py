import os
import json
import base64
import cv2
from app.core.celery_app import celery_app
from app.workers.downloader import _update_job

FRAME_INTERVAL = 5   # 1 frame toutes les 5 secondes
BATCH_SIZE = 10      # frames par appel Gemini


def _extract_frames(video_path: str, interval: int) -> list[tuple[float, str]]:
    """Retourne liste de (timestamp, base64_jpg)."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % max(1, int(fps) * interval) == 0:
            ts = frame_idx / fps
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
            b64 = base64.b64encode(buf).decode("utf-8")
            frames.append((ts, b64))
        frame_idx += 1
    cap.release()
    return frames


def _analyze_batch(frames_b64: list[tuple[float, str]]) -> list[dict]:
    """Envoie un batch de frames à Gemini Vision et retourne les événements."""
    import google.generativeai as genai

    model = genai.GenerativeModel("gemini-2.0-flash")
    timestamps = [ts for ts, _ in frames_b64]

    parts = []
    for _, b64 in frames_b64:
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": b64}})

    prompt = (
        "Pour chaque image, identifie ce qui se passe dans ce stream Sea of Thieves. "
        "Réponds avec un JSON array, un objet par image dans l'ordre: "
        '[{"type": "action|combat|death|treasure|loading|afk|normal", "score": 0.0-1.0}]. '
        "action=moment intense, combat=combat en cours, death=mort du joueur, "
        "treasure=trésor trouvé, loading=écran de chargement, afk=écran vide/menu, normal=jeu normal."
    )
    parts.append(prompt)

    response = model.generate_content(parts)
    text = response.text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    events = json.loads(text)
    result = []
    for i, ev in enumerate(events[:len(timestamps)]):
        result.append({
            "ts": timestamps[i],
            "type": ev.get("type", "normal"),
            "score": float(ev.get("score", 0.3)),
        })
    return result


@celery_app.task(name="workers.analyze_video")
def analyze_video_task(job_id: str, video_path: str, transcript_path: str):
    from app.core.config import settings
    from app.workers.clip_detector import detect_clips_task
    import google.generativeai as genai

    _update_job(job_id, step_current=3, progress=38.0)

    try:
        genai.configure(api_key=settings.gemini_api_key)
        frames = _extract_frames(video_path, FRAME_INTERVAL)
        visual_events = []

        for i in range(0, len(frames), BATCH_SIZE):
            batch = frames[i:i + BATCH_SIZE]
            events = _analyze_batch(batch)
            visual_events.extend(events)
            progress = 38.0 + min((i + BATCH_SIZE) / max(len(frames), 1) * 17.0, 17.0)
            _update_job(job_id, progress=progress)

        visual_path = os.path.join(settings.storage_path, f"{job_id}_visual.json")
        with open(visual_path, "w") as f:
            json.dump(visual_events, f)

        _update_job(job_id, step_current=3, progress=55.0)
        detect_clips_task.delay(job_id, video_path, transcript_path, visual_path)

    except Exception as e:
        _update_job(job_id, status="error", error_message=str(e))
        raise
