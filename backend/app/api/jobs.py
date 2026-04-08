import os, shutil, uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.config import settings
from app.models.db import Job, Clip, Script

router = APIRouter()

class VodUrlRequest(BaseModel):
    url: str
    channel_handle: Optional[str] = None

@router.post("/jobs/vod")
def submit_vod_url(req: VodUrlRequest, db: Session = Depends(get_db)):
    from app.workers.downloader import download_task
    job = Job(id=str(uuid.uuid4()), vod_url=req.url, channel_handle=req.channel_handle)
    db.add(job)
    db.commit()
    download_task.delay(job.id, url=req.url)
    return {"job_id": job.id}

@router.post("/jobs/upload")
def submit_vod_upload(
    file: UploadFile = File(...),
    channel_handle: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    job_id = str(uuid.uuid4())
    os.makedirs(settings.storage_path, exist_ok=True)
    dest = os.path.join(settings.storage_path, f"{job_id}.mp4")
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    job = Job(id=job_id, vod_path=dest, channel_handle=channel_handle)
    db.add(job)
    db.commit()
    from app.workers.downloader import download_task
    download_task.delay(job_id, file_path=dest)
    return {"job_id": job_id}

@router.get("/jobs/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id,
        "status": job.status,
        "step_current": job.step_current,
        "progress": job.progress,
        "channel_handle": job.channel_handle,
        "error_message": job.error_message,
        "created_at": job.created_at,
    }

@router.get("/jobs/{job_id}/clips")
def get_clips(job_id: str, db: Session = Depends(get_db)):
    clips = db.query(Clip).filter(Clip.job_id == job_id).order_by(Clip.score.desc()).all()
    return [{"id": c.id, "start_ts": c.start_ts, "end_ts": c.end_ts, "score": c.score, "clip_type": c.clip_type, "transcript_excerpt": c.transcript_excerpt} for c in clips]

@router.get("/jobs/{job_id}/scripts")
def get_scripts(job_id: str, db: Session = Depends(get_db)):
    scripts = db.query(Script).filter(Script.job_id == job_id).all()
    return [{"id": s.id, "title": s.title, "hook": s.hook, "body": s.body, "description": s.description, "tags": s.tags} for s in scripts]
