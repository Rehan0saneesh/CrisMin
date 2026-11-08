"""MQTT broker configuration for real-time test data streaming."""

import os

MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_KEEPALIVE = int(os.getenv("MQTT_KEEPALIVE", "60"))

# Topics for different telemetry streams
TOPIC_CLAIMS = "crismin/telemetry/claims"
TOPIC_WEATHER = "crismin/telemetry/weather"
TOPIC_NEWS = "crismin/telemetry/news"
TOPIC_DISPATCH = "crismin/telemetry/dispatch"
TOPIC_ALL = "crismin/telemetry/#"

# Backend API
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
BACKEND_INGEST_ENDPOINT = f"{BACKEND_BASE_URL}/api/v1/telemetry/ingest"
BACKEND_OPTIMIZE_ENDPOINT = f"{BACKEND_BASE_URL}/api/v1/optimize/run"

# Simulation settings
PUBLISH_INTERVAL_SECONDS = float(os.getenv("PUBLISH_INTERVAL_SECONDS", "3.0"))
BATCH_SIZE_FOR_OPTIMIZATION = int(os.getenv("BATCH_SIZE_FOR_OPTIMIZATION", "5"))
