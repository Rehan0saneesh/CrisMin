# CrisMin — Handoff Document

This document is a comprehensive handoff for the CrisMin (Crisis Minimum) State Farm Catastrophe Response & Optimization Platform. It is intended for another agent or developer who will continue work on this repository, with particular focus on improving the frontend dashboard which currently "does not look good."

## Table of Contents

1. [Project Overview](#project-overview)
2. [Repository Structure](#repository-structure)
3. [Current Git State](#current-git-state)
4. [Architecture Summary](#architecture-summary)
5. [Backend — Status & Details](#backend-status--details)
6. [Frontend — Status & Known Issues](#frontend-status--known-issues)
7. [Terminal UI (TUI) — Status & Details](#terminal-ui-tui-status--details)
8. [MQTT Test Simulation — Status & Details](#mqtt-test-simulation-status--details)
9. [Database Schema](#database-schema)
10. [API Endpoints](#api-endpoints)
11. [How to Run Everything](#how-to-run-everything)
12. [Known Bugs & Issues](#known-bugs--issues)
13. [Frontend-Specific Problems & Fixes Needed](#frontend-specific-problems--fixes-needed)
14. [Recommended Next Steps for Next Agent](#recommended-next-steps-for-next-agent)
15. [File-by-File Inventory](#file-by-file-inventory)
16. [Environment Variables](#environment-variables)
17. [Dependencies](#dependencies)

---

## Project Overview

**Name:** CrisMin (Crisis Minimum)  
**Purpose:** State Farm Catastrophe Response & Optimization Platform  
**Mission:** Ingest unstructured catastrophe telemetry (911 transcripts, policyholder loss reports, weather feeds, news), normalize via NVIDIA Nemotron, optimize emergency resource deployment via Hamiltonian/QUBO mathematics, and dispatch via a command-center dashboard.

**Target Users:** State Farm disaster response managers, claims adjusters, Catastrophe Response Unit (CRU) coordinators.

**Design Philosophy (Frontend):** Enterprise B2B dark-mode command center. No consumer "vibe" styling. No neon gradients. No excessive rounded corners. Functional, high-density, professional GIS/dispatch aesthetic.

---

## Repository Structure

```
CrisMan/                          (git root)
├── .git/
├── .gitignore
├── LICENSE                       (MIT License)
├── README.md                     (top-level project overview)
├── SKILL.md                      (OpenCode skill instructions — ASD-STE100 Simplified Technical English)
├── HANDOFF.md                    (this file)
└── state-farm-disaster-relief/   (application source)
    ├── backend/
    │   ├── .venv/                (Python virtual env — NOT committed)
    │   ├── app/
    │   │   ├── __init__.py
    │   │   ├── config.py         (Pydantic settings)
    │   │   ├── database.py       (SQLAlchemy engine/session)
    │   │   ├── main.py           (FastAPI app + routes)
    │   │   ├── models.py         (Pydantic request/response models)
    │   │   ├── normalizer.py     (Nemotron normalization mock)
    │   │   ├── qubo.py           (QUBO compiler + simulated annealing solver)
    │   │   └── services/
    │   │       ├── __init__.py
    │   │       ├── ingestion_service.py
    │   │       ├── nemotron_client.py
    │   │       └── geocoding_service.py
    │   ├── Dockerfile
    │   └── requirements.txt
    ├── database/
    │   └── init.sql              (PostgreSQL + PostGIS schema)
    ├── docker-compose.yml        (multi-container orchestration)
    ├── frontend/
    │   ├── .next/                (build output — NOT committed)
    │   ├── node_modules/         (NOT committed)
    │   ├── package-lock.json     (NOT committed)
    │   ├── .DS_Store             (NOT committed)
    │   ├── Dockerfile
    │   ├── next.config.js
    │   ├── package.json
    │   ├── postcss.config.js
    │   ├── tailwind.config.js
    │   ├── tsconfig.json
    │   ├── next-env.d.ts
    │   ├── src/
    │   │   ├── app/
    │   │   │   ├── globals.css   (design tokens — CSS variables for colors)
    │   │   │   ├── layout.tsx    (root layout with Inter font)
    │   │   │   └── page.tsx      (dynamic import wrapper, ssr: false)
    │   │   └── components/
    │   │       ├── TopNav.tsx        (persistent header)
    │   │       ├── Sidebar.tsx       (fixed 320px left pane — units)
    │   │       ├── MapComponent.tsx  (Leaflet storm radar map)
    │   │       ├── ClaimsTable.tsx   (high-density claims feed)
    │   │       ├── KPICards.tsx      (top metric cards)
    │   │       ├── ResourceAllocation.tsx (efficiency bars)
    │   │       ├── FleetCards.tsx    (CRU status cards)
    │   │       ├── DispatchLog.tsx   (terminal audit log)
    │   │       └── RedAlertWidget.tsx (bottom-right weather alerts)
    │   └── lib/
    │       └── api.ts              (HTTP client for backend)
    ├── tui/
    │   ├── .venv/                (Python virtual env — NOT committed)
    │   ├── __init__.py
    │   ├── app.py                (Textual-based terminal dashboard)
    │   └── requirements.txt
    └── test/
        ├── __init__.py
        ├── requirements.txt      (paho-mqtt, httpx, python-dotenv)
        ├── README.md             (MQTT simulation setup)
        ├── mqtt_config.py        (broker settings, topics, backend URLs)
        ├── data_generator.py     (realistic catastrophe report generator)
        ├── mqtt_publisher.py     (publishes live stream to MQTT)
        ├── mqtt_subscriber.py    (subscribes, analyzes, forwards to backend)
        └── run_simulation.py     (orchestrates publisher + subscriber)
```

---

## Current Git State

**Branch:** `main`  
**Working tree:** Clean  
**Remote:** None configured yet (`origin` not set)  
**Commit count:** 9 commits

Commit history (newest first):
```
28e65f3 Fix /telemetry/ingest 422 validation error
6539f90 Fix test module import path for test.* imports
b6edf27 Harden MQTT simulation prerequisite checks
1c54048 Enterprise B2B dark mode frontend refactor
aeabb01 Add MQTT real-time test simulation
25e461a Add /v1/models endpoint for OpenAI-compatible Nemotron client integration
7b2b33c Add /health endpoint for load balancer and monitoring checks
72f5ca9 Fix TUI KPICard classes kwarg forwarding
db07fda Initial commit: CrisMin State Farm Catastrophe Response Platform
```

The branch is ahead of `origin/main` by 8 commits (no remote configured).

---

## Architecture Summary

The pipeline operates across four sequential stages:

1. **Ingestion & Normalization** — Raw emergency telemetry → NVIDIA Nemotron mock → structured JSON tensors with demand weights (severity scores).
2. **Hamiltonian Formulation** — Normalized tensors → QUBO matrix `Q` where diagonal = negative priority weights, off-diagonal = fleet constraints with penalty `lambda`.
3. **Execution** — QUBO solved via simulated annealing → optimal binary deployment vector `x ∈ {0,1}^n`.
4. **Deployment** — Resources assigned to high-severity zones first based on ground state.

**Backend:** FastAPI + Python 3.11 + SQLAlchemy + NumPy  
**AI Ingestion:** NVIDIA Nemotron API (mocked with rule-based fallback)  
**Optimization:** QUBO Hamiltonian + simulated annealing (GPU-ready via cuQuantum/PyTorch path documented but not implemented)  
**Database:** PostgreSQL + PostGIS (spatial claims, response units, optimization logs)  
**Frontend:** Next.js 14 + TypeScript + Tailwind CSS + Leaflet  
**Terminal UI:** Python Textual  
**Test/MQTT:** paho-mqtt + httpx

---

## Backend — Status & Details

**Location:** `state-farm-disaster-relief/backend/`

### What Works
- FastAPI app instantiates and all routes register correctly.
- `GET /` — health check → `{"status": "ok", ...}`
- `GET /health` — health check (same as `/`)
- `GET /v1/models` — OpenAI-compatible model list → returns Nemotron model
- `POST /api/v1/telemetry/ingest` — accepts `{"reports": [...]}` JSON body → normalizes via mock Nemotron → returns `TelemetryIngestResponse`
- `POST /api/v1/optimize/run` — compiles QUBO matrix, runs simulated annealing → returns `OptimizationResult` with deployment vector
- `GET /api/v1/deployments/status` — placeholder, returns zeros/empty
- Database table creation is wrapped in try/except so app starts even without PostgreSQL
- CORS middleware enabled (allows all origins)

### Known Issues
- Database connection is attempted at import time via `Base.metadata.create_all(bind=engine)` inside a `@app.on_event("startup")` handler wrapped in try/except. If PostgreSQL is not running, tables are NOT created automatically — they must be created via `database/init.sql` in Docker.
- `IngestionService` uses `SessionLocal()` but does not actually write to any SQLAlchemy ORM model — it just appends claim IDs to a list and returns. The database persistence layer is not wired up.
- `NemotronClient` is implemented but `IngestionService` uses the mock `StateFarmCatastropheNormalizer` instead of calling the real Nemotron API. The real client exists but is unused.
- `geocoding_service.py` is a stub — returns `(None, None)` for all inputs. No real geocoding provider is integrated.
- The QUBO solver is pure NumPy simulated annealing, not GPU-accelerated. For large node counts (>5,000), it will be slow. cuQuantum/PyTorch integration is documented but not implemented.

### Files
- `app/main.py` — FastAPI app, route definitions, lifespan/startup
- `app/config.py` — Pydantic `Settings` (DATABASE_URL, REDIS_URL, NEMOTRON_API_KEY, etc.)
- `app/database.py` — SQLAlchemy engine, session, `Base`
- `app/models.py` — Pydantic request/response models
- `app/normalizer.py` — Rule-based Nemotron mock (severity keywords → weights 2/6/10)
- `app/qubo.py` — QUBO matrix compiler + simulated annealing solver
- `app/services/ingestion_service.py` — Orchestrates normalize → geocode → (not) persist
- `app/services/nemotron_client.py` — Async httpx client for Nemotron API (unused)
- `app/services/geocoding_service.py` — Stub geocoder (returns None, None)
- `requirements.txt` — Python dependencies
- `Dockerfile` — Python 3.11-slim based

---

## Frontend — Status & Known Issues

**Location:** `state-farm-disaster-relief/frontend/`

### What Works
- Next.js 14 build compiles successfully (`next build` passes).
- TypeScript types pass.
- All components render without runtime errors (in production build).
- Dark mode color system defined in `globals.css` (CSS variables + Tailwind arbitrary values).
- Layout: TopNav + Sidebar + Map + ClaimsTable + ResourceAllocation + FleetCards + DispatchLog + RedAlertWidget.
- Map uses Leaflet with CartoDB Dark Matter tiles (no broken tiles, no API key required).
- Hurricane polygon, cleared zone, storm circle, weather front line rendered.
- Color-coded claim pins (red/amber/green by severity) and unit pins (blue/amber/green by status).
- KPI cards: Total Claims (4157), Deployed Units, Pending Units, Avg Response (< 2s).
- Claims table: 8 mock claims with horizontal severity priority bars.
- Dispatch log: Auto-updates every 6 seconds with simulated events.
- Red alert widget: Bottom-right, pulsing alert dot, rotating weather warnings.
- Client-side dynamic import (`ssr: false`) to avoid Leaflet/window SSR errors.

### Known Issues / Why It "Does Not Look Good"

The user explicitly stated the frontend "still does not look good." Specific areas needing work:

1. **Layout proportions:** The map viewport is constrained to `h-[calc(100vh-220px)] max-h-[700px]` which may be too small or awkwardly sized depending on screen resolution. The bottom dock (claims + resource + fleet) is fixed at `h-[300px]`. These are arbitrary and not responsive.

2. **No real data integration:** The frontend uses hardcoded mock data (`MOCK_CLAIMS`, `MOCK_CLAIM_PINS`, `MOCK_UNIT_PINS`). It does not call the backend to populate the map or table dynamically. The `runOptimization` API call exists in `ClientPage.tsx` but the results are not reflected in the map pins or claims table colors.

3. **KPI cards are static:** They show hardcoded numbers (4157, 2, 5, < 2s) rather than live backend data.

4. **Sidebar is static:** Selected units and assignable units are hardcoded arrays (`SELECTED_UNITS`, `ASSIGNABLE_UNITS`). No real-time sync with backend deployment status.

5. **Design tokens not fully centralized:** Colors are scattered as Tailwind arbitrary values (`bg-[#0F1117]`, `text-[#F8FAFC]`, etc.) rather than a clean Tailwind config theme extension. `globals.css` defines CSS variables but components use arbitrary Tailwind values instead.

6. **No loading states beyond a simple "Processing" text:** No skeletons, no spinners, no optimistic UI.

7. **Typography:** Uses Inter font but no clear typographic scale hierarchy. Headings and body text feel similar in weight.

8. **Density vs. readability:** The spec calls for "high-density" but the current layout may feel cramped or empty depending on viewport size. The sidebar is fixed at 320px which may waste space on wide screens or cramp on narrow ones.

9. **Map interactivity:** No click handlers on pins, no popups with actionable info, no zoom-to-claim, no layer toggles.

10. **No empty states:** If there are no claims, the table is just empty. No "No claims" illustration.

### Files Needing Most Attention
- `src/app/ClientPage.tsx` — Main layout orchestrator; needs real data wiring
- `src/components/MapComponent.tsx` — Needs interactivity, dynamic data from backend
- `src/components/ClaimsTable.tsx` — Needs to accept real data props instead of mock
- `src/components/Sidebar.tsx` — Needs real unit data from backend
- `src/components/KPICards.tsx` — Needs live metrics from `/deployments/status`
- `src/app/globals.css` — Needs to be the single source of truth for colors
- `tailwind.config.js` — Could extend theme with the enterprise color palette

---

## Terminal UI (TUI) — Status & Details

**Location:** `state-farm-disaster-relief/tui/`

### What Works
- Textual 0.86-based terminal dashboard.
- Imports and instantiates without errors.
- KPI cards, storm radar (ASCII), red alert widget, dispatch log, claims table (Static), fleet cards (Static), resource allocation (Static).
- Buttons: Ingest Telemetry, Run Optimization, Refresh.
- Telemetry input field.
- Async HTTP calls to backend via httpx.
- Live dispatch log updates every 5 seconds with simulated events.
- Reactive widgets (`MapDisplay`, `RedAlert`) update when reactive vars change.

### Known Issues
- `MapDisplay.render_map()` uses ASCII art with Unicode box-drawing characters — may not render correctly in all terminals.
- All data is mock/static; no live backend sync for claims table, fleet, or resource allocation.
- `deployment_status` endpoint returns zeros (placeholder), so KPI cards show 0 until optimization is run.
- No WebSocket or SSE — polling only via `set_interval`.

### Files
- `app.py` — Full Textual application
- `requirements.txt` — textual, httpx

---

## MQTT Test Simulation — Status & Details

**Location:** `state-farm-disaster-relief/test/`

### What Works
- `data_generator.py` — Generates realistic catastrophe reports with customer, location, damage, weather, news fields.
- `mqtt_config.py` — Broker settings, topics, backend URLs, simulation intervals.
- `mqtt_publisher.py` — Publishes reports to MQTT topics (`crismin/telemetry/claims`, `/weather`, `/news`).
- `mqtt_subscriber.py` — Subscribes, logs, auto-forwards claims to `/api/v1/telemetry/ingest`, triggers optimization every 5 reports.
- `run_simulation.py` — Orchestrates publisher + subscriber with prerequisite checks and `--force` flag.
- `requirements.txt` — paho-mqtt, httpx, python-dotenv.
- `README.md` — Setup instructions.

### Fixed Issues
- Import path: Added `sys.path` bootstrap so `test.*` imports work from both `test/` directory and project root.
- Prerequisite checks: `check_port` tries IPv4 then IPv6; defaults to `127.0.0.1`; configurable via env vars; `--force` flag added.

### Prerequisites
1. MQTT broker on port 1883 (mosquitto or Docker `eclipse-mosquitto`)
2. FastAPI backend on port 8000

### Running
```bash
cd test
source .venv/bin/activate
python run_simulation.py
# or with --force to skip checks
python run_simulation.py --force
```

---

## Database Schema

**Location:** `state-farm-disaster-relief/database/init.sql`

Tables:
- `claims` — id, claim_id, raw_report, severity_score, geographic_description, latitude, longitude, location (GEOGRAPHY POINT), resource_demand, status, created_at
- `response_units` — id, unit_id, unit_type, current_latitude, current_longitude, current_location (GEOGRAPHY), status, assigned_claim_id, updated_at
- `optimization_logs` — id, run_id, total_nodes, available_units, best_energy, deployment_vector (JSONB), executed_at

Indexes: GIST on spatial columns, B-tree on severity and timestamps.

**Note:** This schema is NOT automatically applied when running the backend locally. It is applied via Docker (`docker-entrypoint-initdb.d/init.sql`). Local backend startup skips table creation if PostgreSQL is unreachable.

---

## API Endpoints

| Method | Endpoint | Body | Response | Status |
|--------|----------|------|----------|--------|
| GET | `/` | — | `{"status":"ok","service":"..."}` | 200 |
| GET | `/health` | — | `{"status":"ok","service":"..."}` | 200 |
| GET | `/v1/models` | — | OpenAI model list (Nemotron) | 200 |
| POST | `/api/v1/telemetry/ingest` | `{"reports": [str]}` | `TelemetryIngestResponse` | 200 |
| POST | `/api/v1/optimize/run` | `{"reports":[str], "available_units":int, "iterations":int}` | `OptimizationResult` | 200 |
| GET | `/api/v1/deployments/status` | — | `DeploymentStatus` (placeholder zeros) | 200 |

---

## How to Run Everything

### Prerequisites
- Python 3.11+
- Node.js 20+
- (Optional) Docker & Docker Compose
- (Optional) Mosquitto MQTT broker

### Option A: Docker Compose (Full Stack)

```bash
cd /Users/saneeshdivakaran/HackUTD26/CrisMan/state-farm-disaster-relief
cp .env.example .env   # add NEMOTRON_API_KEY
docker compose up --build
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

### Option B: Manual (Separate Terminals)

**Terminal 1 — Backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 — TUI:**
```bash
cd tui
source .venv/bin/activate
python app.py
```

**Terminal 4 — MQTT Simulation (requires mosquitto):**
```bash
mosquitto -v    # start broker in background
cd test
source .venv/bin/activate
python run_simulation.py
```

### Verify Backend is Running
```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/api/v1/optimize/run \
  -H 'Content-Type: application/json' \
  -d '{"reports":["Total loss tornado","Minor roof damage"],"available_units":2}'
```

---

## Known Bugs & Issues

### Backend
1. Database tables not created locally without PostgreSQL running (Docker only).
2. `IngestionService` does not persist to SQLAlchemy models — in-memory only.
3. `NemotronClient` exists but is unused; mock normalizer is used instead.
4. `geocoding_service.py` returns `(None, None)` — no real geocoding.
5. QUBO solver is NumPy-only, not GPU-accelerated.

### Frontend
1. All data is hardcoded mock — no live backend integration for map, table, fleet, or KPIs.
2. Layout heights are arbitrary (`h-[calc(100vh-220px)]`, `max-h-[700px]`, `h-[300px]`).
3. No loading states, skeletons, or optimistic UI.
4. Colors scattered as arbitrary Tailwind values; `globals.css` variables underused.
5. No map pin click handlers or interactivity.
6. No empty states.

### TUI
1. All data mock/static.
2. ASCII map may not render in all terminals.
3. No WebSocket — polling only.

### MQTT Test
1. Requires mosquitto broker (not included).
2. Requires backend running for full flow.
3. `brew services start mosquitto` may fail on macOS (bootstrap error) — use `mosquitto -v` directly.

---

## Frontend-Specific Problems & Fixes Needed

The user said "the frontend still does not look good." Below is a prioritized list of what the next agent should address:

### P1 — Critical (blocks a good demo)
1. **Wire real data:** Connect `ClientPage.tsx` to `/api/v1/optimize/run` and `/api/v1/deployments/status`. When optimization runs, update:
   - Claims table rows with `deployed` status from backend response.
   - Map pin colors based on deployment result.
   - Fleet cards status based on deployed units.
   - KPI card numbers from backend response.
2. **Fix layout heights:** Replace arbitrary `h-[calc(...)]` and `max-h-[700px]` with responsive, flexible layout. Consider `flex-1` and `min-h-0` patterns with proper overflow handling.
3. **Centralize design tokens:** Move all colors (`#0F1117`, `#1E222B`, `#2D323E`, `#F8FAFC`, `#94A3B8`, `#EF4444`, `#3B82F6`, `#F59E0B`, `#10B981`) into `tailwind.config.js` theme extension and `globals.css` CSS variables. Components should use `bg-canvas`, `text-primary`, etc. instead of arbitrary values.

### P2 — Important (polish)
4. **Add loading states:** Skeleton screens or spinner while optimization runs.
5. **Add empty states:** "No claims" message when table is empty.
6. **Map interactivity:** Click a claim pin → highlight row in table. Click a unit → show details.
7. **Typography scale:** Clear h1/h2/h3/body distinctions with font weights and sizes.
8. **Sidebar responsiveness:** Make sidebar collapsible or overlay on mobile.
9. **Status pill consistency:** Ensure status colors match across map pins, fleet cards, sidebar.

### P3 — Nice to have
10. **Animations:** Subtle fade-in/slide-up for new claims, pulse for active alerts.
11. **Real-time via SSE/WebSocket:** Instead of polling, push updates from backend.
12. **Dark mode toggle:** (Spec says dark mode only, but a toggle could be useful.)
13. **Print-friendly styles:** For dispatch logs.

---

## Recommended Next Steps for Next Agent

1. **Read this entire HANDOFF.md** and the `README.md` files at root and in each subfolder.
2. **Run the backend** and verify `GET /health` and `POST /api/v1/optimize/run` work.
3. **Fix the frontend data wiring** (P1 items above) — this is the highest value work.
4. **Run `next build`** after each change to verify no TypeScript/build errors.
5. **Test the full MQTT simulation** end-to-end: mosquitto → publisher → subscriber → backend → TUI/dashboard.
6. **Configure a git remote** and push: `git remote add origin <url> && git push -u origin main`.
7. **Consider Docker Compose** for one-command full-stack startup.

---

## File-by-File Inventory

### Backend (`state-farm-disaster-relief/backend/`)
| File | Purpose | Status |
|------|---------|--------|
| `app/main.py` | FastAPI app, routes, startup | Working, fixed 422 |
| `app/config.py` | Pydantic settings | Working |
| `app/database.py` | SQLAlchemy engine/session | Working (needs Postgres) |
| `app/models.py` | Pydantic models | Working |
| `app/normalizer.py` | Nemotron mock | Working (rule-based) |
| `app/qubo.py` | QUBO compiler + solver | Working (NumPy only) |
| `app/services/ingestion_service.py` | Ingestion orchestration | Partially (not persisting) |
| `app/services/nemotron_client.py` | Async Nemotron client | Unused |
| `app/services/geocoding_service.py` | Geocoding stub | Stub (returns None) |
| `requirements.txt` | Python deps | Installed |
| `Dockerfile` | Container | Not tested |

### Frontend (`state-farm-disaster-relief/frontend/`)
| File | Purpose | Status |
|------|---------|--------|
| `src/app/page.tsx` | Dynamic import wrapper | Working |
| `src/app/ClientPage.tsx` | Main dashboard orchestrator | Mock data only |
| `src/app/layout.tsx` | Root layout | Working |
| `src/app/globals.css` | Design tokens + base styles | Partially centralized |
| `src/components/TopNav.tsx` | Header | Working |
| `src/components/Sidebar.tsx` | Left pane units | Mock data |
| `src/components/MapComponent.tsx` | Leaflet map | Working (mock pins) |
| `src/components/ClaimsTable.tsx` | Claims feed | Mock data |
| `src/components/KPICards.tsx` | Metric cards | Static numbers |
| `src/components/ResourceAllocation.tsx` | Efficiency bars | Static |
| `src/components/FleetCards.tsx` | CRU status | Mock data |
| `src/components/DispatchLog.tsx` | Terminal log | Auto-updating mock |
| `src/components/RedAlertWidget.tsx` | Weather alerts | Static list |
| `src/lib/api.ts` | HTTP client | Working |
| `tailwind.config.js` | Tailwind config | Basic, not extended |
| `next.config.js` | Next config | Working |
| `package.json` | Node deps | Installed |
| `Dockerfile` | Container | Not tested |

### Terminal UI (`state-farm-disaster-relief/tui/`)
| File | Purpose | Status |
|------|---------|--------|
| `app.py` | Textual app | Working (mock data) |
| `requirements.txt` | Python deps | Installed |

### Test (`state-farm-disaster-relief/test/`)
| File | Purpose | Status |
|------|---------|--------|
| `data_generator.py` | Report generator | Working |
| `mqtt_config.py` | Config | Working |
| `mqtt_publisher.py` | MQTT publish | Working (imports fixed) |
| `mqtt_subscriber.py` | MQTT subscribe + backend forward | Working (imports fixed) |
| `run_simulation.py` | Orchestrator | Working (hardened) |
| `requirements.txt` | Python deps | Installed |
| `README.md` | Docs | Written |

### Root
| File | Purpose | Status |
|------|---------|--------|
| `README.md` | Project overview | Written |
| `LICENSE` | MIT License | Written |
| `.gitignore` | Git ignore | Written |
| `SKILL.md` | OpenCode skill (ASD-STE100) | Pre-existing |
| `docker-compose.yml` | Multi-container | Not tested |
| `database/init.sql` | Postgres schema | Not applied locally |
| `HANDOFF.md` | This file | Written |

---

## Environment Variables

Create `state-farm-disaster-relief/.env` (from `.env.example`):

```
NEMOTRON_API_KEY=your-nemotron-api-key-here
NEMOTRON_BASE_URL=https://integrate.api.nvidia.com/v1
DATABASE_URL=postgresql+psycopg2://crismin:crismin@localhost:5432/crismin
REDIS_URL=redis://localhost:6379/0
```

For the test simulation:
```
MQTT_BROKER_HOST=127.0.0.1
MQTT_BROKER_PORT=1883
BACKEND_BASE_URL=http://localhost:8000
PUBLISH_INTERVAL_SECONDS=3.0
BATCH_SIZE_FOR_OPTIMIZATION=5
```

---

## Dependencies

### Backend (Python)
fastapi, uvicorn, pydantic, pydantic-settings, numpy, sqlalchemy, alembic, psycopg2-binary, geoalchemy2, httpx, python-multipart, redis, python-dotenv

### Frontend (Node)
next, react, react-dom, leaflet, react-leaflet, lucide-react, clsx, tailwind-merge, autoprefixer, postcss, tailwindcss, typescript

### TUI (Python)
textual, httpx

### Test (Python)
paho-mqtt, httpx, python-dotenv

---

## Contact / Context

This project was built for HackUTD26 / State Farm catastrophe response. The codebase is a working prototype with a solid backend API, a terminal UI, an MQTT test harness, and a frontend that compiles but needs data wiring and visual polish. The next agent's highest-impact work is connecting the frontend to the backend so the dashboard reflects real optimization results.

---

*End of HANDOFF.md*
