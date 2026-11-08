"""NVIDIA Nemotron API client for structured entity extraction."""

import httpx

from app.config import settings
from app.models import NormalizedZone


class NemotronClient:
    """Async client for the NVIDIA Nemotron normalization API."""

    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

    async def normalize_report(self, report: str) -> NormalizedZone:
        """Send one raw report to Nemotron and return a normalized zone."""

        prompt = (
            "Extract the following fields from this emergency report as JSON: "
            "claim_id, severity_score (1.0 to 10.0), geographic_description, "
            "resource_demand. Report: "
        )

        payload = {
            "model": "nemotron",
            "messages": [
                {"role": "system", "content": "You extract structured data from emergency reports."},
                {"role": "user", "content": prompt + report},
            ],
            "temperature": 0.1,
        }

        try:
            response = await self.client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except Exception:
            # Fall back to rule-based normalization when Nemotron is unavailable
            return self._fallback_normalize(report)

        return self._parse_nemotron_output(content, report)

    def _parse_nemotron_output(
        self, content: str, report: str
    ) -> NormalizedZone:
        """Parse the Nemotron JSON output into a NormalizedZone."""

        import json

        try:
            extracted = json.loads(content)
        except json.JSONDecodeError:
            return self._fallback_normalize(report)

        return NormalizedZone(
            claim_id=extracted.get("claim_id", "SF-CAT-2026-UNKNOWN"),
            severity_score=float(extracted.get("severity_score", 2.0)),
            geographic_description=extracted.get("geographic_description"),
            latitude=extracted.get("latitude"),
            longitude=extracted.get("longitude"),
            resource_demand=extracted.get("resource_demand"),
            context=report,
        )

    def _fallback_normalize(self, report: str) -> NormalizedZone:
        """Rule-based fallback when the Nemotron API is unavailable."""

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

        return NormalizedZone(
            claim_id="SF-CAT-2026-FALLBACK",
            severity_score=severity_weight,
            context=report,
        )

    async def close(self):
        """Close the HTTP client."""

        await self.client.aclose()
