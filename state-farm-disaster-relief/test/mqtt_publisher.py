"""MQTT publisher for real-time catastrophe test data streaming.

Publishes a continuous stream of emergency telemetry reports to MQTT topics,
simulating a live disaster scenario with customer reports, weather updates,
and news headlines.
"""

import json
import signal
import sys
import time

import paho.mqtt.client as mqtt

from test.data_generator import generate_batch, generate_claim_report
from test.mqtt_config import (
    MQTT_BROKER_HOST,
    MQTT_BROKER_PORT,
    MQTT_KEEPALIVE,
    PUBLISH_INTERVAL_SECONDS,
    TOPIC_CLAIMS,
    TOPIC_WEATHER,
    TOPIC_NEWS,
)

running = True


def signal_handler(signum, frame):
    """Handle Ctrl+C gracefully."""

    global running
    print("\n[Publisher] Shutting down...")
    running = False


def on_connect(client, userdata, flags, reason_code, properties=None):
    """Callback when connected to MQTT broker."""

    if reason_code == 0:
        print(f"[Publisher] Connected to MQTT broker at {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
    else:
        print(f"[Publisher] Failed to connect, reason code: {reason_code}")


def on_publish(client, userdata, mid, reason_code=None, properties=None):
    """Callback when a message is published."""

    pass


def create_publisher() -> mqtt.Client:
    """Create and configure the MQTT publisher client."""

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_publish = on_publish
    client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_KEEPALIVE)
    client.loop_start()
    return client


def publish_claim(client: mqtt.Client, report: dict):
    """Publish a single claim report to the claims topic."""

    payload = json.dumps(report, indent=2)
    client.publish(TOPIC_CLAIMS, payload)
    print(f"[Publisher] Claim {report['report_id']}: {report['customer']['customer_name']} "
          f"at {report['location']['city']}, {report['location']['state']} "
          f"- {report['damage']['damage_type']} (severity {report['damage']['severity']})")


def publish_weather(client: mqtt.Client, weather: dict, location: dict):
    """Publish weather update to the weather topic."""

    payload = json.dumps({"weather": weather, "location": location, "timestamp": report_timestamp()}, indent=2)
    client.publish(TOPIC_WEATHER, payload)
    print(f"[Publisher] Weather: {weather['condition']} at {location['city']}, "
          f"wind {weather['wind_mph']}mph, precip {weather['precip_in']}in")


def publish_news(client: mqtt.Client, headline: str):
    """Publish news headline to the news topic."""

    payload = json.dumps({"headline": headline, "timestamp": report_timestamp()}, indent=2)
    client.publish(TOPIC_NEWS, payload)
    print(f"[Publisher] News: {headline}")


def report_timestamp() -> str:
    """Return current UTC timestamp."""

    from datetime import datetime
    return datetime.utcnow().isoformat() + "Z"


def main():
    """Run the MQTT publisher in a loop, streaming test data."""

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print("[Publisher] Starting catastrophe telemetry publisher...")
    print(f"[Publisher] Broker: {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
    print(f"[Publisher] Interval: {PUBLISH_INTERVAL_SECONDS}s")
    print("[Publisher] Press Ctrl+C to stop\n")

    client = create_publisher()

    # Wait for connection
    time.sleep(2)

    counter = 0
    try:
        while running:
            # Generate and publish a claim report
            report = generate_claim_report()
            publish_claim(client, report)
            counter += 1

            # Occasionally publish weather and news updates
            if counter % 3 == 0:
                location = report["location"]
                publish_weather(client, report["weather"], location)

            if counter % 5 == 0:
                publish_news(client, report["news_headline"])

            time.sleep(PUBLISH_INTERVAL_SECONDS)

    except Exception as exc:
        print(f"[Publisher] Error: {exc}")
    finally:
        client.loop_stop()
        client.disconnect()
        print(f"[Publisher] Disconnected. Published {counter} reports.")


if __name__ == "__main__":
    main()
