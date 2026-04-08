from app.workers.clip_detector import _compute_scores, _merge_windows


def test_compute_scores_empty():
    result = _compute_scores([], [], {}, duration=60.0, window=30)
    assert result == []


def test_compute_scores_single_window():
    transcript = [{"start": 5.0, "end": 8.0, "text": "oh non je suis mort!"}]
    visual = [{"ts": 5.0, "type": "death", "score": 0.9}]
    audio_energy = {5: 0.8}
    result = _compute_scores(transcript, visual, audio_energy, duration=30.0, window=30)
    assert len(result) == 1
    assert result[0]["score"] > 0.5
    assert result[0]["clip_type"] == "death"


def test_merge_windows_adjacent():
    windows = [
        {"start": 0, "end": 30, "score": 0.9, "clip_type": "action"},
        {"start": 25, "end": 55, "score": 0.8, "clip_type": "action"},
    ]
    merged = _merge_windows(windows, overlap=10)
    assert len(merged) == 1
    assert merged[0]["end"] == 55
