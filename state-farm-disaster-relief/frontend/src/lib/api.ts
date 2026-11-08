export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Response shapes mirror backend/app/models.py.
export type DeploymentZone = { claim_id: string; severity_score: number; deployed: boolean }

export type OptimizationResult = {
  deployment_vector: number[]
  deployed_zones: DeploymentZone[]
  best_energy: number
  total_nodes: number
  available_units: number
}

export type TelemetryIngestResponse = {
  status: string
  zones_normalized: number
  zones_saved: number
  claim_ids: string[]
}

export type DeploymentStatus = {
  total_claims: number
  deployed_units: number
  pending_units: number
  active_deployments: DeploymentZone[]
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 10_000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 160)}` : ""}`)
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

export function checkHealth() {
  return request<{ status: string }>("/health", undefined, 4_000)
}

export function ingestTelemetry(reports: string[]) {
  return request<TelemetryIngestResponse>("/api/v1/telemetry/ingest", {
    method: "POST",
    body: JSON.stringify({ reports }),
  })
}

export function runOptimization(reports: string[], availableUnits: number, iterations = 2000) {
  return request<OptimizationResult>(
    "/api/v1/optimize/run",
    {
      method: "POST",
      body: JSON.stringify({ reports, available_units: Math.max(1, availableUnits), iterations }),
    },
    30_000,
  )
}

export function getDeploymentStatus() {
  return request<DeploymentStatus>("/api/v1/deployments/status")
}
