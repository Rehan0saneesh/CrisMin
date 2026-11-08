"""Geocoding service for resolving textual locations to coordinates.

Nemotron extracts geographic identifiers from text. This service resolves
those identifiers to precise latitude/longitude points using PostGIS spatial
functions or an external geocoding API.
"""


class GeocodingService:
    """Resolves geographic descriptions to coordinates."""

    @staticmethod
    def geocode(description: str | None) -> tuple[float | None, float | None]:
        """Convert a textual location into latitude and longitude.

        In production, query PostGIS (ST_GeomFromText, ST_Point) or an
        external geocoding API. This mock returns None until a provider
        is configured.
        """

        if not description:
            return None, None

        # Placeholder: integrate a real geocoder here.
        return None, None
