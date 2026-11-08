import type { UnitStatus } from "./tokens"

export type ClaimStatus = "unscored" | "unassigned" | "queued" | "assigned"

export type Claim = {
  id: string
  claimNumber: string
  /** Backend claim id from the most recent ingest / optimization run. */
  backendId?: string
  location: string
  damageType: string
  report: string
  lat: number
  lng: number
  receivedAt: string
  /** Set by the backend normalizer. null until the claim is scored. */
  severity: number | null
  status: ClaimStatus
  assignedUnitId?: string
}

export type Unit = {
  id: string
  name: string
  type: "Command Vehicle" | "Adjuster Team" | "Supply Vehicle"
  status: UnitStatus
  location: string
  lat: number
  lng: number
  assignedClaimId?: string
}

export type LogLevel = "info" | "success" | "alert" | "error"
export type LogEntry = { id: number; ts: string; level: LogLevel; msg: string }

export const LOCATIONS: Record<string, [number, number]> = {
  "Mobile, AL": [30.6954, -88.0399],
  "Gulf Shores, AL": [30.2460, -87.7008],
  "Gulfport, MS": [30.3674, -89.0928],
  "Biloxi, MS": [30.3960, -88.8853],
  "Pascagoula, MS": [30.3658, -88.5561],
  "Pensacola, FL": [30.4213, -87.2169],
  "Panama City, FL": [30.1588, -85.6602],
  "New Orleans, LA": [29.9511, -90.0715],
}

export const DAMAGE_TYPES = [
  "Roof Damage",
  "Water Intrusion",
  "Structural Collapse",
  "Flooding",
  "Shingle Loss",
  "Downed Power Lines",
  "Wind Damage",
] as const

/** Small offset so several claims in one city do not stack on one pixel. */
export function jitter(base: [number, number], seed: number): [number, number] {
  const a = Math.sin(seed * 12.9898) * 43758.5453
  const b = Math.sin(seed * 78.233) * 12345.6789
  return [base[0] + ((a - Math.floor(a)) - 0.5) * 0.08, base[1] + ((b - Math.floor(b)) - 0.5) * 0.08]
}

function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000).toISOString()
}

type Seed = Omit<Claim, "id" | "lat" | "lng" | "receivedAt" | "severity" | "status"> & { ago: number }

// Report text is what the backend normalizer scores, so it carries the
// keywords that drive severity (total loss / tornado / roof damage / ...).
const SEED_CLAIMS: Seed[] = [
  { claimNumber: "CLM-4004", location: "Mobile, AL", damageType: "Roof Damage", ago: 4, report: "Policyholder reports roof damage after high winds, tarp needed, family sheltering in place." },
  { claimNumber: "CLM-4011", location: "Gulfport, MS", damageType: "Water Intrusion", ago: 9, report: "Water intrusion in living room, minor ceiling stains, no injuries." },
  { claimNumber: "CLM-4018", location: "Pensacola, FL", damageType: "Structural Collapse", ago: 15, report: "Severe structural failure, garage collapsed onto vehicle. Possible total loss." },
  { claimNumber: "CLM-4023", location: "Biloxi, MS", damageType: "Shingle Loss", ago: 21, report: "Moderate shingle loss on north face of roof, attic dry." },
  { claimNumber: "CLM-4031", location: "New Orleans, LA", damageType: "Flooding", ago: 27, report: "911 transcript: tornado touchdown on street, multiple homes damaged, caller trapped in bathroom." },
  { claimNumber: "CLM-4037", location: "Pascagoula, MS", damageType: "Wind Damage", ago: 34, report: "Fence down and patio furniture missing, cosmetic siding scuffs." },
  { claimNumber: "CLM-4042", location: "Gulf Shores, AL", damageType: "Roof Damage", ago: 41, report: "Tree limb punched through roof, roof damage over bedroom, rain entering." },
  { claimNumber: "CLM-4049", location: "Panama City, FL", damageType: "Downed Power Lines", ago: 52, report: "Downed power lines across driveway, home intact, power out." },
]

export function seedClaims(): Claim[] {
  return SEED_CLAIMS.map((s, i) => {
    const [lat, lng] = jitter(LOCATIONS[s.location], i + 1)
    const { ago, ...rest } = s
    return { ...rest, id: `c${i + 1}`, lat, lng, receivedAt: minutesAgo(ago), severity: null, status: "unscored" }
  })
}

export function seedUnits(): Unit[] {
  const u = (id: string, name: string, type: Unit["type"], location: string): Unit => {
    const [lat, lng] = LOCATIONS[location]
    return { id, name, type, status: "Idle", location: `${location} staging`, lat: lat + 0.12, lng: lng - 0.05 }
  }
  return [
    u("CRU-01", "Mobile Command Unit 1", "Command Vehicle", "Mobile, AL"),
    u("CRU-02", "Mobile Command Unit 2", "Command Vehicle", "Gulfport, MS"),
    u("ADJ-01", "Claims Adjuster Team A", "Adjuster Team", "Pensacola, FL"),
    u("ADJ-02", "Claims Adjuster Team B", "Adjuster Team", "New Orleans, LA"),
    u("SUP-01", "Supply Truck Delta", "Supply Vehicle", "Biloxi, MS"),
  ]
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function clockTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
