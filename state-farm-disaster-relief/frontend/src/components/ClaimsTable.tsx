"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Inbox, Plus, Search, SearchX, Sparkles } from "lucide-react"
import type { Claim, ClaimStatus, Unit } from "@/lib/api"
import { clockTime, fmtDuration, fmtSeverity, pct } from "@/lib/data"
import { severityTone, toneHex, type Tone } from "@/lib/tokens"
import { Badge, Button, ConfidenceBar, EmptyState, Pane, Skeleton, Tabs, cn } from "./ui"

type Props = {
  claims: Claim[]
  units: Unit[]
  timeScale: number
  threshold: number
  selectedId: string | null
  onSelect: (id: string) => void
  onNewReport: () => void
  loading: boolean
  newIds: Set<string>
}

type Filter = "active" | "critical" | "open" | "responding" | "resolved"

const STATUS: Record<ClaimStatus, { tone: Tone; label: string }> = {
  pending: { tone: "neutral", label: "Intake" },
  open: { tone: "neutral", label: "Open" },
  assigned: { tone: "warning", label: "En route" },
  on_scene: { tone: "accent", label: "On scene" },
  resolved: { tone: "success", label: "Resolved" },
}

const SEV_TEXT: Record<Tone, string> = {
  critical: "text-red-400",
  warning: "text-amber-400",
  success: "text-emerald-400",
  accent: "text-blue-400",
  neutral: "text-zinc-600",
}

function SeverityCell({ c }: { c: Claim }) {
  if (c.status === "pending") return <Skeleton className="h-1 w-full" />
  const tone = severityTone(c.severity)
  return (
    <div className="flex items-center gap-2.5" title={c.source === "nemotron" ? `Scored by ${c.model} · extraction confidence ${pct(c.extraction_confidence)}` : "Scored by keyword rules (Nemotron unavailable)"}>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${((c.severity ?? 0) / 10) * 100}%`, backgroundColor: toneHex(tone) }} />
      </div>
      <span className={cn("num w-6 text-right", SEV_TEXT[tone])}>{fmtSeverity(c.severity)}</span>
      {c.source === "nemotron" ? (
        <Sparkles className="h-3 w-3 shrink-0 text-zinc-500" aria-label="Nemotron" />
      ) : (
        <span className="h-3 w-3 shrink-0" />
      )}
    </div>
  )
}

function RouteCell({ c, unit, threshold, timeScale }: { c: Claim; unit?: Unit; threshold: number; timeScale: number }) {
  if (c.assigned_unit) {
    const how = c.dispatch_confidence !== null ? `Auto-dispatched at ${pct(c.dispatch_confidence)} confidence` : "Dispatched manually"
    return (
      <div className="flex items-center gap-2" title={how}>
        <span className="num text-zinc-100">{c.assigned_unit}</span>
        {c.status === "assigned" && unit?.eta_s != null && <span className="num text-amber-400">ETA {fmtDuration(unit.eta_s, timeScale)}</span>}
        {c.status === "on_scene" && unit?.service_s != null && <span className="num text-blue-400">{fmtDuration(unit.service_s, timeScale)} left</span>}
        {c.status === "resolved" && <span className="text-2xs text-zinc-500">done</span>}
      </div>
    )
  }
  if (c.prediction) {
    return (
      <div className="flex items-center gap-2" title={`Predicted ${c.prediction.unit_id} · ${pct(c.prediction.confidence)} confidence · ETA ${Math.round(c.prediction.eta_min)} min`}>
        <span className="num w-[52px] shrink-0 text-zinc-400">{c.prediction.unit_id}</span>
        <ConfidenceBar value={c.prediction.confidence} threshold={threshold} className="w-14" />
        <span className={cn("num w-9 text-right", c.prediction.confidence >= threshold ? "text-emerald-400" : "text-zinc-500")}>
          {pct(c.prediction.confidence)}
        </span>
      </div>
    )
  }
  if (c.status === "open" && c.lat === null) return <span className="text-2xs text-amber-400/80">location unresolved</span>
  return <span className="text-zinc-700">—</span>
}

const COLS = [
  { label: "Claim", cls: "w-[104px]" },
  { label: "Location", cls: "" },
  { label: "Damage", cls: "hidden xl:table-cell" },
  { label: "Received", cls: "w-[80px] hidden md:table-cell" },
  { label: "Severity", cls: "w-[132px]" },
  { label: "Unit · ETA / prediction", cls: "w-[184px]" },
  { label: "Status", cls: "w-[96px]" },
]

export function ClaimsTable({ claims, units, timeScale, threshold, selectedId, onSelect, onNewReport, loading, newIds }: Props) {
  const [filter, setFilter] = useState<Filter>("active")
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])
  const [query, setQuery] = useState("")
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const scrollRef = useRef<HTMLDivElement>(null)

  const counts = useMemo(
    () => ({
      active: claims.filter((c) => c.status !== "resolved").length,
      critical: claims.filter((c) => c.status !== "resolved" && (c.severity ?? 0) >= 8).length,
      open: claims.filter((c) => c.status === "open" || c.status === "pending").length,
      responding: claims.filter((c) => c.status === "assigned" || c.status === "on_scene").length,
      resolved: claims.filter((c) => c.status === "resolved").length,
    }),
    [claims],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return claims
      .filter((c) => {
        if (filter === "active" && c.status === "resolved") return false
        if (filter === "critical" && (c.status === "resolved" || (c.severity ?? 0) < 8)) return false
        if (filter === "open" && !(c.status === "open" || c.status === "pending")) return false
        if (filter === "responding" && !(c.status === "assigned" || c.status === "on_scene")) return false
        if (filter === "resolved" && c.status !== "resolved") return false
        return !q || `${c.claim_number} ${c.location ?? ""} ${c.damage_type ?? ""} ${c.assigned_unit ?? ""} ${c.report}`.toLowerCase().includes(q)
      })
      .sort((a, b) =>
        filter === "resolved"
          ? (b.resolved_at ?? 0) - (a.resolved_at ?? 0)
          : (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0) ||
            (b.severity ?? -1) - (a.severity ?? -1) ||
            a.received_at - b.received_at,
      )
  }, [claims, filter, query])

  useEffect(() => {
    const row = selectedId ? rowRefs.current.get(selectedId) : null
    const box = scrollRef.current
    if (!row || !box) return
    const head = 32
    const top = row.offsetTop - head
    const bottom = row.offsetTop + row.offsetHeight - box.clientHeight
    if (box.scrollTop > top) box.scrollTo({ top, behavior: "smooth" })
    else if (box.scrollTop < bottom) box.scrollTo({ top: bottom, behavior: "smooth" })
  }, [selectedId])

  return (
    <Pane className="h-full">
      <div className="flex h-10 shrink-0 items-stretch justify-between gap-3 border-b border-zinc-800/80 pl-2 pr-2">
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          items={[
            { id: "active", label: "Active", count: counts.active },
            { id: "critical", label: "Critical", count: counts.critical },
            { id: "open", label: "Open", count: counts.open },
            { id: "responding", label: "Responding", count: counts.responding },
            { id: "resolved", label: "Resolved", count: counts.resolved },
          ]}
          className="overflow-x-auto"
        />
        <div className="relative hidden items-center sm:flex">
          <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="h-7 w-36 rounded-md border border-zinc-800 bg-zinc-950 pl-7 pr-2 text-xs text-zinc-200 outline-none transition-[width,border-color] duration-150 placeholder:text-zinc-600 hover:border-zinc-700 focus:w-48 focus:border-zinc-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-px p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex h-9 items-center gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="ml-auto h-1 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : claims.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No claims yet"
          description="Reports from the feed, MQTT, or the New report dialog will appear here."
          action={
            <Button size="sm" icon={Plus} onClick={onNewReport}>
              New report
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nothing in this view"
          description={query ? `No claims match “${query}”.` : "No claims in this category right now."}
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilter("active")
                setQuery("")
              }}
            >
              Show all active
            </Button>
          }
        />
      ) : (
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
              <tr className="h-8 border-b border-zinc-800/80">
                {COLS.map((c) => (
                  <th key={c.label} className={cn("whitespace-nowrap px-3 text-2xs font-medium text-zinc-500", c.cls)}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const selected = c.id === selectedId
                const s = STATUS[c.status]
                return (
                  <tr
                    key={c.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(c.id, el)
                      else rowRefs.current.delete(c.id)
                    }}
                    onClick={() => onSelect(c.id)}
                    aria-selected={selected}
                    title={c.report}
                    className={cn(
                      "group h-9 cursor-pointer border-b border-zinc-800/50 transition-colors duration-150",
                      selected ? "bg-zinc-800/60" : "hover:bg-zinc-800/30",
                      c.status === "resolved" && "opacity-60",
                      newIds.has(c.id) && "animate-row-flash",
                    )}
                  >
                    <td className="relative whitespace-nowrap px-3">
                      <span className={cn("absolute inset-y-1.5 left-0 w-0.5 rounded-r transition-colors duration-150", selected ? "bg-zinc-100" : "bg-transparent")} />
                      <span className="num text-zinc-200">{c.claim_number}</span>
                    </td>
                    <td className="max-w-[160px] truncate px-3 text-[13px] text-zinc-300">
                      {c.location ?? <span className="text-zinc-600">{c.status === "pending" ? "Extracting…" : "Unknown"}</span>}
                    </td>
                    <td className="hidden max-w-[170px] truncate px-3 text-[13px] text-zinc-500 xl:table-cell">
                      {c.damage_type ?? <span className="text-zinc-700">—</span>}
                      {c.people_at_risk && <span className="ml-1.5 text-2xs text-red-400">· people at risk</span>}
                    </td>
                    <td className="hidden px-3 md:table-cell">
                      <span className="num text-zinc-500">{clockTime(c.received_at)}</span>
                    </td>
                    <td className="px-3">
                      <SeverityCell c={c} />
                    </td>
                    <td className="px-3">
                      <RouteCell c={c} unit={c.assigned_unit ? unitById.get(c.assigned_unit) : undefined} threshold={threshold} timeScale={timeScale} />
                    </td>
                    <td className="px-3">
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Pane>
  )
}
