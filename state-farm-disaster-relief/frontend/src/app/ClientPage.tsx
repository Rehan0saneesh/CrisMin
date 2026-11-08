"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { WifiOff } from "lucide-react"
import { TopNav } from "@/components/TopNav"
import { Sidebar } from "@/components/Sidebar"
import { KPIStrip, type KPIData } from "@/components/KPIStrip"
import { MapComponent } from "@/components/MapComponent"
import { ClaimsTable } from "@/components/ClaimsTable"
import { OpsPanel } from "@/components/OpsPanel"
import { IngestDialog } from "@/components/IngestDialog"
import { API_URL, checkHealth, getDeploymentStatus, ingestTelemetry, runOptimization } from "@/lib/api"
import {
  type Claim,
  type LogEntry,
  type LogLevel,
  type Unit,
  LOCATIONS,
  clockTime,
  distanceKm,
  jitter,
  seedClaims,
  seedUnits,
} from "@/lib/data"

const HEALTH_POLL_MS = 10_000
const TRAVEL_MS = 4_000

type SolverRun = { energy: number; ms: number; nodes: number }

export default function ClientPage() {
  const [claims, setClaims] = useState<Claim[]>(seedClaims)
  const [units, setUnits] = useState<Unit[]>(seedUnits)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1024)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [ingestOpen, setIngestOpen] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isScoring, setIsScoring] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [lastRun, setLastRun] = useState<SolverRun | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  // Refs mirror state so async handlers always read current values.
  const claimsRef = useRef(claims)
  const unitsRef = useRef(units)
  claimsRef.current = claims
  unitsRef.current = units
  const logSeq = useRef(0)
  const claimSeq = useRef(4050)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const autoScored = useRef(false)

  const log = useCallback((level: LogLevel, msg: string) => {
    setLogs((prev) => [{ id: ++logSeq.current, ts: clockTime(new Date()), level, msg }, ...prev].slice(0, 200))
  }, [])

  // ---- Backend health ---------------------------------------------------
  useEffect(() => {
    let cancelled = false
    let last: boolean | null = null
    const poll = async () => {
      let ok = false
      const t0 = performance.now()
      try {
        await checkHealth()
        ok = true
        if (!cancelled) setLatencyMs(Math.round(performance.now() - t0))
      } catch {
        ok = false
      }
      if (cancelled) return
      if (ok !== last) {
        log(ok ? "success" : "error", ok ? `Backend connected (${API_URL})` : `Backend unreachable at ${API_URL}`)
        last = ok
      }
      setBackendOnline(ok)
    }
    log("info", "Dashboard initialized · monitoring Gulf Coast")
    poll()
    const id = setInterval(poll, HEALTH_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [log])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // ---- Unit movement ----------------------------------------------------
  const sendUnit = useCallback(
    (unitId: string, claim: Claim) => {
      setUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, status: "En Route", assignedClaimId: claim.id } : u)),
      )
      const t = setTimeout(() => {
        const u = unitsRef.current.find((x) => x.id === unitId)
        if (!u || u.assignedClaimId !== claim.id) return // recalled or reassigned meanwhile
        setUnits((prev) =>
          prev.map((x) =>
            x.id === unitId && x.assignedClaimId === claim.id
              ? { ...x, status: "Deployed", lat: claim.lat, lng: claim.lng, location: claim.location }
              : x,
          ),
        )
        log("success", `${unitId} on scene · ${claim.claimNumber} ${claim.location}`)
      }, TRAVEL_MS)
      timers.current.push(t)
    },
    [log],
  )

  // ---- Optimization -----------------------------------------------------
  /**
   * Sends every open claim to the QUBO solver. The backend returns a severity
   * score and a deploy bit per claim (same order as the request). With
   * `dispatch`, idle units go to the selected claims, highest severity first,
   * nearest unit wins.
   */
  const optimize = useCallback(
    async (dispatch: boolean) => {
      const open = claimsRef.current.filter((c) => c.status !== "assigned")
      if (open.length === 0) {
        log("info", "No open claims to optimize")
        return
      }
      const idle = unitsRef.current.filter((u) => u.status === "Idle")
      const setBusy = dispatch ? setIsOptimizing : setIsScoring
      setBusy(true)
      if (dispatch) log("info", `Compiling QUBO · ${open.length} nodes · ${idle.length} units available`)
      else log("info", `Scoring ${open.length} claims via normalizer`)

      const t0 = performance.now()
      try {
        const result = await runOptimization(
          open.map((c) => c.report),
          Math.max(1, idle.length),
        )
        const ms = Math.round(performance.now() - t0)
        setLastRun({ energy: result.best_energy, ms, nodes: result.total_nodes })

        const zoneFor = new Map(open.map((c, i) => [c.id, result.deployed_zones[i]]))
        const assignments = new Map<string, string>() // claimId -> unitId
        if (dispatch) {
          const picked = open
            .filter((c) => zoneFor.get(c.id)?.deployed)
            .sort((a, b) => (zoneFor.get(b.id)!.severity_score - zoneFor.get(a.id)!.severity_score))
          const pool = [...idle]
          for (const c of picked) {
            if (pool.length === 0) break
            pool.sort((a, b) => distanceKm(a, c) - distanceKm(b, c))
            assignments.set(c.id, pool.shift()!.id)
          }
        }

        setClaims((prev) =>
          prev.map((c) => {
            const z = zoneFor.get(c.id)
            if (!z) return c
            const unitId = assignments.get(c.id)
            const status: Claim["status"] = unitId ? "assigned" : dispatch && z.deployed ? "queued" : "unassigned"
            return { ...c, severity: z.severity_score, backendId: z.claim_id, status, assignedUnitId: unitId }
          }),
        )

        if (dispatch) {
          const selected = result.deployed_zones.filter((z) => z.deployed).length
          log("success", `Solver complete · energy ${result.best_energy.toFixed(2)} · ${selected}/${result.total_nodes} zones selected · ${ms} ms`)
          for (const [claimId, unitId] of Array.from(assignments)) {
            const c = open.find((x) => x.id === claimId)!
            const sev = zoneFor.get(claimId)!.severity_score
            log(sev >= 8 ? "alert" : "info", `${unitId} dispatched → ${c.claimNumber} ${c.location} · severity ${sev}`)
            sendUnit(unitId, c)
          }
          const queued = selected - assignments.size
          if (queued > 0) log("alert", `${queued} selected claim(s) queued · no idle units`)
          getDeploymentStatus()
            .then((s) => log("info", `Backend status · ${s.deployed_units} deployed / ${s.pending_units} pending`))
            .catch(() => {})
        } else {
          const crit = result.deployed_zones.filter((z) => z.severity_score >= 8).length
          log("success", `Scored ${result.total_nodes} claims · ${crit} critical`)
        }
      } catch (err) {
        log("error", `Optimization failed · ${(err as Error).message}`)
      } finally {
        setBusy(false)
      }
    },
    [log, sendUnit],
  )

  // Score the seed claims once the backend is first reachable.
  useEffect(() => {
    if (backendOnline && !autoScored.current) {
      autoScored.current = true
      optimize(false)
    }
  }, [backendOnline, optimize])

  // ---- Ingest -----------------------------------------------------------
  const handleIngest = useCallback(
    async (report: string, location: string, damageType: string) => {
      setIsIngesting(true)
      try {
        const res = await ingestTelemetry([report])
        const seq = ++claimSeq.current
        const [lat, lng] = jitter(LOCATIONS[location], seq)
        const claim: Claim = {
          id: `c${seq}`,
          claimNumber: `CLM-${seq}`,
          backendId: res.claim_ids[0],
          location,
          damageType,
          report,
          lat,
          lng,
          receivedAt: new Date().toISOString(),
          severity: null,
          status: "unscored",
        }
        setClaims((prev) => [claim, ...prev])
        setNewIds((prev) => new Set(prev).add(claim.id))
        setSelectedClaimId(claim.id)
        log("info", `Telemetry ingested · ${claim.claimNumber} ${location} · ${res.zones_normalized} zone normalized`)
        return true
      } catch (err) {
        log("error", `Ingest failed · ${(err as Error).message}`)
        return false
      } finally {
        setIsIngesting(false)
      }
    },
    [log],
  )

  // ---- Manual dispatch / recall ----------------------------------------
  const handleDispatch = useCallback(
    (unitId: string, claimId: string) => {
      const claim = claimsRef.current.find((c) => c.id === claimId)
      if (!claim) return
      setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status: "assigned", assignedUnitId: unitId } : c)))
      log("info", `${unitId} manually dispatched → ${claim.claimNumber} ${claim.location}`)
      sendUnit(unitId, claim)
    },
    [log, sendUnit],
  )

  const handleRecall = useCallback(
    (unitId: string) => {
      const unit = unitsRef.current.find((u) => u.id === unitId)
      if (!unit) return
      const claimId = unit.assignedClaimId
      setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, status: "Idle", assignedClaimId: undefined } : u)))
      if (claimId) {
        setClaims((prev) =>
          prev.map((c) => (c.id === claimId ? { ...c, status: c.severity === null ? "unscored" : "unassigned", assignedUnitId: undefined } : c)),
        )
      }
      log("alert", `${unitId} recalled · now idle`)
    },
    [log],
  )

  const handleReset = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setClaims(seedClaims())
    setUnits(seedUnits())
    setSelectedClaimId(null)
    setSelectedUnitId(null)
    setLastRun(null)
    setNewIds(new Set())
    log("info", "Scenario reset")
    autoScored.current = false
    // Re-score on the next render once state has been replaced.
    setTimeout(() => {
      if (backendOnline) {
        autoScored.current = true
        optimize(false)
      }
    }, 0)
  }, [backendOnline, log, optimize])

  const openIngest = useCallback(() => setIngestOpen(true), [])

  // ---- Selection --------------------------------------------------------
  const selectClaim = useCallback((id: string) => {
    setSelectedClaimId((cur) => (cur === id ? null : id))
    setSelectedUnitId(null)
  }, [])
  const selectUnit = useCallback((id: string) => {
    setSelectedUnitId((cur) => (cur === id ? null : id))
  }, [])

  // Lets the keyboard shortcut call the latest optimize without re-binding listeners.
  const optimizeRef = useRef<(() => void) | null>(null)
  optimizeRef.current = backendOnline && !isOptimizing ? () => optimize(true) : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "Escape") {
        setSelectedClaimId(null)
        setSelectedUnitId(null)
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault()
        setIngestOpen(true)
      } else if ((e.key === "o" || e.key === "O") && optimizeRef.current) {
        e.preventDefault()
        optimizeRef.current()
      } else if (e.key === "[") {
        setSidebarOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const selectedClaim = useMemo(() => claims.find((c) => c.id === selectedClaimId) ?? null, [claims, selectedClaimId])

  const kpis: KPIData = useMemo(
    () => ({
      openClaims: claims.filter((c) => c.status !== "assigned").length,
      totalClaims: claims.length,
      critical: claims.filter((c) => (c.severity ?? 0) >= 8).length,
      unscored: claims.filter((c) => c.severity === null).length,
      unitsBusy: units.filter((u) => u.status !== "Idle").length,
      unitsTotal: units.length,
      queued: claims.filter((c) => c.status === "queued").length,
      solverEnergy: lastRun?.energy ?? null,
      solverMs: lastRun?.ms ?? null,
      solverNodes: lastRun?.nodes ?? null,
    }),
    [claims, units, lastRun],
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <TopNav
        backendOnline={backendOnline}
        latencyMs={latencyMs}
        busy={isOptimizing || isScoring || isIngesting}
        isOptimizing={isOptimizing}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onIngest={openIngest}
        onOptimize={() => optimize(true)}
        onReset={handleReset}
      />

      {backendOnline === false && (
        <div className="flex h-9 shrink-0 items-center gap-2.5 border-b border-critical/20 bg-critical/[0.06] px-4 text-xs text-zinc-300">
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <span className="truncate">
            Backend unreachable at <span className="font-mono text-zinc-100">{API_URL}</span>
            <span className="text-zinc-500"> · start it with </span>
            <span className="font-mono text-zinc-100">uvicorn app.main:app --port 8000</span>
            <span className="text-zinc-500"> · scoring and dispatch are paused</span>
          </span>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <div className="absolute inset-0 z-20 bg-black/50 animate-fade-in lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          units={units}
          claims={claims}
          selectedClaim={selectedClaim}
          selectedUnitId={selectedUnitId}
          onSelectUnit={selectUnit}
          onClearClaim={() => setSelectedClaimId(null)}
          onDispatch={handleDispatch}
          onRecall={handleRecall}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:overflow-hidden">
          <KPIStrip data={kpis} loading={isScoring} />

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)_minmax(0,clamp(240px,36%,340px))] 2xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="h-[420px] min-h-0 lg:h-auto">
              <MapComponent
                claims={claims}
                units={units}
                selectedClaimId={selectedClaimId}
                selectedUnitId={selectedUnitId}
                onSelectClaim={selectClaim}
                onSelectUnit={selectUnit}
                isOptimizing={isOptimizing}
              />
            </div>
            <div className="h-[380px] min-h-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto">
              <OpsPanel logs={logs} units={units} claims={claims} />
            </div>
            <div className="h-[360px] min-h-0 lg:h-auto">
              <ClaimsTable
                claims={claims}
                selectedId={selectedClaimId}
                onSelect={selectClaim}
                onNewReport={openIngest}
                scoring={isScoring}
                newIds={newIds}
              />
            </div>
          </div>
        </main>
      </div>

      <IngestDialog
        open={ingestOpen}
        onClose={() => setIngestOpen(false)}
        onSubmit={handleIngest}
        submitting={isIngesting}
        disabled={backendOnline === false}
      />
    </div>
  )
}
