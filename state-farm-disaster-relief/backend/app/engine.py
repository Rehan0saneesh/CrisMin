"""Live operations engine.

Owns the in-memory operational picture (claims, units, route predictions,
event log) and runs four background loops:

  intake  : pending reports → Nemotron (batched) → scored, geocoded claims
  solver  : every SOLVER_INTERVAL_S, re-solve the routing QUBO across replicas
            and update route predictions + confidence; with autopilot on,
            commit routes that hold ≥ CONFIDENCE_THRESHOLD for COMMIT_STREAK
            consecutive solves
  motion  : move en-route units, start/finish on-scene service
  feed    : optional simulated report stream

All state mutations happen on the event loop; the CPU-heavy solve runs in a
worker thread on a snapshot and is re-validated before it is applied.
"""

from __future__ import annotations

import asyncio
import itertools
import logging
import math
import random
import time
from collections import deque
from dataclasses import asdict, dataclass, field
from typing import Deque, Dict, List, Optional, Tuple

import numpy as np

from app.config import settings
from app.feed import generate_report
from app.routing_qubo import ClaimIn, UnitIn, haversine_km, solve_routing
from app.services.geocoding_service import GeocodingService, canonical_place
from app.services.nemotron_client import NemotronClient

log = logging.getLogger("crismin.engine")


# --------------------------------------------------------------------- model
@dataclass
class Claim:
    id: str
    claim_number: str
    report: str
    origin: str                      # seed | feed | manual | api
    received_at: float
    status: str = "pending"          # pending | open | assigned | on_scene | resolved
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    severity: Optional[float] = None
    damage_type: Optional[str] = None
    people_at_risk: bool = False
    demand: Optional[str] = None
    extraction_confidence: Optional[float] = None
    summary: Optional[str] = None
    source: Optional[str] = None     # nemotron | rules
    model: Optional[str] = None
    assigned_unit: Optional[str] = None
    dispatched_at: Optional[float] = None
    dispatch_confidence: Optional[float] = None
    resolved_at: Optional[float] = None
    hint_location: Optional[str] = None
    hint_damage: Optional[str] = None


@dataclass
class Unit:
    id: str
    name: str
    type: str
    lat: float
    lng: float
    location: str
    status: str = "Idle"             # Idle | En Route | Deployed
    assigned_claim: Optional[str] = None
    from_lat: float = 0.0
    from_lng: float = 0.0
    depart_at: float = 0.0
    arrive_at: float = 0.0
    service_until: float = 0.0


@dataclass
class Prediction:
    unit_id: str
    claim_id: str
    confidence: float          # what the commit rule uses (see basis)
    route_confidence: float    # P(this exact route is within ε of optimal)
    coverage: float            # P(claim is served by any unit)
    basis: str                 # "route" or "coverage" (critical claims)
    agreement: float
    eta_min: float
    streak: int
    first_seen: float


@dataclass
class SolverStats:
    cycle: int = 0
    last_at: Optional[float] = None
    ms: Optional[int] = None
    variables: int = 0
    couplings: int = 0
    replicas: int = 0
    sweeps: int = 0
    energy: Optional[float] = None
    mean_confidence: Optional[float] = None
    history: List[dict] = field(default_factory=list)


SEED_REPORTS = [
    ("Policyholder reports roof damage after high winds at Mobile, AL, tarp needed, family sheltering in place.", 4),
    ("Water intrusion in living room at Gulfport, MS, minor ceiling stains, no injuries.", 9),
    ("Severe structural failure at Pensacola, FL, garage collapsed onto vehicle. Possible total loss.", 15),
    ("Moderate shingle loss on north face of roof at Biloxi, MS, attic dry.", 21),
    ("911 transcript: tornado touchdown in New Orleans, LA, multiple homes damaged, caller trapped in bathroom.", 27),
    ("Fence down and patio furniture missing at Pascagoula, MS, cosmetic siding scuffs.", 34),
    ("Tree limb punched through roof at Gulf Shores, AL, roof damage over bedroom, rain entering.", 41),
    ("Downed power lines across driveway at Panama City, FL, home intact, power out.", 52),
]

SEED_UNITS = [
    ("CRU-01", "Mobile Command Unit 1", "Command Vehicle", "Mobile, AL"),
    ("CRU-02", "Mobile Command Unit 2", "Command Vehicle", "Gulfport, MS"),
    ("ADJ-01", "Claims Adjuster Team A", "Adjuster Team", "Pensacola, FL"),
    ("ADJ-02", "Claims Adjuster Team B", "Adjuster Team", "New Orleans, LA"),
    ("ADJ-03", "Claims Adjuster Team C", "Adjuster Team", "Biloxi, MS"),
    ("SUP-01", "Supply Truck Delta", "Supply Vehicle", "Biloxi, MS"),
]

from app.services.geocoding_service import GAZETTEER  # noqa: E402

CRITICAL_SEVERITY = 8.0


class OperationsEngine:
    def __init__(self, nemotron: NemotronClient):
        self.nemotron = nemotron
        self.autopilot = settings.AUTOPILOT
        self.feed_enabled = settings.SIM_FEED_ENABLED
        self.threshold = settings.CONFIDENCE_THRESHOLD
        self.commit_streak = settings.COMMIT_STREAK
        self._tasks: List[asyncio.Task] = []
        self._solve_now = asyncio.Event()
        self._rng = np.random.default_rng()
        self._reset_state()

    # ----------------------------------------------------------------- state
    def _reset_state(self) -> None:
        self.claims: Dict[str, Claim] = {}
        self.units: Dict[str, Unit] = {}
        self.predictions: Dict[Tuple[str, str], Prediction] = {}
        self.events: Deque[dict] = deque(maxlen=400)
        self.solver = SolverStats()
        self.resolved_total = 0
        self.response_minutes: Deque[float] = deque(maxlen=50)
        self._event_seq = itertools.count(1)
        self._claim_seq = itertools.count(4001)
        self._in_flight: set = set()
        self.epoch = time.time()  # changes on reset/restart so clients resync their event log
        now = time.time()
        for uid, name, utype, place in SEED_UNITS:
            lat, lng = GAZETTEER[place.lower()]
            self.units[uid] = Unit(uid, name, utype, lat + 0.12, lng - 0.05, f"{place} staging")
        for text, ago in SEED_REPORTS:
            # `ago` is in simulated minutes; convert to wall-clock seconds.
            self._add_claim(text, "seed", received_at=now - ago * 60 / settings.TIME_SCALE)
        self.event("info", f"Operations picture initialized · {len(self.units)} units · {len(self.claims)} reports queued for Nemotron")

    def event(self, level: str, msg: str) -> None:
        self.events.append({"id": next(self._event_seq), "ts": time.time(), "level": level, "msg": msg})

    def _add_claim(self, text: str, origin: str, received_at: Optional[float] = None,
                   hint_location: Optional[str] = None, hint_damage: Optional[str] = None) -> Claim:
        n = next(self._claim_seq)
        cid = f"c{n}"
        c = Claim(cid, f"CLM-{n}", text.strip(), origin, received_at or time.time(),
                  hint_location=hint_location, hint_damage=hint_damage)
        self.claims[cid] = c
        return c

    # ---------------------------------------------------------- public ops
    def ingest(self, reports: List[str], origin: str = "api", hints: Optional[List[dict]] = None) -> List[Claim]:
        out = []
        for i, text in enumerate(reports):
            if not text or not text.strip():
                continue
            h = (hints or [])[i] if hints and i < len(hints) else {}
            c = self._add_claim(text, origin, hint_location=h.get("location"), hint_damage=h.get("damage_type"))
            out.append(c)
        if out:
            src = {"feed": "Simulated feed", "manual": "Operator", "api": "Telemetry API"}.get(origin, origin)
            self.event("info", f"{src} · {len(out)} report(s) queued for Nemotron · {', '.join(c.claim_number for c in out)}")
        return out

    def dispatch(self, unit_id: str, claim_id: str, confidence: Optional[float] = None, manual: bool = True) -> str:
        u, c = self.units.get(unit_id), self.claims.get(claim_id)
        if not u or not c:
            raise ValueError("unknown unit or claim")
        if u.status != "Idle":
            raise ValueError(f"{unit_id} is not idle")
        if c.status != "open" or c.lat is None:
            raise ValueError(f"{c.claim_number} is not open for dispatch")
        pred = self.predictions.get((unit_id, claim_id))
        basis = " (critical coverage)" if pred and pred.basis == "coverage" else ""
        now = time.time()
        eta_min = float(haversine_km(u.lat, u.lng, c.lat, c.lng)) * 1.25 / settings.UNIT_SPEED_KMH * 60
        u.status, u.assigned_claim = "En Route", c.id
        u.from_lat, u.from_lng, u.depart_at = u.lat, u.lng, now
        u.arrive_at = now + max(2.0, eta_min * 60 / settings.TIME_SCALE)
        c.status, c.assigned_unit, c.dispatched_at, c.dispatch_confidence = "assigned", u.id, now, confidence
        for key in [k for k in self.predictions if k[0] == unit_id or k[1] == claim_id]:
            self.predictions.pop(key, None)
        how = "Operator dispatched" if manual else f"Auto-dispatched at {confidence:.0%} confidence{basis}"
        self.event("alert" if (c.severity or 0) >= 8 else "success",
                   f"{how} · {u.id} → {c.claim_number} {c.location} · sev {c.severity:.0f} · ETA {eta_min:.0f} min")
        return u.id

    def recall(self, unit_id: str) -> None:
        u = self.units.get(unit_id)
        if not u:
            raise ValueError("unknown unit")
        c = self.claims.get(u.assigned_claim or "")
        if c and c.status in ("assigned", "on_scene"):
            c.status, c.assigned_unit, c.dispatched_at, c.dispatch_confidence = "open", None, None, None
        u.status, u.assigned_claim = "Idle", None
        u.location = f"Near {c.location}" if c else u.location
        self.event("alert", f"{u.id} recalled by operator · now idle")

    def set_autopilot(self, enabled: bool) -> None:
        self.autopilot = enabled
        self.event("info", f"Auto-dispatch {'enabled' if enabled else 'paused'} · threshold {self.threshold:.0%} × {self.commit_streak} solves")

    def set_feed(self, enabled: bool) -> None:
        self.feed_enabled = enabled
        self.event("info", f"Simulated feed {'on' if enabled else 'off'}")

    def reset(self) -> None:
        self._reset_state()
        self._solve_now.set()

    def request_solve(self) -> None:
        self._solve_now.set()

    # ------------------------------------------------------------- loops
    def start(self) -> None:
        loop = asyncio.get_running_loop()
        self._tasks = [loop.create_task(coro, name=name) for name, coro in (
            ("intake", self._intake_loop()),
            ("solver", self._solver_loop()),
            ("motion", self._motion_loop()),
            ("feed", self._feed_loop()),
        )]

    async def stop(self) -> None:
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def _guard(self, name: str, coro_fn, delay: float) -> None:
        try:
            await coro_fn()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # keep loops alive
            log.exception("%s loop error", name)
            self.event("error", f"{name} loop error · {exc}")
            await asyncio.sleep(delay)

    async def _intake_loop(self) -> None:
        while True:
            await self._guard("intake", self._intake_once, 2.0)
            await asyncio.sleep(0.4)

    async def _intake_once(self) -> None:
        pending = [c for c in self.claims.values() if c.status == "pending" and c.id not in self._in_flight]
        if not pending:
            return
        batch = sorted(pending, key=lambda c: c.received_at)[: settings.NEMOTRON_BATCH_SIZE]
        ids = {c.id for c in batch}
        self._in_flight |= ids
        try:
            t0 = time.monotonic()
            result = await self.nemotron.extract_batch({c.id: c.report for c in batch})
            ms = int((time.monotonic() - t0) * 1000)
        finally:
            self._in_flight -= ids
        via = None
        unresolved = []
        for c in batch:
            if c.id not in self.claims:  # reset meanwhile
                continue
            ex = result[c.id]
            via = via or (f"Nemotron {ex.model.split('/')[-1]}" if ex.source == "nemotron" else "rule fallback")
            c.severity = round(ex.severity, 1)
            c.damage_type = c.hint_damage or ex.damage_type
            c.people_at_risk = ex.people_at_risk
            c.demand = ex.resource_demand
            c.extraction_confidence = round(ex.confidence, 2)
            c.summary = ex.summary
            c.source, c.model = ex.source, ex.model
            place = canonical_place(c.hint_location or "") or ex.location or canonical_place(c.report)
            c.location = place
            c.lat, c.lng = GeocodingService.geocode(place, seed=c.id)
            c.status = "open"
            if c.lat is None:
                unresolved.append(c.claim_number)
        crit = sum(1 for c in batch if (c.severity or 0) >= 8)
        self.event("success" if via and via.startswith("Nemotron") else "info",
                   f"{via} scored {len(batch)} report(s) · {crit} critical · {ms} ms")
        if unresolved:
            self.event("alert", f"Location unresolved, excluded from routing · {', '.join(unresolved)}")
        self._solve_now.set()

    async def _solver_loop(self) -> None:
        while True:
            # A route part-way through its confirmation streak gets re-checked
            # quickly (fresh replicas each time) instead of waiting a full cycle.
            confirming = self.autopilot and any(0 < p.streak < self.commit_streak for p in self.predictions.values())
            timeout = settings.SOLVER_CONFIRM_INTERVAL_S if confirming else settings.SOLVER_INTERVAL_S
            try:
                await asyncio.wait_for(self._solve_now.wait(), timeout=timeout)
            except asyncio.TimeoutError:
                pass
            self._solve_now.clear()
            await self._guard("solver", self._solve_once, 2.0)

    async def _solve_once(self) -> None:
        now = time.time()
        idle = [u for u in self.units.values() if u.status == "Idle"]
        open_claims = [c for c in self.claims.values() if c.status == "open" and c.lat is not None]
        # Bound solve time in a surge: route the most urgent claims first.
        open_claims = sorted(open_claims, key=lambda c: (-(c.severity or 0), c.received_at))[: settings.SOLVER_MAX_CLAIMS]
        units_in = [UnitIn(u.id, u.lat, u.lng, u.type) for u in idle]
        claims_in = [
            ClaimIn(c.id, c.lat, c.lng, c.severity or 1.0, c.extraction_confidence or 0.5,
                    (now - c.received_at) / 60 * settings.TIME_SCALE / 60,  # simulated minutes waiting
                    c.demand or "adjuster", c.people_at_risk, c.damage_type or "")
            for c in open_claims
        ]
        seed = int(self._rng.integers(0, 2**31))
        res = await asyncio.to_thread(
            solve_routing, units_in, claims_in, settings.UNIT_SPEED_KMH,
            settings.SOLVER_REPLICAS, settings.SOLVER_SWEEPS, np.random.default_rng(seed),
            0.15, 0.5, set(self.predictions.keys()),
        )

        s = self.solver
        s.cycle += 1
        s.last_at, s.ms = time.time(), res.ms
        s.variables, s.couplings, s.replicas, s.sweeps = res.variables, res.couplings, res.replicas, res.sweeps
        s.energy = res.energy if res.routes else None
        s.mean_confidence = round(res.mean_agreement, 4) if res.routes else None
        s.history = (s.history + [{"cycle": s.cycle, "energy": s.energy, "confidence": s.mean_confidence, "routes": len(res.routes)}])[-40:]

        # Update predictions with streak tracking (validate against live state).
        new: Dict[Tuple[str, str], Prediction] = {}
        for r in res.routes:
            u, c = self.units.get(r.unit_id), self.claims.get(r.claim_id)
            if not u or not c or u.status != "Idle" or c.status != "open":
                continue
            prev = self.predictions.get((r.unit_id, r.claim_id))
            # Critical claims: commit on confidence that the claim must be served
            # now; the consensus unit is used even if a near-equal alternative exists.
            critical = (c.severity or 0) >= CRITICAL_SEVERITY
            if critical and r.coverage > r.confidence:
                conf, basis = r.coverage, "coverage"
            else:
                conf, basis = r.confidence, "route"
            streak = (prev.streak + 1 if prev and prev.streak and conf >= self.threshold else
                      1 if conf >= self.threshold else 0)
            new[(r.unit_id, r.claim_id)] = Prediction(r.unit_id, r.claim_id, conf, r.confidence, r.coverage, basis,
                                                     r.agreement, r.eta_min, streak,
                                                     prev.first_seen if prev else time.time())
        changed = {k for k, p in new.items() if k not in self.predictions and p.confidence >= 0.5}
        self.predictions = new

        if changed and s.cycle > 1:
            moves = ", ".join(f"{u}→{self.claims[c].claim_number} {new[(u, c)].confidence:.0%}" for u, c in list(changed)[:3])
            self.event("info", f"Routing re-predicted · {moves}{' …' if len(changed) > 3 else ''}")

        if self.autopilot:
            ready = sorted((p for p in new.values() if p.streak >= self.commit_streak), key=lambda p: -p.confidence)
            for p in ready:
                try:
                    self.dispatch(p.unit_id, p.claim_id, confidence=p.confidence, manual=False)
                except ValueError:
                    continue

    async def _motion_loop(self) -> None:
        while True:
            await self._guard("motion", self._motion_once, 1.0)
            await asyncio.sleep(0.5)

    async def _motion_once(self) -> None:
        now = time.time()
        freed = False
        for u in self.units.values():
            c = self.claims.get(u.assigned_claim or "")
            if u.status == "En Route" and c:
                f = min(1.0, (now - u.depart_at) / max(0.1, u.arrive_at - u.depart_at))
                u.lat = u.from_lat + (c.lat - u.from_lat) * f
                u.lng = u.from_lng + (c.lng - u.from_lng) * f
                if f >= 1.0:
                    u.status, u.location = "Deployed", c.location or u.location
                    c.status = "on_scene"
                    service_min = 15 + 4 * (c.severity or 2)
                    u.service_until = now + service_min * 60 / settings.TIME_SCALE
                    if c.dispatched_at:  # dispatch → on scene, in simulated minutes
                        self.response_minutes.append((now - c.dispatched_at) * settings.TIME_SCALE / 60)
                    self.event("success", f"{u.id} on scene · {c.claim_number} {c.location}")
            elif u.status == "Deployed" and now >= u.service_until:
                if c:
                    c.status, c.resolved_at = "resolved", now
                    self.resolved_total += 1
                    self.event("success", f"{c.claim_number} resolved · {u.id} available")
                u.status, u.assigned_claim = "Idle", None
                freed = True
        # Keep the picture bounded: drop resolved claims beyond the newest 25.
        resolved = sorted((c for c in self.claims.values() if c.status == "resolved"), key=lambda c: c.resolved_at or 0)
        for c in resolved[:-25]:
            self.claims.pop(c.id, None)
        if freed:
            self._solve_now.set()

    async def _feed_loop(self) -> None:
        rng = random.Random()
        while True:
            await asyncio.sleep(settings.SIM_FEED_INTERVAL_S * rng.uniform(0.6, 1.4))
            if self.feed_enabled:
                self.ingest([generate_report(rng)], origin="feed")

    # ------------------------------------------------------------ snapshot
    def snapshot(self, since: int = 0) -> dict:
        now = time.time()
        claims = []
        for c in self.claims.values():
            d = asdict(c)
            d.pop("hint_location"); d.pop("hint_damage")
            pred = next((p for p in self.predictions.values() if p.claim_id == c.id), None)
            d["prediction"] = ({"unit_id": pred.unit_id, "confidence": pred.confidence, "streak": pred.streak, "eta_min": pred.eta_min}
                               if pred else None)
            claims.append(d)
        units = []
        for u in self.units.values():
            d = {k: getattr(u, k) for k in ("id", "name", "type", "lat", "lng", "location", "status", "assigned_claim")}
            d["eta_s"] = max(0.0, u.arrive_at - now) if u.status == "En Route" else None
            d["service_s"] = max(0.0, u.service_until - now) if u.status == "Deployed" else None
            pred = next((p for p in self.predictions.values() if p.unit_id == u.id), None)
            d["prediction"] = {"claim_id": pred.claim_id, "confidence": pred.confidence, "streak": pred.streak} if pred else None
            units.append(d)
        s = self.solver
        return {
            "epoch": self.epoch,
            "server_time": now,
            "claims": claims,
            "units": units,
            "predictions": [asdict(p) for p in sorted(self.predictions.values(), key=lambda p: -p.confidence)],
            "solver": {
                "cycle": s.cycle, "last_at": s.last_at, "ms": s.ms, "variables": s.variables, "couplings": s.couplings,
                "replicas": s.replicas, "sweeps": s.sweeps, "energy": s.energy, "mean_confidence": s.mean_confidence,
                "history": s.history, "interval_s": settings.SOLVER_INTERVAL_S,
            },
            "nemotron": {**self.nemotron.status(), "queue": sum(1 for c in self.claims.values() if c.status == "pending")},
            "control": {
                "autopilot": self.autopilot, "threshold": self.threshold, "commit_streak": self.commit_streak,
                "feed_enabled": self.feed_enabled, "time_scale": settings.TIME_SCALE,
            },
            "stats": {
                "resolved_total": self.resolved_total,
                "avg_response_min": round(sum(self.response_minutes) / len(self.response_minutes), 1) if self.response_minutes else None,
            },
            "events": [e for e in self.events if e["id"] > since],
        }
