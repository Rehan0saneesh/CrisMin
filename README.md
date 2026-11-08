# CrisMin — State Farm Catastrophe Response & Optimization Platform

CrisMin (Crisis Minimum) is a production-grade, full-stack enterprise platform
for disaster relief logistics. It ingests unstructured catastrophe telemetry
(social media reports, weather feeds, 911 dispatch logs, and policyholder loss
narratives), normalizes them using NVIDIA Nemotron, and optimizes emergency
resource deployments (adjusters, mobile units, and supply trucks) via a
Hamiltonian/QUBO optimization engine running on GPU-accelerated classical
hardware.

## Repository Structure

```
CrisMin/
├── SKILL.md                      # OpenCode skill instructions (ASD-STE100)
├── LICENSE                       # MIT License
├── README.md                     # Project overview
├── .gitignore                    # Git ignore rules
├── state-farm-disaster-relief/   # Full application source
│   ├── backend/                  # FastAPI + Python backend
│   │   ├── app/
│   │   │   ├── main.py           # FastAPI app + API v1 routes
│   │   │   ├── config.py         # Pydantic settings
│   │   │   ├── database.py       # SQLAlchemy engine/session
│   │   │   ├── models.py         # Pydantic request/response models
│   │   │   ├── normalizer.py     # Nemotron normalization mock
│   │   │   ├── qubo.py           # QUBO compiler + simulated annealing
│   │   │   └── services/
│   │   │       ├── nemotron_client.py
│   │   │       ├── ingestion_service.py
│   │   │       └── geocoding_service.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── database/
│   │   └── init.sql              # PostgreSQL + PostGIS schema
│   ├── docker-compose.yml        # Multi-container orchestration
│   ├── frontend/                 # Next.js 14 dashboard (web UI)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   └── components/
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── tui/                      # Terminal UI (Textual-based)
│   │   ├── app.py                # Terminal dashboard
│   │   └── requirements.txt
│   └── README.md                 # App-specific setup
```

## Technical Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, Python 3.11, SQLAlchemy, NumPy |
| AI Ingestion | NVIDIA Nemotron API (structured NER/JSON extraction) |
| Optimization | QUBO Hamiltonian compiler + simulated annealing (GPU-ready via cuQuantum/PyTorch) |
| Database | PostgreSQL + PostGIS (spatial disaster zone mapping) |
| Cache/Queue | Redis (Celery-ready for production) |
| Frontend (Web) | Next.js 14, TypeScript, Tailwind CSS, Leaflet |
| Frontend (Terminal) | Python Textual TUI |
| Containerization | Docker + Docker Compose |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/v1/telemetry/ingest` | Ingest and normalize raw reports |
| POST | `/api/v1/optimize/run` | Compile QUBO and solve deployment |
| GET | `/api/v1/deployments/status` | Real-time deployment status |

## Quick Start

### Docker Compose (recommended)

```bash
cd state-farm-disaster-relief
cp .env.example .env   # add your NEMOTRON_API_KEY
docker compose up --build
```

- API docs: `http://localhost:8000/docs`
- Web dashboard: `http://localhost:3000`

### Terminal UI

```bash
cd state-farm-disaster-relief/tui
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Backend only

```bash
cd state-farm-disaster-relief/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Architecture

The pipeline operates across four stages:

1. **Ingestion & Normalization** — Raw emergency telemetry is parsed into normalized JSON tensors with demand weights via a NVIDIA Nemotron mock layer.
2. **Hamiltonian Formulation** — Normalized tensors are compiled into a QUBO matrix `Q` where diagonal terms encode priority weights (negative for minimization) and off-diagonal terms encode fleet constraints.
3. **Execution** — The QUBO is solved via simulated annealing to produce the optimal binary deployment vector `x ∈ {0, 1}^n`.
4. **Deployment** — Resources are assigned to high-severity zones based on the ground state configuration.

## License

[MIT](LICENSE)
