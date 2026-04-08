from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "clipforge",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.downloader",
        "app.workers.transcriber",
        "app.workers.video_analyzer",
        "app.workers.clip_detector",
        "app.workers.yt_analyzer",
        "app.workers.script_writer",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
)
