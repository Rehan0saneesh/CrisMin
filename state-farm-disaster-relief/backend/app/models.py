"""Pydantic request and response models for the API."""

from typing import List, Optional
from pydantic import BaseModel, Field


class RawReport(BaseModel):
    """A single unstructured emergency telemetry report."""

    report: str = Field(..., min_length=1)


class NormalizedZone(BaseModel):
    """A normalized disaster zone with demand weight and location."""

    claim_id: str
    severity_score: float
    geographic_description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    resource_demand: Optional[str] = None
    context: str


class NormalizationResult(BaseModel):
    """Output of the Nemotron normalization layer."""

    catastrophe_zones: List[NormalizedZone]
    total_nodes: int


class OptimizationRequest(BaseModel):
    """Request to compile and solve the QUBO Hamiltonian."""

    reports: List[str] = Field(..., description="List of raw emergency reports.")
    available_units: int = Field(default=2, ge=1)
    iterations: int = Field(default=2000, ge=1)


class DeploymentZone(BaseModel):
    """A zone selected for resource deployment."""

    claim_id: str
    severity_score: float
    deployed: bool


class OptimizationResult(BaseModel):
    """Output of the QUBO optimization solver."""

    deployment_vector: List[int]
    deployed_zones: List[DeploymentZone]
    best_energy: float
    total_nodes: int
    available_units: int


class TelemetryIngestResponse(BaseModel):
    """Response for telemetry ingestion endpoint."""

    status: str
    zones_normalized: int
    zones_saved: int
    claim_ids: List[str]


class DeploymentStatus(BaseModel):
    """Real-time deployment status for the dashboard."""

    total_claims: int
    deployed_units: int
    pending_units: int
    active_deployments: List[DeploymentZone]
