"use client"

import { useMemo, useState } from "react"
import { ArrowRight, Crosshair, Radio, Search, SearchX, Truck, Users, X } from "lucide-react"
import type { Claim, Unit } from "@/lib/api"
import { fmtDuration, pct } from "@/lib/data"
import { unitTone } from "@/lib/tokens"
import { Badge, Button, EmptyState, Segmented, Skeleton, StreakPips, cn } from "./ui"

type Props = {
  open: boolean
  onClose: () => void
  units: Unit[]
  claims: Claim[]
  timeScale: number
  threshold: number
  commitStreak: number
  selectedClaim: Claim | null
  selectedUnitId: string | null
  onSelectUnit: (id: string) => void
  onClearClaim: () => void
  onDispatch: (unitId: string, claimId: string) => void
  onRecall: (unitId: string) => void
  loading: boolean
}

const TYPE_ICON = { "Command Vehicle": Radio, "Adjuster Team": Users, "Supply Vehicle": Truck } as const
type Filter = "all" | "idle" | "active"

export function Sidebar(p: Props) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const counts = useMemo(
    () => ({
      all: p.units.length,
      idle: p.units.filter((u) => u.status === "Idle").length,
      active: p.units.filter((u) => u.status !== "Idle").length,
    }),
    [p.units],
  )
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return p.units.filter((u) => {
      if (filter === "idle" && u.status !== "Idle") return false
      if (filter === "active" && u.status === "Idle") return false
      return !q || `${u.id} ${u.name} ${u.type} ${u.location}`.toLowerCase().includes(q)
    })
  }, [p.units, query, filter])

  const claimById = useMemo(() => new Map(p.claims.map((c) => [c.id, c])), [p.claims])
  const target = p.selectedClaim && p.selectedClaim.status === "open" && p.selectedClaim.lat !== null ? p.selectedClaim : null

  return (
    <aside
      className={cn(
        p.open ? "flex" : "hidden",
        "absolute inset-y-0 left-0 z-30 w-[300px] shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-black/60",
        "lg:static lg:shadow-none",
      )}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800/80 px-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-medium text-zinc-200">Fleet</h2>
          <span className="num text-zinc-500">{p.units.length}</span>
        </div>
        <Button variant="ghost" size="icon-sm" icon={X} onClick={p.onClose} className="lg:hidden" aria-label="Close" />
      </div>

      <div className="shrink-0 space-y-2 border-b border-zinc-800/80 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search units"
            className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-900/50 pl-8 pr-2 text-[13px] text-zinc-200 outline-none transition-colors duration-150 placeholder:text-zinc-600 hover:border-zinc-700 focus:border-zinc-500"
          />
        </div>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          items={[
            { id: "all", label: "All", count: counts.all },
            { id: "idle", label: "Idle", count: counts.idle },
            { id: "active", label: "Active", count: counts.active },
          ]}
        />
      </div>

      {target && (
        <div className="shrink-0 border-b border-zinc-800/80 p-3 animate-fade-in">
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-zinc-500">
                <Crosshair className="h-3 w-3" /> Manual dispatch target
              </span>
              <Button variant="ghost" size="icon-sm" icon={X} onClick={p.onClearClaim} className="-mr-1 h-5 w-5" aria-label="Clear target" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num text-zinc-100">{target.claim_number}</span>
              <span className="truncate text-xs text-zinc-400">{target.location}</span>
            </div>
            <p className="mt-1 text-2xs text-zinc-500">
              {target.prediction
                ? `Solver suggests ${target.prediction.unit_id} at ${pct(target.prediction.confidence)}. Pick any idle unit to override.`
                : "No solver prediction yet. Pick an idle unit to dispatch."}
            </p>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {p.loading ? (
          <div className="space-y-1 p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-1 py-2">
                <Skeleton className="h-7 w-7" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState icon={SearchX} title="No units match" description="Try a different search term or filter." />
        ) : (
          <ul className="space-y-px">
            {visible.map((u) => {
              const Icon = TYPE_ICON[u.type]
              const assigned = u.assigned_claim ? claimById.get(u.assigned_claim) : undefined
              const predicted = u.prediction ? claimById.get(u.prediction.claim_id) : undefined
              const selected = u.id === p.selectedUnitId
              return (
                <li key={u.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => p.onSelectUnit(u.id)}
                    onKeyDown={(e) => e.key === "Enter" && p.onSelectUnit(u.id)}
                    className={cn(
                      "group rounded-md px-2 py-2 transition-colors duration-150",
                      selected ? "bg-zinc-800/70" : "hover:bg-zinc-900",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                        <Icon className="h-3.5 w-3.5 text-zinc-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-zinc-200">{u.name}</div>
                        <div className="truncate text-2xs text-zinc-500">
                          <span className="font-mono">{u.id}</span>
                          {!assigned && <> · {u.location}</>}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {u.status === "Idle" && target ? (
                          <Button
                            variant="primary"
                            size="sm"
                            className="h-6 px-2 text-2xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              p.onDispatch(u.id, target.id)
                            }}
                          >
                            Dispatch
                          </Button>
                        ) : u.status !== "Idle" ? (
                          <>
                            <Badge tone={unitTone(u.status)} className="group-hover:hidden">
                              {u.status}
                            </Badge>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="hidden h-6 px-2 text-2xs group-hover:inline-flex"
                              onClick={(e) => {
                                e.stopPropagation()
                                p.onRecall(u.id)
                              }}
                            >
                              Recall
                            </Button>
                          </>
                        ) : (
                          <Badge tone="success">Idle</Badge>
                        )}
                      </div>
                    </div>

                    {assigned && (
                      <div className="ml-[38px] mt-1.5 flex items-center gap-2 text-2xs">
                        <ArrowRight className={cn("h-3 w-3 shrink-0", u.status === "En Route" ? "text-amber-400" : "text-blue-400")} />
                        <span className="num text-zinc-100">{assigned.claim_number}</span>
                        <span className="truncate text-zinc-400">{assigned.location}</span>
                        <span className={cn("num ml-auto shrink-0", u.status === "En Route" ? "text-amber-400" : "text-blue-400")}>
                          {u.status === "En Route"
                            ? `ETA ${fmtDuration(u.eta_s, p.timeScale)}`
                            : `on scene · ${fmtDuration(u.service_s, p.timeScale)}`}
                        </span>
                      </div>
                    )}

                    {u.status === "Idle" && u.prediction && predicted && (
                      <div className="ml-[38px] mt-1.5 flex items-center gap-2 text-2xs text-zinc-500" title="Predicted next assignment (not yet dispatched)">
                        <span className="shrink-0 text-zinc-600">next?</span>
                        <span className="num truncate text-zinc-300">{predicted.claim_number}</span>
                        <span className="truncate">{predicted.location}</span>
                        <span className="ml-auto flex shrink-0 items-center gap-1.5">
                          <span className={cn("num", u.prediction.confidence >= p.threshold ? "text-emerald-400" : "text-zinc-400")}>
                            {pct(u.prediction.confidence)}
                          </span>
                          <StreakPips streak={u.prediction.streak} of={p.commitStreak} />
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!target && counts.idle > 0 && (
        <p className="shrink-0 border-t border-zinc-800/80 px-3 py-2.5 text-2xs text-zinc-500">
          Select an open claim to dispatch a unit manually.
        </p>
      )}
    </aside>
  )
}
