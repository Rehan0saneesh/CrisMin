"""NVIDIA Nemotron client for structured extraction from raw reports.

Talks to the NVIDIA API Catalog (OpenAI-compatible /chat/completions).
Reports are sent in batches and come back as one JSON object per report.
If the API is unreachable, unauthorized, or returns unusable output, the
affected reports go through a rule-based extractor instead, so the
pipeline never stalls. `status()` reports which path is active.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import httpx

from app.services.geocoding_service import canonical_place

log = logging.getLogger("crismin.nemotron")

DAMAGE_TYPES = [
    "Structural Collapse",
    "Flooding",
    "Water Intrusion",
    "Roof Damage",
    "Shingle Loss",
    "Downed Power Lines",
    "Wind Damage",
    "Other",
]
DEMANDS = ["command", "adjuster", "supply"]

SYSTEM_PROMPT = f"""You are the intake layer of an insurance catastrophe-response system.
For each report, extract structured fields. Reply with ONLY a JSON array, one object per report, no prose.

Object schema:
{{"id": string (copy from input),
 "severity": number 1-10,
 "damage_type": one of {json.dumps(DAMAGE_TYPES)},
 "location": "City, ST" or null,
 "people_at_risk": boolean,
 "resource_demand": one of {json.dumps(DEMANDS)},
 "confidence": number 0-1 (how sure you are of severity),
 "summary": string (<= 12 words)}}

Severity rubric:
9-10 life safety risk, people trapped, total loss, structural collapse.
7-8 active flooding, storm surge, live downed power lines, major structural damage.
4-6 roof damage, water intrusion, partial damage, home still habitable.
1-3 cosmetic or minor damage.

resource_demand: "command" for life-safety or multi-home incidents, "supply" for flooding/power/tarping needs, otherwise "adjuster"."""


@dataclass
class Extraction:
    severity: float
    damage_type: str
    location: Optional[str]
    people_at_risk: bool
    resource_demand: str
    confidence: float
    summary: str
    source: str  # "nemotron" or "rules"
    model: Optional[str] = None


@dataclass
class _Stats:
    mode: str = "starting"           # nemotron | fallback | disabled | starting
    model: Optional[str] = None
    calls: int = 0
    failures: int = 0
    reports: int = 0
    fallback_reports: int = 0
    last_latency_ms: Optional[int] = None
    last_error: Optional[str] = None
    last_ok_at: Optional[float] = None
    latencies: List[int] = field(default_factory=list)


def rule_extract(text: str) -> Extraction:
    """Keyword fallback. Deliberately conservative confidence."""
    t = text.lower()

    def has(*words: str) -> bool:
        return any(w in t for w in words)

    if has("total loss", "collapse", "trapped", "complete destruction", "unsafe to enter", "tornado"):
        sev, dmg = 10.0, "Structural Collapse"
    elif has("downed power", "live wire", "power pole", "electrical hazard", "downed lines"):
        sev, dmg = 8.0, "Downed Power Lines"
    elif has("flood", "storm surge", "underwater", "water rising", "overflow"):
        sev, dmg = 8.0, "Flooding"
    elif has("water intrusion", "leak", "water entering"):
        sev, dmg = 6.0, "Water Intrusion"
    elif has("roof damage", "roof", "tree limb", "moderate"):
        sev, dmg = 6.0, "Roof Damage"
    elif has("shingle"):
        sev, dmg = 4.0, "Shingle Loss"
    elif has("wind", "fence", "siding"):
        sev, dmg = 3.0, "Wind Damage"
    else:
        sev, dmg = 2.0, "Other"
    if has("minor", "superficial", "cosmetic", "a few") and sev > 4:
        sev -= 2
    people = has("trapped", "injur", "sheltering", "caller", "family", "adults")
    demand = "command" if sev >= 9 else "supply" if dmg in ("Flooding", "Downed Power Lines") else "adjuster"
    return Extraction(
        severity=sev,
        damage_type=dmg,
        location=canonical_place(text),
        people_at_risk=people,
        resource_demand=demand,
        confidence=0.55,
        summary=text[:80],
        source="rules",
    )


def _parse_json_array(content: str) -> List[dict]:
    """Pull the JSON array out of a model reply (tolerates think blocks / fences)."""
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.S)
    content = re.sub(r"```(?:json)?", "", content)
    start, end = content.find("["), content.rfind("]")
    if start == -1 or end <= start:
        # Single object reply for a batch of one
        s, e = content.find("{"), content.rfind("}")
        if s != -1 and e > s:
            return [json.loads(content[s : e + 1])]
        raise ValueError("no JSON array in reply")
    data = json.loads(content[start : end + 1])
    if not isinstance(data, list):
        raise ValueError("reply is not a list")
    return data


def _coerce(obj: dict, text: str, model: str) -> Extraction:
    fb = rule_extract(text)
    try:
        sev = float(obj.get("severity"))
    except (TypeError, ValueError):
        sev = fb.severity
    dmg = obj.get("damage_type") if obj.get("damage_type") in DAMAGE_TYPES else fb.damage_type
    demand = obj.get("resource_demand") if obj.get("resource_demand") in DEMANDS else fb.resource_demand
    try:
        conf = float(obj.get("confidence", 0.8))
    except (TypeError, ValueError):
        conf = 0.8
    # Trust the gazetteer over free text so pins land on known coordinates.
    loc = canonical_place(obj.get("location") or "") or fb.location
    return Extraction(
        severity=min(10.0, max(1.0, sev)),
        damage_type=dmg,
        location=loc,
        people_at_risk=bool(obj.get("people_at_risk", fb.people_at_risk)),
        resource_demand=demand,
        confidence=min(1.0, max(0.05, conf)),
        summary=str(obj.get("summary") or fb.summary)[:120],
        source="nemotron",
        model=model,
    )


class NemotronClient:
    """Async, rate-limited, batched Nemotron extractor with graceful fallback."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str = "",
        preference: Optional[List[str]] = None,
        min_interval_s: float = 2.0,
        timeout_s: float = 45.0,
    ):
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.pinned_model = model.strip()
        self.preference = preference or []
        self.min_interval_s = min_interval_s
        self.client = httpx.AsyncClient(
            timeout=timeout_s,
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
        )
        self._candidates: List[str] = []
        self._lock = asyncio.Lock()
        self._last_call = 0.0
        self._cooldown_until = 0.0
        self._no_thinking_toggle: set = set()  # models that rejected chat_template_kwargs
        self.stats = _Stats(mode="disabled" if not self.api_key else "starting")

    # ---------------------------------------------------------------- models
    async def _resolve_candidates(self) -> None:
        if self._candidates:
            return
        if self.pinned_model:
            self._candidates = [self.pinned_model]
            return
        available: List[str] = []
        try:
            r = await self.client.get(f"{self.base_url}/models")
            r.raise_for_status()
            available = [m["id"] for m in r.json().get("data", [])]
        except Exception as exc:  # listing is best-effort
            log.warning("Nemotron model listing failed: %s", exc)
        if available:
            preferred = [m for m in self.preference if m in available]
            others = sorted(m for m in available if "nemotron" in m.lower() and m not in preferred and "embed" not in m and "vl" not in m.split("/")[-1].split("-"))
            self._candidates = preferred + others
        if not self._candidates:
            self._candidates = list(self.preference)
        log.info("Nemotron candidates: %s", self._candidates[:4])

    # ------------------------------------------------------------------ main
    async def extract_batch(self, items: Dict[str, str]) -> Dict[str, Extraction]:
        """Extract fields for {id: report_text}. Always returns every id."""
        if not items:
            return {}
        self.stats.reports += len(items)
        result: Dict[str, Extraction] = {}

        if self.api_key and time.monotonic() >= self._cooldown_until:
            try:
                result = await self._call_api(items)
            except Exception as exc:
                self.stats.failures += 1
                self.stats.last_error = str(exc)[:240]
                self.stats.mode = "fallback"
                log.warning("Nemotron call failed, using rules: %s", exc)

        for rid, text in items.items():
            if rid not in result:
                result[rid] = rule_extract(text)
                self.stats.fallback_reports += 1
        return result

    async def _call_api(self, items: Dict[str, str]) -> Dict[str, Extraction]:
        await self._resolve_candidates()
        payload_reports = [{"id": rid, "text": text} for rid, text in items.items()]
        last_exc: Optional[Exception] = None

        async with self._lock:
            for model in list(self._candidates):
                wait = self.min_interval_s - (time.monotonic() - self._last_call)
                if wait > 0:
                    await asyncio.sleep(wait)
                self._last_call = time.monotonic()
                body = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": json.dumps(payload_reports)},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 220 * len(items) + 200,
                }
                if self._supports_thinking_toggle(model) and model not in self._no_thinking_toggle:
                    # Nemotron 3 / Nano reason by default; extraction does not need it.
                    body["chat_template_kwargs"] = {"enable_thinking": False}
                t0 = time.monotonic()
                self.stats.calls += 1
                r = await self.client.post(f"{self.base_url}/chat/completions", json=body)

                if r.status_code in (400, 422) and "chat_template_kwargs" in body:
                    # Some deployments reject the thinking toggle; retry once without it.
                    log.info("Nemotron %s rejected chat_template_kwargs (%s), retrying without", model, r.status_code)
                    body.pop("chat_template_kwargs")
                    self._no_thinking_toggle.add(model)
                    r = await self.client.post(f"{self.base_url}/chat/completions", json=body)

                if r.status_code in (404, 400) and len(self._candidates) > 1 and self._looks_like_model_error(r):
                    # Listed but not served for this key/account: drop it and try the next.
                    log.warning("Nemotron model %s unavailable (HTTP %s: %s), trying next", model, r.status_code, self._body_snippet(r))
                    self._candidates.remove(model)
                    last_exc = RuntimeError(f"{model}: HTTP {r.status_code} {self._body_snippet(r)}")
                    continue
                if r.status_code == 429:
                    retry = float(r.headers.get("retry-after", "15") or 15)
                    self._cooldown_until = time.monotonic() + retry
                    raise RuntimeError(f"rate limited (429), cooling down {retry:.0f}s")
                if r.status_code in (401, 403):
                    self._cooldown_until = time.monotonic() + 300
                    raise RuntimeError(f"HTTP {r.status_code}: key rejected or missing chat entitlement · {self._body_snippet(r)}")
                if r.status_code >= 400:
                    raise RuntimeError(f"{model}: HTTP {r.status_code} {self._body_snippet(r)}")

                msg = r.json()["choices"][0]["message"]
                content = msg.get("content") or msg.get("reasoning_content") or ""
                rows = _parse_json_array(content)
                ms = int((time.monotonic() - t0) * 1000)

                out: Dict[str, Extraction] = {}
                ids = list(items)
                for i, row in enumerate(rows):
                    if not isinstance(row, dict):
                        continue
                    rid = str(row.get("id", ids[i] if i < len(ids) else ""))
                    if rid in items:
                        out[rid] = _coerce(row, items[rid], model)

                self.stats.mode = "nemotron"
                self.stats.model = model
                self.stats.last_latency_ms = ms
                self.stats.latencies = (self.stats.latencies + [ms])[-20:]
                self.stats.last_ok_at = time.time()
                self.stats.last_error = None
                return out

        raise last_exc or RuntimeError("no Nemotron model available")

    @staticmethod
    def _supports_thinking_toggle(model: str) -> bool:
        m = model.lower()
        return "nemotron-3" in m or "nemotron-nano" in m

    @staticmethod
    def _body_snippet(r: httpx.Response) -> str:
        try:
            text = r.text.strip().replace("\n", " ")
        except Exception:
            text = ""
        return text[:200] or r.reason_phrase

    @staticmethod
    def _looks_like_model_error(r: httpx.Response) -> bool:
        if r.status_code == 404:
            return True
        text = r.text.lower()
        return "model" in text and ("not found" in text or "does not exist" in text or "unknown" in text)

    def status(self) -> dict:
        s = self.stats
        avg = int(sum(s.latencies) / len(s.latencies)) if s.latencies else None
        return {
            "mode": s.mode,
            "model": s.model or (self._candidates[0] if self._candidates else self.pinned_model or None),
            "configured": bool(self.api_key),
            "calls": s.calls,
            "failures": s.failures,
            "reports": s.reports,
            "fallback_reports": s.fallback_reports,
            "last_latency_ms": s.last_latency_ms,
            "avg_latency_ms": avg,
            "last_error": s.last_error,
            "last_ok_at": s.last_ok_at,
        }

    async def close(self):
        await self.client.aclose()
