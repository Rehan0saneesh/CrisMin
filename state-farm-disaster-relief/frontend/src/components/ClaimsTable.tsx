"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Inbox, Plus, Search, SearchX } from "lucide-react"
import type { Claim, ClaimStatus } from "@/lib/data"
import { clockTime } from "@/lib/data"
import { severityTone, toneHex, type Tone } from "@/lib/tokens"
import { Badge, Button, EmptyState, Pane, Skeleton, Tabs, cn } from "./ui"

type Props = {
  claims: Claim[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNewReport: () => void
  scoring: boolean
  newIds: Set<string>
}

type Filter = "all" | "critical" | "queued" | "open"

const STATUS: Record<ClaimStatus, { tone: Tone; label: string }> = {
  unscored: { tone: "neutral", label: "Unscored" },
  unassigned: { tone: "neutral", label: "Open" },
  queued: { tone: "warning", label: "Queued" },
  assigned: { tone: "accent", label: "Assigned" },
}

const SEV_TEXT: Record<Tone, string> = {
  critical: "text-red-400",
  warning: "text-amber-400",
  success: "text-emerald-400",
  accent: "text-blue-400",
  neutral: "text-zinc-600",
}

function SeverityCell({ severity, loading }: { severity: number | null; loading: boolean }) {
  if (loading && severity === null) return <Skeleton className="h-1 w-full" />
  const tone = severityTone(severity)
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${((severity ?? 0) / 10) * 100}%`, backgroundColor: toneHex(tone) }}
        />
      </div>
      <span className={cn("num w-5 text-right", SEV_TEXT[tone])}>{severity === null ? "—" : severity.toFixed(0)}</span>
    </div>
  )
}

const COLS = [
  { label: "Claim", cls: "w-[96px]" },
  { label: "Location", cls: "" },
  { label: "Damage", cls: "hidden md:table-cell" },
  { label: "Received", cls: "w-[88px]" },
  { label: "Severity", cls: "w-[140px]" },
  { label: "Status", cls: "w-[104px]" },
]

export function ClaimsTable({ claims, selectedId, onSelect, onNewReport, scoring, newIds }: Props) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const scrollRef = useRef<HTMLDivElement>(null)

  const counts = useMemo(
    () => ({
      all: claims.length,
      critical: claims.filter((c) => (c.severity ?? 0) >= 8).length,
      queued: claims.filter((c) => c.status === "queued").length,
      open: claims.filter((c) => c.status !== "assigned").length,
    }),
    [claims],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return claims
      .filter((c) => {
        if (filter === "critical" && (c.severity ?? 0) < 8) return false
        if (filter === "queued" && c.status !== "queued") return false
        if (filter === "open" && c.status === "assigned") return false
        return !q || `${c.claimNumber} ${c.location} ${c.damageType} ${c.assignedUnitId ?? ""}`.toLowerCase().includes(q)
      })
      .sort((a, b) => (b.severity ?? -1) - (a.severity ?? -1) || b.receivedAt.localeCompare(a.receivedAt))
  }, [claims, filter, query])

  // Keep the selected row in view. Vertical only, so the table never jumps sideways.
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
            { id: "all", label: "All claims", count: counts.all },
            { id: "critical", label: "Critical", count: counts.critical },
            { id: "queued", label: "Queued", count: counts.queued },
            { id: "open", label: "Open", count: counts.open },
          ]}
          className="overflow-x-auto"
        />
        <div className="relative hidden items-center sm:flex">
          <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="h-7 w-40 rounded-md border border-zinc-800 bg-zinc-950 pl-7 pr-2 text-xs text-zinc-200 outline-none transition-colors duration-150 placeholder:text-zinc-600 hover:border-zinc-700 focus:w-52 focus:border-zinc-500"
          />
        </div>
      </div>

      {claims.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No claims yet"
          description="Ingest a loss report to start scoring and dispatching."
          action={
            <Button size="sm" icon={Plus} onClick={onNewReport}>
              New report
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nothing matches this view"
          description={query ? `No claims match “${query}”.` : "No claims in this category right now."}
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilter("all")
                setQuery("")
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
              <tr className="h-8 border-b border-zinc-800/80">
                {COLS.map((c) => (
                  <th key={c.label} className={cn("px-3 text-2xs font-medium text-zinc-500", c.cls)}>
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
                    className={cn(
                      "group h-9 cursor-pointer border-b border-zinc-800/50 transition-colors duration-150",
                      selected ? "bg-zinc-800/60" : "hover:bg-zinc-800/30",
                      newIds.has(c.id) && "animate-row-flash",
                    )}
                  >
                    <td className="relative px-3">
                      <span
                        className={cn(
                          "absolute inset-y-1.5 left-0 w-0.5 rounded-r transition-colors duration-150",
                          selected ? "bg-zinc-100" : "bg-transparent",
                        )}
                      />
                      <span className="num text-zinc-200">{c.claimNumber}</span>
                    </td>
                    <td className="truncate px-3 text-[13px] text-zinc-300">{c.location}</td>
                    <td className="hidden max-w-[180px] truncate px-3 text-[13px] text-zinc-500 md:table-cell">{c.damageType}</td>
                    <td className="px-3">
                      <span className="num text-zinc-500">{clockTime(c.receivedAt)}</span>
                    </td>
                    <td className="px-3">
                      <SeverityCell severity={c.severity} loading={scoring} />
                    </td>
                    <td className="px-3">
                      {c.assignedUnitId ? (
                        <Badge tone="accent" mono>
                          {c.assignedUnitId}
                        </Badge>
                      ) : (
                        <Badge tone={s.tone}>{s.label}</Badge>
                      )}
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
