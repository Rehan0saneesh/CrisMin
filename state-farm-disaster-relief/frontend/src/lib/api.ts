export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ---- Live operations state (mirrors backend/app/engine.py snapshot) ----

export type ClaimStatus = "pending" | "open" | "assigned" | "on_scene" | "resolved"
export type UnitStatus = "Deployed" | "En Route" | "Idle"
export type UnitType = "Command Vehicle" | "Adjuster Team" | "Supply Vehicle"

export type Claim = {
  id: string
  claim_number: string
  report: string
  origin: "seed" | "feed" | "manual" | "api"
  received_at: number
  status: ClaimStatus
  location: string | null
  lat: number | null
  lng: number | null
  severity: number | null
  damage_type: string | null
  people_at_risk: boolean
  demand: "command" | "adjuster" | "supply" | null
  extraction_confidence: number | null
  summary: string | null
  source: "nemotron" | "rules" | null
  model: string | null
  assigned_unit: string | null
  dispatched_at: number | null
  dispatch_confidence: number | null
  resolved_at: number | null
  prediction: { unit_id: string; confidence: number; streak: number; eta_min: number } | null
}

export type Unit = {
  id: string
  name: string
  type: UnitType
  lat: number
  lng: number
  location: string
  status: UnitStatus
  assigned_claim: string | null
  eta_s: number | null
  service_s: number | null
  prediction: { claim_id: string; confidence: number; streak: number } | null
}

export type Prediction = {
  unit_id: string
  claim_id: string
  confidence: number // what the commit rule uses (see basis)
  route_confidence: number
  coverage: number
  basis: "route" | "coverage"
  agreement: number
  eta_min: number
  streak: number
  first_seen: number
}

export type OpsEvent = { id: number; ts: number; level: "info" | "success" | "alert" | "error"; msg: string }

export type OpsState = {
  epoch: number
  server_time: number
  claims: Claim[]
  units: Unit[]
  predictions: Prediction[]
  solver: {
    cycle: number
    last_at: number | null
    ms: number | null
    variables: number
    couplings: number
    replicas: number
    sweeps: number
    energy: number | null
    mean_confidence: number | null
    history: { cycle: number; energy: number | null; confidence: number | null; routes: number }[]
    interval_s: number
  }
  nemotron: {
    mode: "nemotron" | "fallback" | "disabled" | "starting"
    model: string | null
    configured: boolean
    calls: number
    failures: number
    reports: number
    fallback_reports: number
    last_latency_ms: number | null
    avg_latency_ms: number | null
    last_error: string | null
    last_ok_at: number | null
    queue: number
  }
  control: { autopilot: boolean; threshold: number; commit_streak: number; feed_enabled: boolean; time_scale: number }
  stats: { resolved_total: number; avg_response_min: number | null }
  events: OpsEvent[]
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 8_000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    })
    if (!res.ok) {
      let detail = ""
      try {
        const j = await res.json()
        detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j)
      } catch {
        detail = res.statusText
      }
      throw new Error(detail || `HTTP ${res.status}`)
    }
    return (await res.json()) as T
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error(`Request to ${path} timed out`)
    if (err instanceof TypeError) throw new Error(`Backend unreachable at ${API_URL}`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

const post = <T,>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body: JSON.stringify(body) })

export const getOpsState = (since: number) => request<OpsState>(`/api/v1/ops/state?since=${since}`, undefined, 5_000)

export const ingestReport = (report: string, location: string, damageType: string) =>
  post<{ claim_ids: string[] }>("/api/v1/telemetry/ingest", {
    reports: [report],
    hints: [{ location, damage_type: damageType }],
    origin: "manual",
  })

export const dispatchUnit = (unit_id: string, claim_id: string) => post("/api/v1/ops/dispatch", { unit_id, claim_id })
export const recallUnit = (unit_id: string) => post("/api/v1/ops/recall", { unit_id })
export const setAutopilot = (enabled: boolean) => post("/api/v1/ops/autopilot", { enabled })
export const setFeed = (enabled: boolean) => post("/api/v1/ops/feed", { enabled })
export const solveNow = () => post("/api/v1/ops/solve")
export const resetScenario = () => post("/api/v1/ops/reset")
