import librosa
import numpy as np


def extract_audio_energy(video_path: str, hop_seconds: int = 5) -> dict[int, float]:
    """Retourne un dict {timestamp_sec: energy_normalized} pour chaque hop."""
    y, sr = librosa.load(video_path, sr=22050, mono=True)
    hop_length = sr * hop_seconds
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    if rms.max() > 0:
        rms = rms / rms.max()
    result = {}
    for i, val in enumerate(rms):
        ts = i * hop_seconds
        result[ts] = float(val)
    return result
