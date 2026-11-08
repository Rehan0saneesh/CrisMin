"""MQTT subscriber with automatic analysis and backend integration.

Subscribes to catastrophe telemetry MQTT topics, analyzes incoming reports
in real-time, and forwards them to the FastAPI backend for normalization
and QUBO optimization. Automatically triggers optimization when enough
reports accumulate.
"""

import json
import signal
import sys
import time
from collections import deque
from datetime import datetime
from typing import Deque, List

import httpx
import paho.mqtt.client as mqtt

from test.data_generator import generate_claim_report
from test.mqtt_config import (
    BACKEND_INGEST_ENDPOINT,
    BACKEND_OPTIMIZE_ENDPOINT,
    BACKEND_BASE_URL,
    BATCH_SIZE_FOR_OPTIMIZATION,
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
    MQTT_KEEPALIVE,
    TOPIC_ALL,
)

# In-memory buffer of recent reports awaiting analysis
report_buffer: Deque[dict] = deque(maxlen=100)
pending_reports: List[str] = []
analysis_count = 0

running = True


def signal_handler(signum, frame):
    """Handle Ctrl+C gracefully."""

    global running
    print("\n[Subscriber] Shutting down...")
    running = False


def on_connect(client, userdata, flags, reason_code, properties=None):
    """Callback when connected to MQTT broker."""

    if reason_code == 0:
        print(f"[Subscriber] Connected to MQTT broker at {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
        client.subscribe(TOPIC_ALL)
        print(f"[Subscriber] Subscribed to {TOPIC_ALL}")
    else:
        print(f"[Subscriber] Failed to connect, reason code: {reason_code}")


def on_message(client, userdata, msg):
    """Callback when an MQTT message is received."""

    global analysis_count
    topic = msg.topic

    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except json.JSONDecodeError:
        print(f"[Subscriber] Invalid JSON on {topic}")
        return

    timestamp = datetime.now().strftime("%H:%M:%S")

    if topic.endswith("/claims"):
        report = payload
        report_id = report.get("report_id", "UNKNOWN")
        customer = report.get("customer", {}).get("customer_name", "Unknown")
        location = report.get("location", {})
        damage = report.get("damage", {})
        severity = damage.get("severity", "?")

        print(f"[{timestamp}] CLAIM {report_id}: {customer} | "
              f"{location.get('city')}, {location.get('state')} | "
              f"{damage.get('damage_type')} | Severity {severity}")

        # Buffer the report and queue for backend ingestion
        report_buffer.append(report)
        pending_reports.append(report.get("raw_report", ""))

        # Auto-trigger optimization when batch is full
        if len(pending_reports) >= BATCH_SIZE_FOR_OPTIMIZATION:
            analysis_count += 1
            print(f"[{timestamp}] AUTO-ANALYSIS #{analysis_count}: "
                  f"Sending {len(pending_reports)} reports to backend...")
            send_to_backend(pending_reports.copy())
            pending_reports.clear()

    elif topic.endswith("/weather"):
        weather = payload.get("weather", {})
        location = payload.get("location", {})
        print(f"[{timestamp}] WEATHER: {weather.get('condition')} at "
              f"{location.get('city')}, {location.get('state')} | "
              f"Wind {weather.get('wind_mph')}mph")

    elif topic.endswith("/news"):
        headline = payload.get("headline", "")
        print(f"[{timestamp}] NEWS: {headline}")


def send_to_backend(reports: List[str]):
    """Forward a batch of reports to the backend ingestion endpoint."""

    try:
        with httpx.Client(timeout=15.0) as http_client:
            resp = http_client.post(
                BACKEND_INGEST_ENDPOINT,
                json={"reports": reports},
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"[Backend] Ingested {data.get('zones_normalized', 0)} zones, "
                      f"saved {data.get('zones_saved', 0)}")
            else:
                print(f"[Backend] Ingest failed: HTTP {resp.status_code}")
    except httpx.ConnectError:
        print(f"[Backend] Cannot connect to {BACKEND_BASE_URL}. Is the backend running?")
    except Exception as exc:
        print(f"[Backend] Ingest error: {exc}")


def run_optimization():
    """Trigger QUBO optimization on the current pending reports."""

    if not pending_reports:
        return

    try:
        with httpx.Client(timeout=30.0) as http_client:
            resp = http_client.post(
                BACKEND_OPTIMIZE_ENDPOINT,
                json={
                    "reports": pending_reports.copy(),
                    "available_units": 2,
                    "iterations": 2000,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                deployed = sum(1 for z in data.get("deployed_zones", []) if z.get("deployed"))
                total = data.get("total_nodes", 0)
                energy = data.get("best_energy", 0)
                print(f"[Optimization] Solver complete: {deployed}/{total} zones deployed, "
                      f"energy {energy:.2f}")
            else:
                print(f"[Backend] Optimization failed: HTTP {resp.status_code}")
    except Exception as exc:
        print(f"[Optimization] Error: {exc}")


def create_subscriber() -> mqtt.Client:
    """Create and configure the MQTT subscriber client."""

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_KEEPALIVE)
    client.loop_start()
    return client


def main():
    """Run the MQTT subscriber and real-time analyzer."""

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print("[Subscriber] Starting real-time catastrophe analyzer...")
    print(f"[Subscriber] Broker: {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
    print(f"[Subscriber] Backend: {BACKEND_BASE_URL}")
    print(f"[Subscriber] Optimization batch size: {BATCH_SIZE_FOR_OPTIMIZATION}")
    print("[Subscriber] Press Ctrl+C to stop\n")

    client = create_subscriber()

    try:
        while running:
            time.sleep(0.5)
    except Exception as exc:
        print(f"[Subscriber] Error: {exc}")
    finally:
        client.loop_stop()
        client.disconnect()
        print("[Subscriber] Disconnected.")


if __name__ == "__main__":
    main()
