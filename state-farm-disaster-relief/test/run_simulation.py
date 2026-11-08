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

import subprocess
import sys
import time
from pathlib import Path

TEST_DIR = Path(__file__).resolve().parent


def check_mqtt_broker() -> bool:
    """Check if an MQTT broker is reachable on localhost:1883."""

    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2)
    result = sock.connect_ex(("localhost", 1883))
    sock.close()
    return result == 0


def check_backend() -> bool:
    """Check if the FastAPI backend is reachable."""

    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2)
    result = sock.connect_ex(("localhost", 8000))
    sock.close()
    return result == 0


def main():
    print("=" * 60)
    print("CrisMin Real-Time MQTT Test Simulation")
    print("=" * 60)

    # Check prerequisites
    mqtt_ok = check_mqtt_broker()
    backend_ok = check_backend()

    if not mqtt_ok:
        print("\n[WARN] MQTT broker not detected on localhost:1883")
        print("       Install and start mosquitto:  brew install mosquitto && brew services start mosquitto")
        print("       Or:  docker run -it -p 1883:1883 eclipse-mosquitto")
    else:
        print("\n[OK] MQTT broker detected on localhost:1883")

    if not backend_ok:
        print("\n[WARN] Backend not detected on localhost:8000")
        print("       Start it:  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload")
    else:
        print("[OK] Backend detected on localhost:8000")

    if not mqtt_ok or not backend_ok:
        print("\nPlease start the missing services, then re-run this script.")
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
