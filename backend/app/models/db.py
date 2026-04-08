import uuid
from datetime import datetime
from sqlalchemy import String, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Channel(Base):
    __tablename__ = "channels"
    handle: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    subscriber_count: Mapped[int | None] = mapped_column(nullable=True)
    video_count: Mapped[int | None] = mapped_column(nullable=True)
    style_profile: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    status: Mapped[str] = mapped_column(String, default="pending")
    step_current: Mapped[int] = mapped_column(default=0)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    vod_url: Mapped[str | None] = mapped_column(String, nullable=True)
    vod_path: Mapped[str | None] = mapped_column(String, nullable=True)
    channel_handle: Mapped[str | None] = mapped_column(String, ForeignKey("channels.handle"), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    clips: Mapped[list["Clip"]] = relationship(back_populates="job")
    scripts: Mapped[list["Script"]] = relationship(back_populates="job")

class Clip(Base):
    __tablename__ = "clips"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(String, ForeignKey("jobs.id"))
    start_ts: Mapped[float] = mapped_column(Float)
    end_ts: Mapped[float] = mapped_column(Float)
    score: Mapped[float] = mapped_column(Float)
    clip_type: Mapped[str] = mapped_column(String)
    transcript_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    job: Mapped["Job"] = relationship(back_populates="clips")

class Script(Base):
    __tablename__ = "scripts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(String, ForeignKey("jobs.id"))
    title: Mapped[str] = mapped_column(String)
    hook: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    tags: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    job: Mapped["Job"] = relationship(back_populates="scripts")
