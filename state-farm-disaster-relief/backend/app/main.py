"""FastAPI backend for the State Farm catastrophe response platform."""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.models import (
    OptimizationRequest,
    OptimizationResult,
    TelemetryIngestResponse,
    DeploymentStatus,
)
from app.normalizer import StateFarmCatastropheNormalizer
from app.qubo import StateFarmCatastropheOptimizer
from app.services.ingestion_service import IngestionService

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Ingests unstructured emergency telemetry, normalizes via Nemotron, "
        "compiles a QUBO Hamiltonian, and solves CRU deployment routing."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def init_db():
    """Create database tables on startup if a database is reachable."""

    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Database may not be available yet; tables are created via init.sql in Docker
        pass


@app.get("/")
def read_root():
    """Health check endpoint."""

    return {"status": "ok", "service": "state-farm-catastrophe-response"}


@app.get("/health")
def health_check():
    """Health check endpoint for load balancers and monitoring."""

    return {"status": "ok", "service": "state-farm-catastrophe-response"}


@app.post(
    f"{settings.API_V1_STR}/telemetry/ingest",
    response_model=TelemetryIngestResponse,
)
async def ingest_telemetry(
    reports: list[str],
    background_tasks: BackgroundTasks,
):
    """Accept batch raw text reports, normalize, and persist to PostgreSQL."""

    service = IngestionService()
    try:
        result = await service.ingest_reports(reports)
    finally:
        await service.close()

    return result


@app.post(
    f"{settings.API_V1_STR}/optimize/run",
    response_model=OptimizationResult,
)
def run_optimization(request: OptimizationRequest):
    """Compile the QUBO matrix and solve for the deployment vector."""

    normalized = StateFarmCatastropheNormalizer.normalize_claims_telemetry(
        request.reports
    )

    optimizer = StateFarmCatastropheOptimizer(
        normalized_data=normalized,
        available_units=request.available_units,
    )

    return optimizer.optimize(iterations=request.iterations)


@app.get(
    f"{settings.API_V1_STR}/deployments/status",
    response_model=DeploymentStatus,
)
def deployment_status():
    """Return real-time deployment schedules and unit tracking data."""

    # Placeholder: query the database for live deployment data.
    return DeploymentStatus(
        total_claims=0,
        deployed_units=0,
        pending_units=0,
        active_deployments=[],
    )
