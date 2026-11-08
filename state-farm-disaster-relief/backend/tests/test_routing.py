"""Regression tests for the routing QUBO and Nemotron parsing.

Run from backend/:  python -m pytest -q tests
"""

import itertools

import numpy as np
import pytest

from app.routing_qubo import BETA_PER_MIN, TRAVEL_CAP_MIN, DEMAND_FOR_TYPE, ClaimIn, UnitIn, haversine_km, solve_routing
from app.services.geocoding_service import GAZETTEER, canonical_place
from app.services.nemotron_client import _coerce, _parse_json_array, rule_extract


def at(city, dlat=0.0, dlng=0.0):
    lat, lng = GAZETTEER[city.lower()]
    return lat + dlat, lng + dlng


def nominal_cost(u: UnitIn, c: ClaimIn) -> float:
    eta = haversine_km(u.lat, u.lng, c.lat, c.lng) * 1.25 / 70 * 60
    aff = (-1 if DEMAND_FOR_TYPE[u.type] == c.demand else 0) + (1.5 if u.type == "Command Vehicle" and c.severity < 5 else 0)
    urg = c.severity * (1 + 0.5 * min(c.wait_min / 90, 1)) * (1.25 if c.people_at_risk else 1) + 0.02 * min(c.wait_min, 120)
    return -urg + BETA_PER_MIN * min(eta, TRAVEL_CAP_MIN) + aff


UNITS = [
    UnitIn("CRU-01", 30.81, -88.09, "Command Vehicle"),
    UnitIn("ADJ-01", 30.54, -87.27, "Adjuster Team"),
    UnitIn("SUP-01", 30.52, -88.94, "Supply Vehicle"),
]
CLAIMS = [
    ClaimIn("collapse", 30.42, -87.22, 10, 0.9, 10, "command", True, "Structural Collapse"),
    ClaimIn("flood", 30.37, -89.09, 8, 0.85, 5, "supply", False, "Flooding"),
    ClaimIn("roof", 30.69, -88.04, 6, 0.8, 30, "adjuster", False, "Roof Damage"),
    ClaimIn("shingle", 30.40, -88.89, 4, 0.8, 2, "adjuster", False, "Shingle Loss"),
]


def test_plan_is_a_valid_assignment():
    r = solve_routing(UNITS, CLAIMS, rng=np.random.default_rng(1))
    assert len({x.unit_id for x in r.routes}) == len(r.routes)
    assert len({x.claim_id for x in r.routes}) == len(r.routes)


def test_annealer_finds_brute_force_optimum():
    best, best_plan = 0.0, ()
    for k in range(len(UNITS) + 1):
        for us in itertools.permutations(range(len(UNITS)), k):
            for cs in itertools.permutations(range(len(CLAIMS)), k):
                e = sum(nominal_cost(UNITS[a], CLAIMS[b]) for a, b in zip(us, cs))
                if e < best:
                    best, best_plan = e, tuple(sorted((UNITS[a].id, CLAIMS[b].id) for a, b in zip(us, cs)))
    r = solve_routing(UNITS, CLAIMS, rng=np.random.default_rng(2))
    assert tuple(sorted((x.unit_id, x.claim_id) for x in r.routes)) == best_plan
    assert r.energy == pytest.approx(best, abs=1e-2)


def test_clear_cut_route_is_confident():
    u = [UnitIn("A", 30.5, -88.5, "Adjuster Team")]
    c = [ClaimIn("x", 30.6, -88.5, 10, 0.95, 0, "adjuster", True, "Structural Collapse"),
         ClaimIn("y", 30.4, -88.5, 3, 0.95, 0, "adjuster", False, "Shingle Loss")]
    r = solve_routing(u, c, rng=np.random.default_rng(3))
    assert r.routes[0].claim_id == "x" and r.routes[0].confidence >= 0.95


def test_interchangeable_claims_reach_threshold():
    u = [UnitIn("ADJ", 30.75, -88.0, "Adjuster Team")]
    c = [ClaimIn(f"roof{i}", 30.69 + 0.01 * i, -88.04, 6, 0.86, w, "adjuster", False, "Roof Damage") for i, w in enumerate([30, 26, 22])]
    confs = [solve_routing(u, c, rng=np.random.default_rng(k)).routes[0].confidence for k in range(5)]
    assert np.mean(confs) >= 0.9


def test_low_trust_extraction_lowers_confidence():
    u = [UnitIn("ADJ", 30.75, -88.0, "Adjuster Team")]
    hi = [ClaimIn("a", 30.7, -88.0, 6, 0.9, 10, "adjuster", False, "Roof Damage"), ClaimIn("b", 30.7, -88.05, 7, 0.9, 10, "adjuster", False, "Water Intrusion")]
    lo = [ClaimIn(x.id, x.lat, x.lng, x.severity, 0.5, x.wait_min, x.demand, x.people_at_risk, x.category) for x in hi]
    c_hi = solve_routing(u, hi, rng=np.random.default_rng(5), min_confidence=0).routes[0].confidence
    c_lo = solve_routing(u, lo, rng=np.random.default_rng(5), min_confidence=0).routes[0].confidence
    assert c_lo < c_hi


def test_long_waiting_minor_claim_does_not_outbid_critical():
    u = [UnitIn("CRU-01", *at("Mobile, AL", 0.12, -0.05), "Command Vehicle"), UnitIn("ADJ-01", *at("Pensacola, FL", 0.12, -0.05), "Adjuster Team")]
    c = [ClaimIn("crit", *at("Pensacola, FL"), 9.5, 0.86, 1350, "command", False, "Roof Damage"),
         ClaimIn("minor", *at("Panama City, FL"), 3.5, 0.86, 4680, "adjuster", False, "Roof Damage")]
    r = solve_routing(u, c, rng=np.random.default_rng(1))
    crit = next(x for x in r.routes if x.claim_id == "crit")
    # Either unit is a defensible choice; what must be certain is that the
    # critical claim is served (the engine commits critical claims on coverage).
    assert crit.unit_id == "ADJ-01" and crit.coverage >= 0.9 and crit.confidence > 0.5


def test_twin_units_stable_with_preference():
    u = [UnitIn("A", 30.52, -88.94, "Adjuster Team"), UnitIn("B", 30.52, -88.94, "Adjuster Team")]
    c = [ClaimIn("roof", 30.40, -88.89, 6, 0.86, 20, "adjuster", False, "Roof Damage"), ClaimIn("water", 30.37, -89.09, 6, 0.86, 15, "adjuster", False, "Water Intrusion")]
    prev, plans = None, set()
    for k in range(6):
        r = solve_routing(u, c, rng=np.random.default_rng(100 + k), prefer=prev)
        assert all(x.confidence >= 0.9 for x in r.routes)
        prev = {(x.unit_id, x.claim_id) for x in r.routes}
        plans.add(tuple(sorted(prev)))
    assert len(plans) == 1


def test_empty_inputs():
    assert solve_routing([], CLAIMS).routes == []
    assert solve_routing(UNITS, []).routes == []


# ---- Nemotron parsing / fallback ------------------------------------------

def test_parse_tolerates_think_blocks_and_fences():
    rows = _parse_json_array('<think>reasoning</think>\n```json\n[{"id": "a", "severity": 9}]\n```')
    assert rows == [{"id": "a", "severity": 9}]


def test_coerce_clamps_and_validates():
    e = _coerce({"severity": 14, "damage_type": "Alien attack", "location": "pensacola, fl", "confidence": 3}, "collapse at Pensacola, FL", "m")
    assert e.severity == 10 and e.damage_type in ("Structural Collapse", "Other") and e.location == "Pensacola, FL" and e.confidence == 1.0


@pytest.mark.parametrize("text,sev,place", [
    ("Total loss, severe structural collapse at Mobile, AL", 10, "Mobile, AL"),
    ("Downed power lines blocking road at Lake Charles, LA", 8, "Lake Charles, LA"),
    ("Minor shingle loss at Biloxi, MS, no structural damage", 4, "Biloxi, MS"),
])
def test_rule_fallback(text, sev, place):
    e = rule_extract(text)
    assert e.severity == sev and e.location == place and e.source == "rules"


def test_gazetteer_city_only_match():
    assert canonical_place("storm surge reported near gulfport") == "Gulfport, MS"


def test_far_idle_unit_still_covers_critical_claim_but_not_minor():
    u = [UnitIn("ADJ-02", *at("New Orleans, LA", 0.12, -0.05), "Adjuster Team")]
    crit = [ClaimIn("crit", *at("Panama City, FL"), 9.5, 0.86, 0, "command", True, "Structural Collapse")]
    minor = [ClaimIn("minor", *at("Panama City, FL"), 3.5, 0.86, 0, "adjuster", False, "Shingle Loss")]
    r = solve_routing(u, crit, rng=np.random.default_rng(0))
    assert r.routes and r.routes[0].claim_id == "crit" and r.routes[0].coverage >= 0.9
    assert solve_routing(u, minor, rng=np.random.default_rng(0)).routes == []
