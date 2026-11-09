# CrisMin — Catastrophe Response Command Center

CrisMin turns the flood of unstructured loss reports that arrive during a
catastrophe into a live, prioritized dispatch picture. NVIDIA Nemotron reads
each report, and a continuously re-solved QUBO routing model works out which
response unit should go where. When a route is clear, it is dispatched
automatically.

Built for State Farm's catastrophe-response challenge at HackUTD 2026. This
is a working prototype, not an official State Farm product. The demo
scenario (a Gulf Coast hurricane) runs on simulated reports and units.

---

## Who it is for

**The State Farm catastrophe response agent**: the CAT coordinator or
dispatcher who decides which adjuster team, mobile command unit, or supply
truck goes to which policyholder while a storm is still unfolding.

During an event, that person is buried in 911 transcripts, policyholder
calls, and field notes, all free text, arriving faster than anyone can read
them. CrisMin is built to answer the agent's questions at a glance:

| The agent needs to know | Where CrisMin shows it |
|---|---|
| What just came in, and how bad is it? | Claims table: every report is scored 1–10 by Nemotron, with location and damage type extracted |
| Where is every unit, and where is it going? | Map labels on every unit (`ADJ-01 → 4003 · 6m`), the fleet panel, and the **In motion** list |
| When will help arrive? | Live ETA on the map, in the fleet panel, and in the claims table |
| What is the system about to do? | **Predicted next** routes, each with a confidence % and a 3-step confirmation streak |
| Is anything critical waiting? | The **Critical** KPI turns red with a count of critical claims still waiting for a unit |
| Can I override it? | Manual dispatch, recall, and an auto-dispatch on/off switch, always available |

---

## What it does

### 1. Reads every report automatically (NVIDIA Nemotron)

Reports arrive from four sources: the built-in simulated feed, the **New
report** dialog, the MQTT test harness, and `POST /api/v1/telemetry/ingest`.
All of them go through the same intake. The backend batches reports to
Nemotron on the NVIDIA API Catalog (`integrate.api.nvidia.com`) and gets
back structured fields for each one:

- severity (1–10) and damage type
- location (resolved to map coordinates)
- whether people are at risk
- which kind of unit is needed (command, adjuster, or supply)
- Nemotron's own confidence in the extraction

If Nemotron is unreachable or rejects the request, those reports are scored
by keyword rules instead, so intake never stops. The header shows which path
is active, and the **System** tab shows the exact error.

### 2. Continuously re-plans routing (QUBO, ~every 3 s)

Every few seconds the backend rebuilds the routing problem from the live
picture and solves it again. Each (idle unit, open claim) pairing is a
binary decision. The model rewards urgency (severity, time waiting, people
at risk), penalizes travel time, and favors the right unit type for the job.
Constraint terms ensure a unit takes one claim and a claim gets one unit.
This is a QUBO / Ising Hamiltonian, solved here with simulated annealing on
an ordinary CPU. It is quantum-inspired; it does not run on quantum hardware,
though the same formulation maps directly onto quantum or GPU annealers.

### 3. Attaches a confidence % to every route

Severity scores and travel times are uncertain, so each solve runs 96
replicas. Each replica samples severities from Nemotron's confidence and
travel times from traffic and weather noise. A route's **confidence** is the
share of replicas in which it is the best choice or within a small tolerance
of it. For critical claims (severity ≥ 8), confidence measures whether the
claim gets served at all, because getting a unit there now matters more than
which unit goes.

### 4. Dispatches automatically when it is sure

With **Auto-dispatch** on, a route is committed when it holds at **≥ 90%
confidence for 3 consecutive solves** (re-checked every 0.5 s while
confirming). Units then travel, work on scene, and become free again on a
compressed clock: 1 real second is 1 simulated minute. The activity log
records every decision, including the confidence each route was dispatched
at.

### 5. Keeps the agent in control

- Select any open claim, then click **Dispatch** on any idle unit to send it
  manually.
- Hover over a busy unit and click **Recall** to free it.
- Turn auto-dispatch off (header switch, or press `A`) to review predictions
  without committing them.
- Press **Solve now** (`S`) to force an immediate re-plan.

---

## The dashboard

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ CrisMin / Gulf Coast / Hurricane response  ● Active ⟳   Nemotron ● · Auto-dispatch│
├───────────┬──────────────────────────────────────────────────┬───────────────────┤
│ Fleet     │ Open claims · Critical · Units committed ·       │ Routing           │
│           │ Resolved · Route confidence                      │  In motion        │
│ CRU-01    ├──────────────────────────────────────────────────┤  Predicted next   │
│ → CLM-4001│                                                  │  Auto-dispatch    │
│  ETA 6m   │   Operations map                                 │ Activity          │
│ ADJ-01    │   unit labels: ADJ-01 → 4003 · 6m                │ Alerts            │
│ → CLM-4003│   predicted routes (dashed) with confidence %    │ System            │
│  ETA 4m   ├──────────────────────────────────────────────────┤  Nemotron status  │
│ …         │ Claims: Active · Critical · Open · Responding ·  │  Coverage meters  │
│           │ Resolved, with severity, unit ETA, and status    │                   │
└───────────┴──────────────────────────────────────────────────┴───────────────────┘
```

**Map key**

- Claim pins: red is severity ≥ 8, amber is 5–7, green is below 5, grey is
  unscored.
- Unit squares: blue is on scene, amber is en route, green is idle.
- Each unit's label gives its destination and ETA. A ring marks every claim a
  unit is heading to or working.
- Dashed lines are predicted routes with their confidence. They turn green
  once a route reaches the dispatch threshold.

**Keyboard shortcuts**

| Key | Action |
|---|---|
| `N` | New report |
| `S` | Solve now |
| `A` | Toggle auto-dispatch |
| `[` | Show or hide the fleet panel |
| `Esc` | Clear selection |

**A claim's lifecycle:** Intake (Nemotron is reading it) → Open → En route →
On scene → Resolved.

---

## Getting started

### Requirements

- Python 3.10+
- Node.js 20+
- An NVIDIA API key (`nvapi-…`) from [build.nvidia.com](https://build.nvidia.com).
  Without one, CrisMin still runs, scoring reports with keyword rules.

### 1. Configure

Create `state-farm-disaster-relief/.env`:

```
NEMOTRON_API_KEY=nvapi-...
NEMOTRON_BASE_URL=https://integrate.api.nvidia.com/v1
NEMOTRON_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b
```

`NEMOTRON_MODEL` is optional. Without it, the backend picks the first
Nemotron model your key can actually use. The backend finds this file
whichever directory you start it from.

### 2. Start the backend

```bash
cd state-farm-disaster-relief/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On startup the log prints `Engine started · Nemotron configured`. API docs
are served at `http://localhost:8000/docs`. PostgreSQL and Redis are
optional: the live picture is held in memory, and the backend starts without
them.

### 3. Start the dashboard

```bash
cd state-farm-disaster-relief/frontend
npm install
npm run dev
```

Open `http://localhost:3000`. If the header chip reads **Nemotron ·
<model>** in green, live AI intake is working. If it reads **Rule fallback**
in amber, open the **System** tab for the reason.

### Check your Nemotron key on its own

```bash
cd state-farm-disaster-relief
python3 testnemo.py            # chat with Nemotron in the terminal
python3 testnemo.py --think    # also show the model's reasoning
```

If this chats, your key and network are good. Common errors and fixes are
under [Troubleshooting](#troubleshooting).

### Docker Compose

```bash
cd state-farm-disaster-relief
docker compose up --build      # reads NEMOTRON_API_KEY from .env
```

This starts Postgres, Redis, the backend (`:8000`), and the dashboard
(`:3000`). The Compose setup has not been tested since the live engine was
added; the local steps above are the verified path.

---

## Configuration

Every setting lives in `backend/app/config.py` and can be overridden with an
environment variable or a line in `.env`.

| Setting | Default | What it controls |
|---|---|---|
| `CONFIDENCE_THRESHOLD` | `0.90` | Confidence a route needs before auto-dispatch |
| `COMMIT_STREAK` | `3` | How many consecutive solves must agree |
| `AUTOPILOT` | `true` | Whether auto-dispatch is on at startup |
| `SOLVER_INTERVAL_S` | `3.0` | Seconds between routing solves |
| `SOLVER_REPLICAS` | `96` | Annealing replicas per solve (more replicas give steadier confidence) |
| `SIM_FEED_ENABLED` | `true` | Whether the built-in simulated report stream is on |
| `SIM_FEED_INTERVAL_S` | `20` | Average seconds between simulated reports |
| `TIME_SCALE` | `60` | Simulated minutes per real minute (60 means 1 s = 1 min) |
| `NEMOTRON_MODEL` | auto | Pin a specific Nemotron model |
| `NEMOTRON_BATCH_SIZE` | `8` | Reports per Nemotron request |
| `NEMOTRON_MIN_INTERVAL_S` | `2.0` | Minimum gap between requests (the free tier allows about 40/min) |

---

## API

**Live operations** (used by the dashboard)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/ops/state?since=<event id>` | Full operational picture: claims, units, predictions, solver and Nemotron status, new events |
| POST | `/api/v1/telemetry/ingest` | Queue reports for Nemotron: `{"reports": [...], "hints": [{"location", "damage_type"}]}` (`hints` is optional) |
| POST | `/api/v1/ops/dispatch` | Manual dispatch: `{"unit_id", "claim_id"}` |
| POST | `/api/v1/ops/recall` | Recall a unit: `{"unit_id"}` |
| POST | `/api/v1/ops/autopilot` | Turn auto-dispatch on or off: `{"enabled": bool}` |
| POST | `/api/v1/ops/feed` | Turn the simulated feed on or off: `{"enabled": bool}` |
| POST | `/api/v1/ops/solve` | Re-solve routing immediately |
| POST | `/api/v1/ops/reset` | Restart the demo scenario |

**One-shot and legacy** (used by the terminal UI and the MQTT harness)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/v1/optimize/run` | Stateless zone-selection QUBO over a list of reports |
| GET | `/api/v1/deployments/status` | Deployment summary from the live engine |

---

## Repository layout

```
CrisMan/
├── README.md                     # this file
├── HANDOFF.md                    # detailed engineering notes for contributors
├── LICENSE                       # MIT
└── state-farm-disaster-relief/
    ├── testnemo.py               # terminal chatbot for checking a Nemotron key
    ├── backend/                  # FastAPI
    │   ├── app/
    │   │   ├── main.py           # routes and startup
    │   │   ├── engine.py         # live picture plus intake, solver, motion, and feed loops
    │   │   ├── routing_qubo.py   # routing QUBO, replica annealing, confidence
    │   │   ├── feed.py           # simulated Gulf Coast report generator
    │   │   ├── config.py         # all settings
    │   │   ├── services/
    │   │   │   ├── nemotron_client.py    # batched Nemotron extraction with fallback
    │   │   │   └── geocoding_service.py  # place names to coordinates
    │   │   ├── qubo.py, normalizer.py    # legacy one-shot optimizer
    │   │   └── models.py, database.py
    │   └── tests/test_routing.py         # solver and parser regression tests
    ├── frontend/                 # Next.js 14 dashboard (TypeScript, Tailwind, Leaflet + MapLibre)
    │   └── src/{app,components,lib}
    ├── tui/                      # terminal dashboard (Textual)
    ├── test/                     # MQTT live-feed simulation
    ├── database/init.sql         # PostgreSQL + PostGIS schema
    └── docker-compose.yml
```

**Stack:** FastAPI · NumPy · NVIDIA Nemotron (API Catalog) · Next.js 14 ·
TypeScript · Tailwind CSS · Leaflet with OpenFreeMap vector tiles (free, no
key needed) · Textual · paho-mqtt · Docker Compose.

---

## Tests

```bash
cd state-farm-disaster-relief/backend
pip install pytest
python -m pytest -q tests
```

The 15 tests cover:

- the annealer matching the brute-force optimum
- interchangeable claims and units reaching the confidence threshold
- critical claims not being outbid by long-waiting minor ones
- far-away units still covering critical claims
- plan stability between solves
- Nemotron response parsing and the rule fallback

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Header shows **Rule fallback** | Open the **System** tab for NVIDIA's exact error. The rows below cover the common ones. |
| `404 … Not found for account` | The model is listed but not enabled for your key. Pin one that works in the build.nvidia.com playground with `NEMOTRON_MODEL=…`. |
| `401` | The key is rejected, or it lacks chat access ("Public API Endpoints") on build.nvidia.com. |
| `429` | Free-tier rate limit. The backend cools down and retries on its own. |
| `CERTIFICATE_VERIFY_FAILED` (`testnemo.py`) | The python.org build of Python on macOS lacks system certificates. Run `pip3 install certifi`, or run *Install Certificates.command* from your Python folder. On a corporate network, set `SSL_CERT_FILE` to your company's root CA. |
| Dashboard shows "Backend unreachable" | Start the backend on port 8000, or set `NEXT_PUBLIC_API_URL`. |
| `Module not found: maplibre-gl` | Run `npm install` in `frontend/`. |

---

## Limitations

- **Simulated operations.** Units, travel, and on-scene time are simulated
  on a compressed clock. The built-in feed and MQTT harness generate the
  reports.
- **In-memory state.** The live picture resets when the backend restarts.
  The PostGIS schema exists but is not wired in yet.
- **Gulf Coast gazetteer.** Locations are resolved against a built-in list
  of Gulf Coast cities. Reports elsewhere stay out of routing and are
  flagged in the activity log.
- **No preemption.** When every unit is busy, a new critical claim waits for
  the next free unit; the solver does not reroute a unit away from a minor
  job.
- **Classical solver.** The QUBO is solved by simulated annealing on a CPU,
  not quantum hardware.

# Built for HackUTD 2026

## License

[MIT](LICENSE)
