# MQTT Real-Time Test Simulation

This folder contains a real-time MQTT-based test data generation and
automatic analysis system for the CrisMin catastrophe response platform.

## Overview

The simulation publishes a continuous stream of emergency telemetry reports
to an MQTT broker, then consumes them in real-time, forwarding each report
to the FastAPI backend for Nemotron normalization and QUBO optimization.

## Architecture

```
┌─────────────┐     MQTT      ┌──────────────┚     HTTP      ┌─────────────┐
│  Publisher  │ ───────────> │  Subscriber  │ ────────────> │  Backend    │
│  (data gen) │  claims/     │  (analyzer)  │  ingest/opt   │  (FastAPI)  │
│             │  weather/    │              │               │             │
│             │  news/       │              │               │             │
└─────────────┘              └──────────────┘               └─────────────┘
```

## Components

| File | Purpose |
|------|---------|
| `data_generator.py` | Generates realistic catastrophe reports (customer, location, damage, weather, news) |
| `mqtt_publisher.py` | Publishes test data to MQTT topics in real-time |
| `mqtt_subscriber.py` | Subscribes, analyzes, auto-forwards to backend, triggers optimization |
| `run_simulation.py` | Orchestrates publisher + subscriber with prerequisite checks |
| `mqtt_config.py` | MQTT broker settings, topics, backend URLs |
| `requirements.txt` | Python dependencies (paho-mqtt, httpx) |

## Data Generated

Each report includes:
- **Customer**: name, policy number, phone, customer ID
- **Location**: city, state, latitude/longitude, zone
- **Damage**: type (roof, water, structural collapse, etc.), severity score, narrative text
- **Weather**: condition, wind speed, precipitation
- **News**: relevant headline
- **Metadata**: report ID, timestamp, source

## Prerequisites

1. **MQTT Broker** (localhost:1883)
   ```bash
   # macOS with Homebrew
   brew install mosquitto
   brew services start mosquitto

   # Or via Docker
   docker run -it -p 1883:1883 eclipse-mosquitto
   ```

2. **FastAPI Backend** (localhost:8000)
   ```bash
   cd ../backend
   source .venv/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Python dependencies**
   ```bash
   cd test
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

## Running

```bash
cd test
source .venv/bin/activate
python run_simulation.py
```

The subscriber will:
1. Connect to the MQTT broker and subscribe to `crismin/telemetry/#`
2. Receive claim, weather, and news messages in real-time
3. Automatically forward claim reports to `/api/v1/telemetry/ingest`
4. Trigger QUBO optimization at `/api/v1/optimize/run` every 5 reports
5. Log all activity with timestamps

Press Ctrl+C to stop both publisher and subscriber.

## Customization

Edit `test/mqtt_config.py` to adjust:
- `PUBLISH_INTERVAL_SECONDS` — how often new reports are published
- `BATCH_SIZE_FOR_OPTIMIZATION` — how many reports before triggering optimization
- `MQTT_BROKER_HOST` / `MQTT_BROKER_PORT` — broker connection details
- `BACKEND_BASE_URL` — FastAPI backend URL
