"""Built-in simulated report feed (mirrors test/data_generator.py).

Kept inside the backend so the feed also runs in Docker, where only
backend/ is mounted.
"""

import random

PLACES = [
    "Mobile, AL", "Gulf Shores, AL", "Gulfport, MS", "Biloxi, MS", "Pascagoula, MS",
    "Pensacola, FL", "Panama City, FL", "New Orleans, LA",
]

TEMPLATES = [
    # (weight, text) — the extractor decides severity, not this table.
    (2, "Total loss, severe structural collapse at {p}"),
    (2, "Building partially collapsed at {p}, unsafe to enter"),
    (2, "911 transcript: caller trapped in attic as water rises at {p}"),
    (3, "Downed power lines blocking road at {p}, live wires on ground"),
    (4, "Severe flooding at {p}, streets underwater"),
    (3, "Storm surge water entering ground floor at {p}"),
    (5, "Roof shingles torn off at {p}, water entering attic"),
    (4, "Tree limb punched through roof at {p}, rain entering bedroom"),
    (4, "Water intrusion through windows at {p}, living room affected"),
    (4, "Minor shingle loss at {p}, no structural damage"),
    (3, "Fence down and siding scuffed at {p}, cosmetic damage only"),
]

EXTRAS = [
    "", "", "", " Policyholder elderly, requests priority.", " Two adults and a child sheltering in place.",
    " Neighbors report similar damage.", " Gas smell reported.",
]


def generate_report(rng: random.Random = random) -> str:
    weights = [w for w, _ in TEMPLATES]
    _, template = rng.choices(TEMPLATES, weights=weights, k=1)[0]
    return template.format(p=rng.choice(PLACES)) + rng.choice(EXTRAS)
