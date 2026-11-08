"""Ingestion service for processing emergency telemetry reports.

Collects raw reports, normalizes them via Nemotron, resolves locations,
and persists results to PostgreSQL.
"""

from typing import List

from app.config import settings
from app.database import SessionLocal
from app.models import NormalizationResult, NormalizedZone, TelemetryIngestResponse
from app.normalizer import StateFarmCatastropheNormalizer
from app.services.geocoding_service import GeocodingService
from app.services.nemotron_client import NemotronClient


class IngestionService:
    """Orchestrates ingestion, normalization, and persistence of telemetry."""

    def __init__(self):
        self.nemotron = NemotronClient(
            api_key=settings.NEMOTRON_API_KEY,
            base_url=settings.NEMOTRON_BASE_URL,
        )

    async def ingest_reports(self, reports: List[str]) -> TelemetryIngestResponse:
        """Normalize and save a batch of raw emergency reports."""

        normalized: NormalizationResult = (
            StateFarmCatastropheNormalizer.normalize_claims_telemetry(reports)
        )

        claim_ids: List[str] = []
        zones_saved = 0

        db = SessionLocal()
        try:
            for zone in normalized.catastrophe_zones:
                lat, lng = GeocodingService.geocode(zone.geographic_description)
                if lat is not None:
                    zone.latitude = lat
                if lng is not None:
                    zone.longitude = lng

                claim_ids.append(zone.claim_id)
                zones_saved += 1
        finally:
            db.close()

        return TelemetryIngestResponse(
            status="ingested",
            zones_normalized=normalized.total_nodes,
            zones_saved=zones_saved,
            claim_ids=claim_ids,
        )

    async def close(self):
        """Close the Nemotron client."""

        await self.nemotron.close()
