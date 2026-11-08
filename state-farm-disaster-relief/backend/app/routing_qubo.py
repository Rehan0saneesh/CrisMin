"""Continuous unit→claim routing as a QUBO, with replica-based confidence.

Formulation
-----------
One binary variable x_uc per (idle unit u, open claim c) pair: x_uc = 1 means
"send u to c". Minimize

    E(x) = Σ h_uc x_uc  +  λ Σ_{conflicting pairs} x_i x_j

    h_uc = -urgency_c + β · eta_uc + affinity_uc

    urgency_c   = severity_c · (1 + 0.5·min(wait_c / 90 min, 1)) · (1.25 if people at risk)
                  + 0.02 · min(wait_c, 120 min)        (first-come tie-break)
    eta_uc      = travel minutes from u to c, capped at 240 in the cost so a
                  critical claim always outweighs distance (minor ones still wait)
    affinity_uc = bonus when the unit type fits the demand Nemotron extracted

Two pairs conflict when they share a unit (a unit goes to one claim) or a
claim (a claim gets one unit). λ is set above the largest |h| so a conflict
always costs more than it gains. This is the standard assignment QUBO; with
x = (1 + s)/2 it maps to an Ising Hamiltonian H = Σ h'_i s_i + Σ J_ij s_i s_j
that annealing hardware (D-Wave, cuQuantum/GPU samplers) could solve directly.

Confidence
----------
Inputs are uncertain: Nemotron's severity has its own confidence, and
travel times vary with traffic and weather. Each solve runs R annealing
replicas. Every replica samples its own severities and travel times from
those uncertainties and anneals its own Hamiltonian. Uncertainty is
correlated where it is in reality: an extraction error is shared by every
report of the same damage category, and traffic affects all of a unit's
routes together, so equivalent claims do not split the vote at random. A route's
confidence is the share of replicas in which taking it is optimal or costs
at most ε (default 0.5 severity points ≈ 12 min of travel) more than that
replica's ground state. The cost of forcing a route into a replica's ground
state is exactly the swap-move ΔE used by the annealer, which is an upper
bound on regret, so the estimate is conservative. Interchangeable choices
(two equivalent roof claims a block apart) score high; genuinely contested
calls stay low. `agreement` reports the stricter exact-match share, and
`coverage` the share of replicas in which the claim is served by any unit
(used by the engine for critical claims, where "who" matters less than "now").
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import List, Optional

import numpy as np


@dataclass
class UnitIn:
    id: str
    lat: float
    lng: float
    type: str  # "Command Vehicle" | "Adjuster Team" | "Supply Vehicle"


@dataclass
class ClaimIn:
    id: str
    lat: float
    lng: float
    severity: float
    confidence: float  # Nemotron extraction confidence 0-1
    wait_min: float
    demand: str  # "command" | "adjuster" | "supply"
    people_at_risk: bool
    category: str = ""  # damage type; extraction error is shared within a category


@dataclass
class RoutePrediction:
    unit_id: str
    claim_id: str
    confidence: float   # P(route is within ε of the optimal plan)
    agreement: float    # share of replicas whose ground state has exactly this route
    coverage: float     # share of replicas in which this claim gets any unit
    eta_min: float
    urgency: float


@dataclass
class SolveResult:
    routes: List[RoutePrediction]
    energy: float
    variables: int
    couplings: int
    replicas: int
    sweeps: int
    ms: int
    mean_agreement: float  # avg confidence of the consensus plan


DEMAND_FOR_TYPE = {"Command Vehicle": "command", "Adjuster Team": "adjuster", "Supply Vehicle": "supply"}
BETA_PER_MIN = 0.04  # 1 severity point ≈ 25 min of travel
TRAVEL_CAP_MIN = 240.0  # beyond 4h a unit is simply "far"; caps the travel cost at 9.6 points


def haversine_km(a_lat, a_lng, b_lat, b_lng):
    r = 6371.0
    p1, p2 = np.radians(a_lat), np.radians(b_lat)
    dphi = p2 - p1
    dl = np.radians(b_lng - a_lng)
    h = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(h))


def solve_routing(
    units: List[UnitIn],
    claims: List[ClaimIn],
    speed_kmh: float = 70.0,
    replicas: int = 48,
    sweeps: int = 150,
    rng: Optional[np.random.Generator] = None,
    min_confidence: float = 0.15,
    epsilon: float = 0.5,
    prefer: Optional[set] = None,
) -> SolveResult:
    """`prefer`: (unit_id, claim_id) routes from the previous solve. Among
    equally confident options they win, so interchangeable choices do not
    flip between solves (which would reset the commit streak)."""
    t0 = time.perf_counter()
    rng = rng or np.random.default_rng()
    if not units or not claims:
        return SolveResult([], 0.0, 0, 0, replicas, sweeps, 0, 0.0)

    U, C = len(units), len(claims)
    ulat = np.array([u.lat for u in units])[:, None]
    ulng = np.array([u.lng for u in units])[:, None]
    clat = np.array([c.lat for c in claims])[None, :]
    clng = np.array([c.lng for c in claims])[None, :]
    eta = haversine_km(ulat, ulng, clat, clng) * 1.25 / speed_kmh * 60.0  # road factor 1.25

    sev = np.array([c.severity for c in claims])
    conf = np.array([c.confidence for c in claims])
    wait = np.array([c.wait_min for c in claims])
    people = np.array([1.25 if c.people_at_risk else 1.0 for c in claims])
    aging = 1.0 + 0.5 * np.minimum(wait / 90.0, 1.0)
    fifo = 0.02 * np.minimum(wait, 120.0)  # tie-break only: capped at 2.4 points

    affinity = np.zeros((U, C))
    for i, u in enumerate(units):
        for j, c in enumerate(claims):
            if DEMAND_FOR_TYPE.get(u.type) == c.demand:
                affinity[i, j] -= 1.0
            if u.type == "Command Vehicle" and c.severity < 5:
                affinity[i, j] += 1.5  # don't burn a command post on minor damage

    eta_cost = np.minimum(eta, TRAVEL_CAP_MIN)
    nominal_h = -(sev * aging * people + fifo)[None, :] + BETA_PER_MIN * eta_cost + affinity

    # Prune pairs that are never worth taking, even optimistically.
    keep = nominal_h < 1.0
    pairs = np.argwhere(keep)  # (n, 2) of (u_idx, c_idx)
    n = len(pairs)
    if n == 0:
        return SolveResult([], 0.0, 0, 0, replicas, sweeps, int((time.perf_counter() - t0) * 1000), 0.0)
    pu, pc = pairs[:, 0], pairs[:, 1]

    # Conflict graph (shared unit or shared claim), symmetric, zero diagonal.
    conflict = ((pu[:, None] == pu[None, :]) | (pc[:, None] == pc[None, :])).astype(np.float64)
    np.fill_diagonal(conflict, 0.0)
    couplings = int(conflict.sum() // 2)

    # --- Per-replica uncertain inputs -----------------------------------
    R = replicas
    sigma = 0.4 + 2.5 * (1.0 - conf)                       # severity noise from Nemotron confidence
    cats = sorted({c.category for c in claims})
    cat_idx = np.array([cats.index(c.category) for c in claims])
    z_cat = rng.normal(0, 1, (R, len(cats)))[:, cat_idx]    # shared per damage category
    z_own = rng.normal(0, 1, (R, C))                        # idiosyncratic
    sev_r = np.clip(sev[None, :] + (0.94 * z_cat + 0.34 * z_own) * sigma[None, :], 1.0, 10.0)
    urg_r = sev_r * (aging * people)[None, :] + fifo[None, :]  # (R, C)
    z_unit = rng.normal(0, 1, (R, U))[:, pu]                # shared traffic per unit
    eta_noise = np.exp(0.15 * z_unit + 0.08 * rng.normal(0, 1, (R, n)))
    h = -urg_r[:, pc] + BETA_PER_MIN * np.minimum(eta[pu, pc][None, :] * eta_noise, TRAVEL_CAP_MIN) + affinity[pu, pc][None, :]
    scale = np.abs(h).max(axis=1)                           # (R,)
    lam = 2.0 * scale + 1.0                                 # penalty strength per replica

    # --- Simulated annealing, all replicas vectorized --------------------
    # Moves preserve feasibility (the analogue of an XY / swap mixer in
    # constrained QAOA): turning x_i on also turns off the variables that
    # conflict with it (the unit's current claim and the claim's current
    # unit). The walk then stays in the zero-penalty subspace, where E
    # reduces to Σ h_i x_i, and can move a unit between claims in one step
    # instead of crossing a λ-sized barrier.
    rows = np.arange(R)
    X = np.zeros((R, n))
    unit_holder = np.full((R, U), -1, dtype=np.int64)    # var index holding unit u
    claim_holder = np.full((R, C), -1, dtype=np.int64)   # var index holding claim c
    E = np.zeros(R)
    best_X = X.copy()
    best_E = np.zeros(R)
    h_pad = np.concatenate([h, np.zeros((R, 1))], axis=1)  # index -1 → 0 energy
    T_hi, T_lo = 0.12 * scale, 0.02 * scale
    for s in range(sweeps):
        T = T_hi * (T_lo / T_hi) ** (s / max(1, sweeps - 1))
        noise = rng.random((R, n))
        for i in rng.permutation(n):
            u, c = pu[i], pc[i]
            on = X[:, i] == 1
            k1 = unit_holder[:, u]
            k2 = claim_holder[:, c]
            dE = np.where(on, -h[:, i], h[:, i] - h_pad[rows, k1] - h_pad[rows, k2])
            accept = (dE <= 0) | (noise[:, i] < np.exp(-np.maximum(dE, 0) / T))
            if not accept.any():
                continue
            # Turn off: i itself (if on), else the evicted conflicts (if any)
            turn_on = accept & ~on
            turn_off_i = accept & on
            for k in (k1, k2):
                ev = turn_on & (k >= 0)
                if ev.any():
                    r_ev, k_ev = rows[ev], k[ev]
                    X[r_ev, k_ev] = 0
                    unit_holder[r_ev, pu[k_ev]] = -1
                    claim_holder[r_ev, pc[k_ev]] = -1
            if turn_off_i.any():
                X[turn_off_i, i] = 0
                unit_holder[turn_off_i, u] = -1
                claim_holder[turn_off_i, c] = -1
            if turn_on.any():
                X[turn_on, i] = 1
                unit_holder[turn_on, u] = i
                claim_holder[turn_on, c] = i
            E = E + np.where(accept, dE, 0.0)
        better = E < best_E - 1e-12
        if better.any():
            best_E[better] = E[better]
            best_X[better] = X[better]

    agree = best_X.mean(axis=0)  # exact-match share per pair

    # ε-optimality: cost of forcing pair i into each replica's ground state.
    holder_u = np.full((R, U), n, dtype=np.int64)   # n → padded zero column
    holder_c = np.full((R, C), n, dtype=np.int64)
    rr, ii = np.nonzero(best_X)
    holder_u[rr, pu[ii]] = ii
    holder_c[rr, pc[ii]] = ii
    k1 = holder_u[:, pu]                            # (R, n)
    k2 = holder_c[:, pc]
    hp = h_pad
    evict = h - np.take_along_axis(hp, k1, 1) - np.where(k2 == k1, 0.0, np.take_along_axis(hp, k2, 1))
    # Swap alternative: the unit that held this claim takes our unit's old claim.
    pair_index = np.full((U + 1, C + 1), n, dtype=np.int64)
    pair_index[pu, pc] = np.arange(n)
    pu_ext = np.append(pu, U)                       # padded holder n → sentinel row/col
    pc_ext = np.append(pc, C)
    swap_var = pair_index[pu_ext[k2], pc_ext[k1]]   # (R, n)
    h_inf = np.concatenate([h, np.full((R, 1), np.inf)], axis=1)
    swap = evict + np.take_along_axis(h_inf, swap_var, 1)
    swap = np.where((k1 == n) | (k2 == n), np.inf, swap)
    regret = np.where(best_X == 1, 0.0, np.minimum(evict, swap))
    conf_eps = (regret <= epsilon).mean(axis=0)
    covered = np.zeros((R, C))
    rr, ii = np.nonzero(best_X)
    covered[rr, pc[ii]] = 1.0
    coverage = covered.mean(axis=0)  # per claim

    # Consensus plan: greedy compatible pairs, ranked by confidence then agreement.
    routes: List[RoutePrediction] = []
    taken_u, taken_c = set(), set()
    prefer = prefer or set()
    preferred = np.array([(units[int(a)].id, claims[int(b)].id) in prefer for a, b in pairs], dtype=float)
    conf_rounded = np.round(conf_eps, 2)  # treat sub-percent differences as ties
    for i in np.lexsort((-agree, -preferred, -conf_rounded)):
        if conf_eps[i] < min_confidence or agree[i] == 0:
            continue
        u, c = int(pu[i]), int(pc[i])
        if u in taken_u or c in taken_c:
            continue
        taken_u.add(u); taken_c.add(c)
        routes.append(
            RoutePrediction(
                unit_id=units[u].id,
                claim_id=claims[c].id,
                confidence=float(round(conf_eps[i], 4)),
                agreement=float(round(agree[i], 4)),
                coverage=float(round(coverage[c], 4)),
                eta_min=float(round(eta[u, c], 1)),
                urgency=float(round(sev[c] * aging[c] * people[c] + fifo[c], 2)),
            )
        )

    # Energy of the consensus plan under nominal inputs.
    lam0 = 2.0 * float(np.abs(nominal_h[pu, pc]).max()) + 1.0
    x = np.zeros(n)
    idx = {(int(a), int(b)): k for k, (a, b) in enumerate(pairs)}
    for rt in routes:
        ui = next(k for k, u in enumerate(units) if u.id == rt.unit_id)
        ci = next(k for k, c in enumerate(claims) if c.id == rt.claim_id)
        x[idx[(ui, ci)]] = 1
    energy = float(nominal_h[pu, pc] @ x + 0.5 * lam0 * x @ conflict @ x)

    return SolveResult(
        routes=routes,
        energy=round(energy, 3),
        variables=n,
        couplings=couplings,
        replicas=R,
        sweeps=sweeps,
        ms=int((time.perf_counter() - t0) * 1000),
        mean_agreement=float(np.mean([r.confidence for r in routes])) if routes else 0.0,
    )
