from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.db import Channel

router = APIRouter()

class ChannelAnalyzeRequest(BaseModel):
    handle: str

@router.post("/channel/analyze")
def analyze_channel(req: ChannelAnalyzeRequest, db: Session = Depends(get_db)):
    handle = req.handle.strip().lstrip("@").split("/")[-1].replace("@", "")
    from app.workers.yt_analyzer import analyze_channel_task
    task = analyze_channel_task.delay(handle)
    return {"task_id": task.id, "handle": handle, "status": "queued"}

@router.get("/channel/{handle}")
def get_channel(handle: str, db: Session = Depends(get_db)):
    channel = db.query(Channel).filter(Channel.handle == handle).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found or not yet analyzed")
    return {
        "handle": channel.handle,
        "name": channel.name,
        "avatar_url": channel.avatar_url,
        "subscriber_count": channel.subscriber_count,
        "video_count": channel.video_count,
        "style_profile": channel.style_profile,
        "scraped_at": channel.scraped_at,
    }
