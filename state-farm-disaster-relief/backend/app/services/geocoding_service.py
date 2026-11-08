"""Resolve place names from reports to coordinates.

Uses a built-in gazetteer of Gulf Coast places (covers every location the
simulated feeds produce). Swap `geocode` for PostGIS or an external geocoder
when real addresses arrive.
"""

import hashlib
import re
from typing import Optional, Tuple

GAZETTEER = {
    "mobile, al": (30.6954, -88.0399),
    "gulf shores, al": (30.2460, -87.7008),
    "gulfport, ms": (30.3674, -89.0928),
    "biloxi, ms": (30.3960, -88.8853),
    "pascagoula, ms": (30.3658, -88.5561),
    "pensacola, fl": (30.4213, -87.2169),
    "panama city, fl": (30.1588, -85.6602),
    "new orleans, la": (29.9511, -90.0715),
    "baton rouge, la": (30.4515, -91.1871),
    "lafayette, la": (30.2241, -92.0198),
    "lake charles, la": (30.2266, -93.2174),
}
_CITY_ONLY = {k.split(",")[0]: k for k in GAZETTEER}
_PATTERN = re.compile(r"([A-Z][a-zA-Z.\- ]+?),\s*(AL|MS|FL|LA|TX)\b")


def canonical_place(text: Optional[str]) -> Optional[str]:
    """Return 'City, ST' for the first known place mentioned in text."""
    if not text:
        return None
    lower = text.lower()
    for m in _PATTERN.finditer(text):
        key = f"{m.group(1).strip().lower()}, {m.group(2).lower()}"
        # Allow longer prefixes like "Storm surge at Mobile, AL"
        for known in GAZETTEER:
            if key.endswith(known):
                return _title(known)
    for city, key in _CITY_ONLY.items():
        if re.search(rf"\b{re.escape(city)}\b", lower):
            return _title(key)
    return None


def _title(key: str) -> str:
    city, st = key.split(", ")
    return f"{city.title()}, {st.upper()}"


class GeocodingService:
    """Resolves geographic descriptions to coordinates."""

    @staticmethod
    def geocode(description: Optional[str], seed: str = "") -> Tuple[Optional[float], Optional[float]]:
        """Convert a place name into lat/lng with a small deterministic
        offset per claim so several claims in one city do not stack."""
        place = canonical_place(description)
        if not place:
            return None, None
        lat, lng = GAZETTEER[place.lower()]
        h = hashlib.sha1(f"{seed}{place}".encode()).digest()
        return lat + (h[0] / 255 - 0.5) * 0.08, lng + (h[1] / 255 - 0.5) * 0.08
