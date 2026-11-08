const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function ingestTelemetry(reports: string[]) {
  const res = await fetch(`${API_URL}/api/v1/telemetry/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reports }),
  })
  if (!res.ok) throw new Error("Ingestion failed")
  return res.json()
}

export async function runOptimization(reports: string[], availableUnits = 2) {
  const res = await fetch(`${API_URL}/api/v1/optimize/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reports, available_units: availableUnits }),
  })
  if (!res.ok) throw new Error("Optimization failed")
  return res.json()
}

export async function getDeploymentStatus() {
  const res = await fetch(`${API_URL}/api/v1/deployments/status`)
  if (!res.ok) throw new Error("Failed to fetch deployment status")
  return res.json()
}
