import os
import json
import subprocess
from app.core.celery_app import celery_app
from app.workers.downloader import _update_job

CHUNK_DURATION = 600  # 10 minutes en secondes


def _split_audio(video_path: str, output_dir: str) -> list[str]:
    """Découpe la vidéo en chunks audio .mp3 de 10 minutes via ffmpeg."""
    os.makedirs(output_dir, exist_ok=True)
    cmd = [
        "ffmpeg", "-i", video_path,
        "-f", "segment",
        "-segment_time", str(CHUNK_DURATION),
        "-vn", "-acodec", "libmp3lame", "-q:a", "4",
        os.path.join(output_dir, "chunk_%03d.mp3"),
        "-y", "-loglevel", "error"
    ]
    subprocess.run(cmd, check=True)
    chunks = sorted([
        os.path.join(output_dir, f)
        for f in os.listdir(output_dir)
        if f.startswith("chunk_") and f.endswith(".mp3")
    ])
    return chunks


@celery_app.task(name="workers.transcribe")
def transcribe_task(job_id: str, video_path: str):
    from app.core.config import settings
    from app.workers.video_analyzer import analyze_video_task
    from groq import Groq

    _update_job(job_id, step_current=2, progress=20.0)

    try:
        client = Groq(api_key=settings.groq_api_key)
        chunks_dir = os.path.join(settings.storage_path, f"{job_id}_chunks")
        chunks = _split_audio(video_path, chunks_dir)

        full_transcript = []
        time_offset = 0.0

        for i, chunk_path in enumerate(chunks):
            with open(chunk_path, "rb") as f:
                result = client.audio.transcriptions.create(
                    model="whisper-large-v3",
                    file=f,
                    response_format="verbose_json",
                    timestamp_granularities=["word"],
                )
            for seg in (result.segments or []):
                full_transcript.append({
                    "start": seg.start + time_offset,
                    "end": seg.end + time_offset,
                    "text": seg.text,
                })
            time_offset += CHUNK_DURATION
            progress = 20.0 + (i + 1) / len(chunks) * 15.0
            _update_job(job_id, progress=progress)

        transcript_path = os.path.join(settings.storage_path, f"{job_id}_transcript.json")
        with open(transcript_path, "w") as f:
            json.dump(full_transcript, f)

        _update_job(job_id, step_current=2, progress=35.0)
        analyze_video_task.delay(job_id, video_path, transcript_path)

    except Exception as e:
        _update_job(job_id, status="error", error_message=str(e))
        raise
