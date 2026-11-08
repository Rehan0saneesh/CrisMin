"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Runtime settings for the catastrophe response platform."""

    DATABASE_URL: str = "postgresql+psycopg2://crismin:crismin@localhost:5432/crismin"
    REDIS_URL: str = "redis://localhost:6379/0"
    NEMOTRON_API_KEY: str = ""
    NEMOTRON_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    PROJECT_NAME: str = "CrisMin - State Farm Catastrophe Response"
    API_V1_STR: str = "/api/v1"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
