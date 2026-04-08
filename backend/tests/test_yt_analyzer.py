from app.workers.yt_analyzer import _extract_style_profile


def test_extract_style_profile_empty():
    result = _extract_style_profile([])
    assert result["top_formats"] == []
    assert result["avg_title_length"] == 0


def test_extract_style_profile_basic():
    videos = [
        {"title": "Les PIRES moments de mon live", "view_count": 50000},
        {"title": "J'ai trouvé le trésor légendaire", "view_count": 80000},
        {"title": "Je meurs 10 fois en 5 minutes", "view_count": 30000},
    ]
    result = _extract_style_profile(videos)
    assert result["avg_title_length"] > 0
    assert result["video_count"] == 3
    assert result["top_videos"][0]["view_count"] == 80000
