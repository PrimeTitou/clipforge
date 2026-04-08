import os
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.db import Job


def _update_job(job_id: str, **kwargs):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()
    finally:
        db.close()


@celery_app.task(name="workers.download")
def download_task(job_id: str, url: str = None, file_path: str = None):
    from app.core.config import settings
    from app.workers.transcriber import transcribe_task

    _update_job(job_id, status="running", step_current=1, progress=5.0)

    try:
        if file_path and os.path.exists(file_path):
            # Fichier déjà uploadé localement
            _update_job(job_id, step_current=1, progress=16.0, vod_path=file_path)
            transcribe_task.delay(job_id, file_path)
            return

        # Download via yt-dlp
        import yt_dlp
        os.makedirs(settings.storage_path, exist_ok=True)
        out_path = os.path.join(settings.storage_path, f"{job_id}.mp4")

        ydl_opts = {
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
            "outtmpl": out_path,
            "quiet": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        _update_job(job_id, step_current=1, progress=16.0, vod_path=out_path)
        transcribe_task.delay(job_id, out_path)

    except Exception as e:
        _update_job(job_id, status="error", error_message=str(e))
        raise
