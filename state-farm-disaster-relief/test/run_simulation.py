#!/usr/bin/env python3
"""Test runner for real-time MQTT catastrophe telemetry simulation.

This script starts both the MQTT publisher and subscriber to simulate a
live disaster scenario. Reports flow: publisher -> MQTT broker -> subscriber
-> backend (FastAPI) for normalization and QUBO optimization.

Prerequisites:
  1. MQTT broker running (e.g., mosquitto on localhost:1883)
  2. FastAPI backend running on localhost:8000

Usage:
  python test/run_simulation.py
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

TEST_DIR = Path(__file__).resolve().parent


def check_port(host: str, port: int, timeout: float = 2.0) -> bool:
    """Check if a TCP port is reachable, trying IPv4 then IPv6."""

    import socket
    for family in (socket.AF_INET, socket.AF_INET6):
        try:
            sock = socket.socket(family, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()
            if result == 0:
                return True
        except OSError:
            continue
    return False


def check_mqtt_broker() -> bool:
    """Check if an MQTT broker is reachable on port 1883."""

    import os
    host = os.getenv("MQTT_BROKER_HOST", "127.0.0.1")
    return check_port(host, 1883)


def check_backend() -> bool:
    """Check if the FastAPI backend is reachable."""

    import os
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    return check_port(host, 8000)


def main():
    parser = argparse.ArgumentParser(
        description="CrisMin Real-Time MQTT Test Simulation"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip prerequisite checks and start simulation anyway",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("CrisMin Real-Time MQTT Test Simulation")
    print("=" * 60)

    # Check prerequisites
    mqtt_ok = check_mqtt_broker()
    backend_ok = check_backend()

    mqtt_host = __import__("os").getenv("MQTT_BROKER_HOST", "127.0.0.1")
    backend_host = __import__("os").getenv("BACKEND_HOST", "127.0.0.1")

    if not mqtt_ok:
        print(f"\n[WARN] MQTT broker not detected on {mqtt_host}:1883")
        print("       Start mosquitto:  mosquitto -v")
        print("       Or via Docker:    docker run -it -p 1883:1883 eclipse-mosquitto")
    else:
        print(f"\n[OK] MQTT broker detected on {mqtt_host}:1883")

    if not backend_ok:
        print(f"\n[WARN] Backend not detected on {backend_host}:8000")
        print("       Start it:  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload")
    else:
        print(f"[OK] Backend detected on {backend_host}:8000")

    if not mqtt_ok or not backend_ok:
        if args.force:
            print("\n[WARN] Prerequisites missing but --force set; starting anyway.\n")
        else:
            print("\nPlease start the missing services, then re-run this script.")
            print("Use --force to skip checks and start anyway.")
            sys.exit(1)

    print("\nStarting subscriber...")
    subscriber = subprocess.Popen(
        [sys.executable, str(TEST_DIR / "mqtt_subscriber.py")],
        cwd=str(TEST_DIR.parent),
    )

    time.sleep(2)  # Let subscriber connect first

    print("Starting publisher...")
    publisher = subprocess.Popen(
        [sys.executable, str(TEST_DIR / "mqtt_publisher.py")],
        cwd=str(TEST_DIR.parent),
    )

    print("\nSimulation running. Press Ctrl+C to stop all.\n")

    try:
        publisher.wait()
        subscriber.wait()
    except KeyboardInterrupt:
        print("\nStopping simulation...")
        publisher.terminate()
        subscriber.terminate()
        publisher.wait()
        subscriber.wait()
        print("Simulation stopped.")


if __name__ == "__main__":
    main()
