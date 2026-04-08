from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Mock settings before importing app
import os
os.environ["GROQ_API_KEY"] = "test"
os.environ["GEMINI_API_KEY"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379"
os.environ["STORAGE_PATH"] = "./test_storage"

from app.main import app

client = TestClient(app)

def test_get_job_not_found():
    response = client.get("/api/jobs/nonexistent-id")
    assert response.status_code == 404

def test_get_channel_not_found():
    response = client.get("/api/channel/nonexistent-channel")
    assert response.status_code == 404

def test_submit_vod_url():
    with patch("app.workers.downloader.download_task") as mock_task:
        mock_task.delay = MagicMock()
        response = client.post("/api/jobs/vod", json={"url": "https://twitch.tv/videos/123"})
        assert response.status_code == 200
        assert "job_id" in response.json()
