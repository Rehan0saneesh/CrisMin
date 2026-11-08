"""FastAPI backend for the State Farm catastrophe response platform."""

import logging
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.database import Base, engine as db_engine
from app.engine import OperationsEngine
from app.models import DeploymentStatus, DeploymentZone, OptimizationRequest, OptimizationResult, TelemetryIngestResponse
from app.normalizer import StateFarmCatastropheNormalizer
from app.qubo import StateFarmCatastropheOptimizer
from app.services.nemotron_client import NemotronClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

ops: Optional[OperationsEngine] = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global ops
    try:
        Base.metadata.create_all(bind=db_engine)
    except Exception:
        pass  # Postgres optional locally; tables come from init.sql in Docker
    nemotron = NemotronClient(
        api_key=settings.NEMOTRON_API_KEY,
        base_url=settings.NEMOTRON_BASE_URL,
        model=settings.NEMOTRON_MODEL,
        preference=settings.NEMOTRON_MODEL_PREFERENCE,
        min_interval_s=settings.NEMOTRON_MIN_INTERVAL_S,
        timeout_s=settings.NEMOTRON_TIMEOUT_S,
    )
    ops = OperationsEngine(nemotron)
    ops.start()
    logging.getLogger("crismin").info(
        "Engine started · Nemotron %s · threshold %.0f%% × %d · feed %s",
        "configured" if settings.NEMOTRON_API_KEY else "NOT configured (rule fallback)",
        settings.CONFIDENCE_THRESHOLD * 100, settings.COMMIT_STREAK, "on" if settings.SIM_FEED_ENABLED else "off",
    )
    yield
    await ops.stop()
    await nemotron.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Ingests unstructured emergency telemetry, normalizes it with NVIDIA Nemotron, "
        "and continuously re-solves unit routing as a QUBO with replica-based confidence."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def _ops() -> OperationsEngine:
    if ops is None:
        raise HTTPException(503, "engine starting")
    return ops


# ------------------------------------------------------------------ health
@app.get("/")
@app.get("/health")
def health_check():
    """Health check endpoint for load balancers and monitoring."""
    return {"status": "ok", "service": "state-farm-catastrophe-response"}


@app.get("/v1/models")
def list_models():
    """OpenAI-compatible model list (kept for existing client integrations)."""
    return {"object": "list", "data": [{"id": "nemotron", "object": "model", "created": 1677610602, "owned_by": "nvidia"}]}


# --------------------------------------------------------------- telemetry
class IngestHint(BaseModel):
    location: Optional[str] = None
    damage_type: Optional[str] = None


@app.post(f"{settings.API_V1_STR}/telemetry/ingest", response_model=TelemetryIngestResponse)
async def ingest_telemetry(
    reports: List[str] = Body(embed=True),
    hints: Optional[List[IngestHint]] = Body(default=None, embed=True),
    origin: str = Body(default="api", embed=True),
):
    """Queue raw reports for Nemotron extraction. Scoring and routing follow automatically."""
    created = _ops().ingest(
        reports,
        origin=origin if origin in ("api", "manual") else "api",
        hints=[h.model_dump() for h in hints] if hints else None,
    )
    return TelemetryIngestResponse(
        status="queued",
        zones_normalized=len(created),
        zones_saved=len(created),
        claim_ids=[c.claim_number for c in created],
    )


# -------------------------------------------------------------- live ops
@app.get(f"{settings.API_V1_STR}/ops/state")
def ops_state(since: int = Query(0, ge=0)):
    """Full operational picture. Pass `since` (last event id) to receive only new events."""
    return _ops().snapshot(since)


class DispatchBody(BaseModel):
    unit_id: str
    claim_id: str


@app.post(f"{settings.API_V1_STR}/ops/dispatch")
def ops_dispatch(body: DispatchBody):
    try:
        _ops().dispatch(body.unit_id, body.claim_id, manual=True)
    except ValueError as e:
        raise HTTPException(409, str(e))
    return {"ok": True}


class UnitBody(BaseModel):
    unit_id: str


@app.post(f"{settings.API_V1_STR}/ops/recall")
def ops_recall(body: UnitBody):
    try:
        _ops().recall(body.unit_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"ok": True}


class ToggleBody(BaseModel):
    enabled: bool


@app.post(f"{settings.API_V1_STR}/ops/autopilot")
def ops_autopilot(body: ToggleBody):
    _ops().set_autopilot(body.enabled)
    return {"autopilot": body.enabled}


@app.post(f"{settings.API_V1_STR}/ops/feed")
def ops_feed(body: ToggleBody):
    _ops().set_feed(body.enabled)
    return {"feed_enabled": body.enabled}


@app.post(f"{settings.API_V1_STR}/ops/solve")
def ops_solve():
    _ops().request_solve()
    return {"ok": True}


@app.post(f"{settings.API_V1_STR}/ops/reset")
def ops_reset():
    _ops().reset()
    return {"ok": True}


# ------------------------------------------------------------ legacy API
@app.post(f"{settings.API_V1_STR}/optimize/run", response_model=OptimizationResult)
def run_optimization(request: OptimizationRequest):
    """Stateless zone-selection QUBO over the given reports (used by the TUI and MQTT test)."""
    normalized = StateFarmCatastropheNormalizer.normalize_claims_telemetry(request.reports)
    optimizer = StateFarmCatastropheOptimizer(normalized_data=normalized, available_units=request.available_units)
    return optimizer.optimize(iterations=request.iterations)


@app.get(f"{settings.API_V1_STR}/deployments/status", response_model=DeploymentStatus)
def deployment_status():
    """Deployment summary from the live engine."""
    o = _ops()
    active = [c for c in o.claims.values() if c.status in ("assigned", "on_scene")]
    return DeploymentStatus(
        total_claims=sum(1 for c in o.claims.values() if c.status != "resolved"),
        deployed_units=sum(1 for u in o.units.values() if u.status != "Idle"),
        pending_units=sum(1 for u in o.units.values() if u.status == "Idle"),
        active_deployments=[DeploymentZone(claim_id=c.claim_number, severity_score=c.severity or 0, deployed=True) for c in active],
    )
