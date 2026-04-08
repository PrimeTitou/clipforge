from app.core.celery_app import celery_app


def _scrape_channel(handle: str) -> dict:
    """Scrape les métadonnées d'une chaîne YouTube via yt-dlp."""
    import yt_dlp
    url = f"https://www.youtube.com/@{handle}/videos"
    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "playlistend": 50,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    videos = []
    for entry in (info.get("entries") or []):
        videos.append({
            "title": entry.get("title", ""),
            "view_count": entry.get("view_count") or 0,
            "duration": entry.get("duration") or 0,
            "url": entry.get("url", ""),
        })

    channel_info = {
        "name": info.get("uploader") or info.get("channel") or handle,
        "subscriber_count": info.get("channel_follower_count"),
        "video_count": len(videos),
        "avatar_url": None,
        "videos": videos,
    }

    thumbnails = info.get("thumbnails") or []
    if thumbnails:
        channel_info["avatar_url"] = thumbnails[-1].get("url")

    return channel_info


def _extract_style_profile(videos: list[dict]) -> dict:
    """Analyse les vidéos pour extraire un profil de style."""
    if not videos:
        return {"top_formats": [], "avg_title_length": 0, "video_count": 0, "top_videos": []}

    titles = [v["title"] for v in videos]
    avg_length = sum(len(t) for t in titles) / len(titles)

    sorted_by_views = sorted(videos, key=lambda x: x.get("view_count", 0), reverse=True)
    top_videos = sorted_by_views[:5]

    top_words: dict[str, int] = {}
    for v in top_videos:
        for word in v["title"].lower().split():
            if len(word) > 3:
                top_words[word] = top_words.get(word, 0) + 1
    top_formats = [w for w, c in sorted(top_words.items(), key=lambda x: x[1], reverse=True)][:10]

    return {
        "avg_title_length": round(avg_length, 1),
        "video_count": len(videos),
        "top_formats": top_formats,
        "top_videos": top_videos,
    }


@celery_app.task(name="workers.analyze_channel")
def analyze_channel_task(handle: str):
    from app.core.database import SessionLocal
    from app.models.db import Channel
    from datetime import datetime

    try:
        channel_data = _scrape_channel(handle)
        style_profile = _extract_style_profile(channel_data["videos"])

        db = SessionLocal()
        try:
            channel = db.query(Channel).filter(Channel.handle == handle).first()
            if not channel:
                channel = Channel(handle=handle)
                db.add(channel)
            channel.name = channel_data["name"]
            channel.avatar_url = channel_data["avatar_url"]
            channel.subscriber_count = channel_data["subscriber_count"]
            channel.video_count = channel_data["video_count"]
            channel.style_profile = style_profile
            channel.scraped_at = datetime.utcnow()
            db.commit()
        finally:
            db.close()

        return {"handle": handle, "style_profile": style_profile}

    except Exception as e:
        raise
