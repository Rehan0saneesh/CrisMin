// Options for the New report dialog. Location hints must match the
// backend gazetteer (backend/app/services/geocoding_service.py).
export const LOCATIONS = [
  "Mobile, AL",
  "Gulf Shores, AL",
  "Gulfport, MS",
  "Biloxi, MS",
  "Pascagoula, MS",
  "Pensacola, FL",
  "Panama City, FL",
  "New Orleans, LA",
] as const

export const DAMAGE_TYPES = [
  "Structural Collapse",
  "Flooding",
  "Water Intrusion",
  "Roof Damage",
  "Shingle Loss",
  "Downed Power Lines",
  "Wind Damage",
] as const

export function clockTime(epochSeconds: number) {
  return new Date(epochSeconds * 1000).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function pct(x: number | null | undefined, digits = 0) {
  return x === null || x === undefined ? "—" : `${(x * 100).toFixed(digits)}%`
}

export function fmtSeverity(s: number | null) {
  if (s === null) return "—"
  return Number.isInteger(s) ? s.toFixed(0) : s.toFixed(1)
}

export function fmtDuration(seconds: number | null, timeScale: number) {
  if (seconds === null) return ""
  const simMin = Math.round((seconds * timeScale) / 60)
  return simMin >= 60 ? `${Math.floor(simMin / 60)}h ${simMin % 60}m` : `${simMin}m`
}
