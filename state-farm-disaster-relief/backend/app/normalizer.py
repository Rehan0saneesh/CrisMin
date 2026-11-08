"""Nemotron normalization mock.

Turns raw, unstructured disaster telemetry into structured JSON tensors and
priority weights. This simulates the NVIDIA Nemotron ingestion layer.
"""

from typing import List

from app.models import NormalizationResult, NormalizedZone


class StateFarmCatastropheNormalizer:
    """Simulates the NVIDIA Nemotron ingestion and normalization layer."""

    @staticmethod
    def normalize_claims_telemetry(raw_reports: List[str]) -> NormalizationResult:
        """Parse raw reports into normalized zones with demand weights."""

        processed_zones: List[NormalizedZone] = []

        for index, report in enumerate(raw_reports):
            lower_rep = report.lower()

            if (
                "total loss" in lower_rep
                or "severe structural" in lower_rep
                or "tornado" in lower_rep
            ):
                severity_weight = 10.0
            elif (
                "moderate" in lower_rep
                or "roof damage" in lower_rep
                or "shingle" in lower_rep
            ):
                severity_weight = 6.0
            else:
                severity_weight = 2.0

            processed_zones.append(
                NormalizedZone(
                    claim_id=f"SF-CAT-2026-{index + 100}",
                    severity_score=severity_weight,
                    geographic_description=None,
                    latitude=None,
                    longitude=None,
                    resource_demand=None,
                    context=report,
                )
            )

        return NormalizationResult(
            catastrophe_zones=processed_zones,
            total_nodes=len(processed_zones),
        )
