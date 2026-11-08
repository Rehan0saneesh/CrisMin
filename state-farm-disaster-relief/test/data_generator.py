"""Real-time catastrophe telemetry data generator.

Generates a live stream of realistic emergency reports including customer
information, affected area details, weather conditions, and news reports.
Designed to be published via MQTT to simulate a real disaster scenario.
"""

import random
import uuid
from datetime import datetime
from typing import Any, Dict, List

# Realistic Gulf Coast locations for disaster simulation
LOCATIONS: List[Dict[str, Any]] = [
    {"city": "Mobile", "state": "AL", "lat": 30.6944, "lng": -88.0431, "zone": "Gulf Coast"},
    {"city": "Gulfport", "state": "MS", "lat": 30.3674, "lng": -89.0928, "zone": "Gulf Coast"},
    {"city": "Pensacola", "state": "FL", "lat": 30.4213, "lng": -87.2169, "zone": "Gulf Coast"},
    {"city": "Biloxi", "state": "MS", "lat": 30.3960, "lng": -88.8853, "zone": "Gulf Coast"},
    {"city": "New Orleans", "state": "LA", "lat": 29.9511, "lng": -90.0715, "zone": "Mississippi Delta"},
    {"city": "Baton Rouge", "state": "LA", "lat": 30.4515, "lng": -91.1871, "zone": "Mississippi Delta"},
    {"city": "Lafayette", "state": "LA", "lat": 30.2241, "lng": -92.0198, "zone": "South Louisiana"},
    {"city": "Lake Charles", "state": "LA", "lat": 30.2266, "lng": -93.2174, "zone": "South Louisiana"},
]

# Customer first and last names for realistic reports
FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael",
    "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan",
    "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
]

# Damage types mapped to severity-relevant report text
DAMAGE_SCENARIOS = [
    {
        "damage_type": "Roof Damage",
        "severity": 6,
        "report_templates": [
            "Roof shingles torn off at {location}, water entering attic",
            "Partial roof collapse at {location}, ceiling damaged",
            "Missing shingles and roof leaks reported at {location}",
        ],
    },
    {
        "damage_type": "Water Intrusion",
        "severity": 7,
        "report_templates": [
            "Flooding in basement at {location}, water rising rapidly",
            "Water intrusion through windows at {location}, living room affected",
            "Storm surge water entering ground floor at {location}",
        ],
    },
    {
        "damage_type": "Structural Collapse",
        "severity": 10,
        "report_templates": [
            "Total loss, severe structural collapse at {location}",
            "Building partially collapsed at {location}, unsafe to enter",
            "Roof and walls collapsed at {location}, complete destruction",
        ],
    },
    {
        "damage_type": "Downed Power Lines",
        "severity": 8,
        "report_templates": [
            "Downed power lines blocking road at {location}, hazard present",
            "Power pole snapped, live wires on ground at {location}",
            "Electrical hazard from downed lines at {location}",
        ],
    },
    {
        "damage_type": "Flooding",
        "severity": 8,
        "report_templates": [
            "Severe flooding at {location}, streets underwater",
            "Flash flood waters entering homes at {location}",
            "River overflow flooding neighborhood at {location}",
        ],
    },
    {
        "damage_type": "Shingle Loss",
        "severity": 4,
        "report_templates": [
            "Minor shingle loss at {location}, no structural damage",
            "A few shingles missing from roof at {location}",
            "Superficial roof damage at {location}",
        ],
    },
]

WEATHER_CONDITIONS = [
    {"condition": "Severe Thunderstorm", "wind_mph": 45, "precip_in": 0.5},
    {"condition": "Hurricane", "wind_mph": 110, "precip_in": 3.0},
    {"condition": "Tornado", "wind_mph": 140, "precip_in": 1.5},
    {"condition": "Flash Flood", "wind_mph": 25, "precip_in": 4.0},
    {"condition": "High Winds", "wind_mph": 60, "precip_in": 0.2},
]

NEWS_HEADLINES = [
    "State of emergency declared for Gulf Coast counties",
    "Hurricane watch upgraded to warning for coastal areas",
    "Evacuation orders issued for low-lying neighborhoods",
    "National Guard deployed to assist with rescue operations",
    "Power outages affect over 100,000 customers across region",
    "Shelters opened at community centers for displaced residents",
    "Road closures on I-10 due to flooding and debris",
    "Search and rescue teams active in flooded areas",
]


def random_customer() -> Dict[str, str]:
    """Generate a realistic customer profile."""

    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    policy_number = f"SF-{random.randint(100000, 999999)}"
    phone = f"({random.randint(200, 999)}) {random.randint(200, 999)}-{random.randint(1000, 9999)}"

    return {
        "customer_name": f"{first} {last}",
        "policy_number": policy_number,
        "phone": phone,
        "customer_id": f"CUST-{uuid.uuid4().hex[:8].upper()}",
    }


def random_location() -> Dict[str, Any]:
    """Select a random affected location."""

    return dict(random.choice(LOCATIONS))


def random_damage_report(location: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a damage report with severity and narrative."""

    scenario = random.choice(DAMAGE_SCENARIOS)
    template = random.choice(scenario["report_templates"])
    report_text = template.format(location=f"{location['city']}, {location['state']}")

    return {
        "damage_type": scenario["damage_type"],
        "severity": scenario["severity"],
        "report_text": report_text,
    }


def random_weather() -> Dict[str, Any]:
    """Generate current weather conditions."""

    return dict(random.choice(WEATHER_CONDITIONS))


def random_news() -> str:
    """Select a relevant news headline."""

    return random.choice(NEWS_HEADLINES)


def generate_claim_report() -> Dict[str, Any]:
    """Generate one complete catastrophe telemetry report."""

    customer = random_customer()
    location = random_location()
    damage = random_damage_report(location)
    weather = random_weather()
    news = random_news()
    timestamp = datetime.utcnow().isoformat() + "Z"

    return {
        "report_id": f"RPT-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": timestamp,
        "customer": customer,
        "location": location,
        "damage": damage,
        "weather": weather,
        "news_headline": news,
        "raw_report": damage["report_text"],
        "source": "mobile_app",
    }


def generate_batch(count: int = 5) -> List[Dict[str, Any]]:
    """Generate a batch of claim reports."""

    return [generate_claim_report() for _ in range(count)]
