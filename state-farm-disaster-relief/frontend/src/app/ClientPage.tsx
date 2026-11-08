"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { WifiOff, X } from "lucide-react"
import { TopNav } from "@/components/TopNav"
import { Sidebar } from "@/components/Sidebar"
import { KPIStrip } from "@/components/KPIStrip"
import { MapComponent } from "@/components/MapComponent"
import { ClaimsTable } from "@/components/ClaimsTable"
import { OpsPanel } from "@/components/OpsPanel"
import { IngestDialog } from "@/components/IngestDialog"
import {
  API_URL,
  type OpsEvent,
  type OpsState,
  dispatchUnit,
  getOpsState,
  ingestReport,
  recallUnit,
  resetScenario,
  setAutopilot,
  setFeed,
  solveNow,
} from "@/lib/api"

const POLL_MS = 1_000

export default function ClientPage() {
  const [ops, setOps] = useState<OpsState | null>(null)
  const [events, setEvents] = useState<OpsEvent[]>([])
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1024)
  const [ingestOpen, setIngestOpen] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [pending, setPending] = useState<string | null>(null) // in-flight action label
  const [toast, setToast] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  const lastEventId = useRef(0)
  const epoch = useRef<number | null>(null)
  const knownClaims = useRef<Set<string> | null>(null)
  const pollNow = useRef<() => void>(() => {})

  // ---- Live state polling ---------------------------------------------
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      clearTimeout(timer)
      const t0 = performance.now()
      try {
        const s = await getOpsState(lastEventId.current)
        if (cancelled) return
        setLatencyMs(Math.round(performance.now() - t0))
        if (epoch.current !== null && epoch.current !== s.epoch) {
          // Backend restarted or scenario reset: resync from scratch.
          epoch.current = s.epoch
          lastEventId.current = 0
          knownClaims.current = null
          setEvents([])
          setSelectedClaimId(null)
          setSelectedUnitId(null)
          timer = setTimeout(poll, 0)
          return
        }
        epoch.current = s.epoch
        if (s.events.length) {
          lastEventId.current = s.events[s.events.length - 1].id
          setEvents((prev) => [...s.events.slice().reverse(), ...prev].slice(0, 300))
        }
        // Flash rows for claims that appeared since the last poll.
        const ids = new Set(s.claims.map((c) => c.id))
        if (knownClaims.current) {
          const fresh = s.claims.filter((c) => !knownClaims.current!.has(c.id)).map((c) => c.id)
          if (fresh.length) setNewIds(new Set(fresh))
        }
        knownClaims.current = ids
        setOps(s)
        setBackendOnline(true)
      } catch {
        if (cancelled) return
        setBackendOnline(false)
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS)
    }
    pollNow.current = () => {
      clearTimeout(timer)
      poll()
    }
    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  // ---- Actions ------------------------------------------------------------
  const act = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    setPending(label)
    try {
      await fn()
    } catch (err) {
      setToast((err as Error).message)
    } finally {
      setPending(null)
      pollNow.current()
    }
  }, [])

  const handleIngest = useCallback(async (report: string, location: string, damageType: string) => {
    setIsIngesting(true)
    try {
      await ingestReport(report, location, damageType)
      pollNow.current()
      return true
    } catch (err) {
      setToast((err as Error).message)
      return false
    } finally {
      setIsIngesting(false)
    }
  }, [])

  const autopilot = ops?.control.autopilot ?? false
  const toggleAutopilot = useCallback(() => act("autopilot", () => setAutopilot(!autopilot)), [act, autopilot])
  const toggleFeed = useCallback(
    () => act("feed", () => setFeed(!(ops?.control.feed_enabled ?? true))),
    [act, ops?.control.feed_enabled],
  )
  const handleSolve = useCallback(() => act("solve", solveNow), [act])
  const handleReset = useCallback(() => act("reset", resetScenario), [act])
  const handleDispatch = useCallback(
    (unitId: string, claimId: string) => act("dispatch", () => dispatchUnit(unitId, claimId)),
    [act],
  )
  const handleRecall = useCallback((unitId: string) => act("recall", () => recallUnit(unitId)), [act])

  // ---- Selection & shortcuts ---------------------------------------------
  const selectClaim = useCallback((id: string) => {
    setSelectedClaimId((cur) => (cur === id ? null : id))
    setSelectedUnitId(null)
  }, [])
  const selectUnit = useCallback((id: string) => setSelectedUnitId((cur) => (cur === id ? null : id)), [])

  const shortcuts = useRef({ toggleAutopilot, handleSolve })
  shortcuts.current = { toggleAutopilot, handleSolve }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "Escape") {
        setSelectedClaimId(null)
        setSelectedUnitId(null)
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault()
        setIngestOpen(true)
      } else if (e.key === "s" || e.key === "S") {
        shortcuts.current.handleSolve()
      } else if (e.key === "a" || e.key === "A") {
        shortcuts.current.toggleAutopilot()
      } else if (e.key === "[") {
        setSidebarOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const claims = useMemo(() => ops?.claims ?? [], [ops])
  const units = useMemo(() => ops?.units ?? [], [ops])
  const selectedClaim = useMemo(() => claims.find((c) => c.id === selectedClaimId) ?? null, [claims, selectedClaimId])
  const loading = ops === null && backendOnline !== false

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <TopNav
        backendOnline={backendOnline}
        latencyMs={latencyMs}
        nemotron={ops?.nemotron ?? null}
        autopilot={autopilot}
        threshold={ops?.control.threshold ?? 0.9}
        busy={pending !== null || isIngesting || (ops?.nemotron.queue ?? 0) > 0}
        solving={pending === "solve"}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onIngest={() => setIngestOpen(true)}
        onToggleAutopilot={toggleAutopilot}
        onSolve={handleSolve}
        onReset={handleReset}
      />

      {backendOnline === false && (
        <div className="flex h-9 shrink-0 items-center gap-2.5 border-b border-critical/20 bg-critical/[0.06] px-4 text-xs text-zinc-300">
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <span className="truncate">
            Backend unreachable at <span className="font-mono text-zinc-100">{API_URL}</span>
            <span className="text-zinc-500"> · start it with </span>
            <span className="font-mono text-zinc-100">uvicorn app.main:app --port 8000</span>
            <span className="text-zinc-500">{ops ? " · showing last known state" : ""}</span>
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
          timeScale={ops?.control.time_scale ?? 60}
          threshold={ops?.control.threshold ?? 0.9}
          commitStreak={ops?.control.commit_streak ?? 3}
          selectedClaim={selectedClaim}
          selectedUnitId={selectedUnitId}
          onSelectUnit={selectUnit}
          onClearClaim={() => setSelectedClaimId(null)}
          onDispatch={handleDispatch}
          onRecall={handleRecall}
          loading={loading}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:overflow-hidden">
          <KPIStrip ops={ops} loading={loading} />

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)_minmax(0,clamp(240px,36%,340px))] 2xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="h-[420px] min-h-0 lg:h-auto">
              <MapComponent
                claims={claims}
                units={units}
                predictions={ops?.predictions ?? []}
                timeScale={ops?.control.time_scale ?? 60}
                threshold={ops?.control.threshold ?? 0.9}
                selectedClaimId={selectedClaimId}
                selectedUnitId={selectedUnitId}
                onSelectClaim={selectClaim}
                onSelectUnit={selectUnit}
              />
            </div>
            <div className="h-[420px] min-h-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto">
              <OpsPanel
                ops={ops}
                events={events}
                onToggleAutopilot={toggleAutopilot}
                onToggleFeed={toggleFeed}
                onSelectClaim={selectClaim}
              />
            </div>
            <div className="h-[380px] min-h-0 lg:h-auto">
              <ClaimsTable
                claims={claims}
                units={units}
                timeScale={ops?.control.time_scale ?? 60}
                threshold={ops?.control.threshold ?? 0.9}
                selectedId={selectedClaimId}
                onSelect={selectClaim}
                onNewReport={() => setIngestOpen(true)}
                loading={loading}
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

      {toast && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-[1100] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 shadow-2xl shadow-black/50 animate-fade-in"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-critical" />
          <span className="truncate">{toast}</span>
          <button onClick={() => setToast(null)} className="text-zinc-500 transition-colors duration-150 hover:text-zinc-200" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
