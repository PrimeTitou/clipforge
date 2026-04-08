import os
from app.core.config import settings

def ensure_storage():
    os.makedirs(settings.storage_path, exist_ok=True)

def get_path(filename: str) -> str:
    ensure_storage()
    return os.path.join(settings.storage_path, filename)
