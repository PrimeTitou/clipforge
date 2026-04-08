from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    groq_api_key: str
    gemini_api_key: str
    database_url: str
    redis_url: str = "redis://localhost:6379"
    storage_path: str = "./storage"

    class Config:
        env_file = ".env"

settings = Settings()
