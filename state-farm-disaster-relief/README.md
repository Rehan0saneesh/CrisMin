# CrisMin — State Farm Catastrophe Response & Optimization Platform

Production-grade full-stack platform for disaster relief logistics.

## Architecture

- **Backend:** FastAPI, Python 3.11, SQLAlchemy, PostgreSQL + PostGIS
- **AI Ingestion:** NVIDIA Nemotron API for structured entity extraction
- **Optimization:** QUBO Hamiltonian compiler + simulated annealing solver
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Leaflet maps
- **Cache/Queue:** Redis (optional Celery integration)
- **Containerization:** Docker Compose

## Directory Structure

```
state-farm-disaster-relief/
  backend/
    app/
      main.py          # FastAPI app and API v1 routes
      config.py        # Pydantic settings
      database.py      # SQLAlchemy engine and session
      models.py        # Pydantic request/response models
      normalizer.py    # Nemotron normalization mock
      qubo.py          # QUBO compilation + simulated annealing
      services/
        nemotron_client.py   # NVIDIA Nemotron API client
        ingestion_service.py # Telemetry ingestion orchestration
        geocoding_service.py # Location resolution to coordinates
    requirements.txt
    Dockerfile
  database/
    init.sql           # PostgreSQL + PostGIS schema
  frontend/
    # Next.js application
  docker-compose.yml
  .env.example
  README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/v1/telemetry/ingest` | Ingest and normalize raw reports |
| POST | `/api/v1/optimize/run` | Compile QUBO and solve deployment |
| GET | `/api/v1/deployments/status` | Real-time deployment status |

## Run with Docker Compose

1. Copy the environment file:

```
cp .env.example .env
# Edit .env and add your NEMOTRON_API_KEY
```

2. Start all services:

```
docker compose up --build
```

3. Access the API docs:

```
http://localhost:8000/docs
```

4. Access the frontend:

```
http://localhost:3000
```

## Run Backend Locally

1. Create a virtual environment:

```
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start PostgreSQL with PostGIS (via Docker):

```
docker compose up postgres redis
```

3. Start the API:

```
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Example Request

POST `/api/v1/optimize/run`

```json
{
  "reports": [
    "Roof is completely torn off, water is entering living areas",
    "Minor shingle damage on the garage",
    "Total loss, severe structural collapse"
  ],
  "available_units": 2,
  "iterations": 2000
}
```

## Terminal UI (TUI)

A terminal-based dashboard is available under `tui/`. It runs entirely in a
terminal window using the Textual framework.

### Run the TUI

1. Create a virtual environment:

```
cd tui
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start the backend (required for API calls):

```
cd ../backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

3. Launch the TUI:

```
cd ../tui
source .venv/bin/activate
python app.py
```

### TUI Features

| Panel | Description |
|-------|-------------|
| Storm Radar | ASCII map with hurricane cone and claim/unit pins |
| KPI Cards | Total claims, deployed units, pending units, avg response |
| Red Alert | Active weather warnings widget |
| Claims Feed | Scrollable table with severity bars |
| Fleet Cards | CRU status (Deployed / En Route / Idle) |
| Resource Allocation | Efficiency ring + deployed vs requested bars |
| Dispatch Log | Live audit trail with auto-updates |
| Input Row | Ingest telemetry, run optimization, refresh |

## Build Procedure Reference

See `backend/temp.txt` for the full ASD-STE100 controlled build procedure.
