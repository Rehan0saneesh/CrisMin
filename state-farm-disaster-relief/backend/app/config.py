"""Application configuration loaded from environment variables."""

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

# Look for .env in backend/ first, then the project root. Paths are absolute
# so settings load the same whether uvicorn starts in backend/ or elsewhere.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILES = tuple(str(p) for p in (_BACKEND_DIR.parent / ".env", _BACKEND_DIR / ".env") if p.exists())


class Settings(BaseSettings):
    """Runtime settings for the catastrophe response platform."""

    model_config = SettingsConfigDict(env_file=_ENV_FILES or None, env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg2://crismin:crismin@localhost:5432/crismin"
    REDIS_URL: str = "redis://localhost:6379/0"
    PROJECT_NAME: str = "CrisMin - State Farm Catastrophe Response"
    API_V1_STR: str = "/api/v1"

    # --- Nemotron (NVIDIA API Catalog, OpenAI-compatible) ---------------
    NEMOTRON_API_KEY: str = ""
    NEMOTRON_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    # Empty = pick the first model from NEMOTRON_MODEL_PREFERENCE that the
    # key can see. Set explicitly to pin a model.
    NEMOTRON_MODEL: str = ""
    NEMOTRON_MODEL_PREFERENCE: List[str] = [
        "nvidia/nemotron-3.5-super-vl-120b-a12b",
        "nvidia/nemotron-3-nano-30b-a3b",
        "nvidia/nemotron-3-super-120b-a12b",
        "nvidia/nemotron-3-ultra-550b-a55b",
        "nvidia/llama-3.3-nemotron-super-49b-v1.5",
        "nvidia/llama-3.3-nemotron-super-49b-v1",
    ]
    NEMOTRON_BATCH_SIZE: int = 8            # reports per request
    NEMOTRON_MIN_INTERVAL_S: float = 2.0    # free tier is ~40 req/min
    NEMOTRON_TIMEOUT_S: float = 45.0

    # --- Continuous QUBO routing ----------------------------------------
    SOLVER_INTERVAL_S: float = 3.0          # time between solves
    SOLVER_CONFIRM_INTERVAL_S: float = 0.5  # faster re-solve while a route is confirming
    SOLVER_REPLICAS: int = 96               # annealing replicas per solve
    SOLVER_SWEEPS: int = 150                # Metropolis sweeps per replica
    SOLVER_MAX_CLAIMS: int = 60             # most-urgent open claims per solve
    CONFIDENCE_THRESHOLD: float = 0.90      # auto-dispatch threshold
    COMMIT_STREAK: int = 3                  # consecutive solves above threshold
    AUTOPILOT: bool = True                  # auto-dispatch on startup

    # --- Simulation -------------------------------------------------------
    SIM_FEED_ENABLED: bool = True           # built-in report generator
    SIM_FEED_INTERVAL_S: float = 20.0
    TIME_SCALE: float = 60.0                # 1 real second = 1 simulated minute
    UNIT_SPEED_KMH: float = 70.0


settings = Settings()
