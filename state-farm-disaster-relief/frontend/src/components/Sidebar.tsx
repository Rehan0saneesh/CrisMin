"use client"

import { useMemo, useState } from "react"
import { Crosshair, Radio, Search, Truck, Users, X, SearchX } from "lucide-react"
import type { Claim, Unit } from "@/lib/data"
import { unitTone } from "@/lib/tokens"
import { Badge, Button, EmptyState, Segmented, cn } from "./ui"

type Props = {
  open: boolean
  onClose: () => void
  units: Unit[]
  claims: Claim[]
  selectedClaim: Claim | null
  selectedUnitId: string | null
  onSelectUnit: (id: string) => void
  onClearClaim: () => void
  onDispatch: (unitId: string, claimId: string) => void
  onRecall: (unitId: string) => void
}

const TYPE_ICON = { "Command Vehicle": Radio, "Adjuster Team": Users, "Supply Vehicle": Truck } as const
type Filter = "all" | "idle" | "active"

export function Sidebar({
  open,
  onClose,
  units,
  claims,
  selectedClaim,
  selectedUnitId,
  onSelectUnit,
  onClearClaim,
  onDispatch,
  onRecall,
}: Props) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const counts = useMemo(
    () => ({ all: units.length, idle: units.filter((u) => u.status === "Idle").length, active: units.filter((u) => u.status !== "Idle").length }),
    [units],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return units.filter((u) => {
      if (filter === "idle" && u.status !== "Idle") return false
      if (filter === "active" && u.status === "Idle") return false
      return !q || `${u.id} ${u.name} ${u.type} ${u.location}`.toLowerCase().includes(q)
    })
  }, [units, query, filter])

  const claimById = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims])
  const target = selectedClaim && selectedClaim.status !== "assigned" ? selectedClaim : null

  return (
    <aside
      className={cn(
        open ? "flex" : "hidden",
        "absolute inset-y-0 left-0 z-30 w-[288px] shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-black/60",
        "lg:static lg:shadow-none",
      )}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800/80 px-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-medium text-zinc-200">Fleet</h2>
          <span className="num text-zinc-500">{units.length}</span>
        </div>
        <Button variant="ghost" size="icon-sm" icon={X} onClick={onClose} className="lg:hidden" aria-label="Close" />
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
                <Crosshair className="h-3 w-3" /> Dispatch target
              </span>
              <Button variant="ghost" size="icon-sm" icon={X} onClick={onClearClaim} className="-mr-1 h-5 w-5" aria-label="Clear target" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num text-zinc-100">{target.claimNumber}</span>
              <span className="truncate text-xs text-zinc-400">{target.location}</span>
            </div>
            <p className="mt-1 text-2xs text-zinc-500">Choose an idle unit below to dispatch.</p>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {visible.length === 0 ? (
          <EmptyState icon={SearchX} title="No units match" description="Try a different search term or filter." />
        ) : (
          <ul className="space-y-px">
            {visible.map((u) => {
              const Icon = TYPE_ICON[u.type]
              const assigned = u.assignedClaimId ? claimById.get(u.assignedClaimId) : undefined
              const selected = u.id === selectedUnitId
              return (
                <li key={u.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectUnit(u.id)}
                    onKeyDown={(e) => e.key === "Enter" && onSelectUnit(u.id)}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors duration-150",
                      selected ? "bg-zinc-800/70" : "hover:bg-zinc-900",
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                      <Icon className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-zinc-200">{u.name}</div>
                      <div className="flex items-center gap-1.5 truncate text-2xs text-zinc-500">
                        <span className="font-mono">{u.id}</span>
                        <span className="text-zinc-700">·</span>
                        <span className="truncate">{assigned ? <span className="font-mono">{assigned.claimNumber}</span> : u.location}</span>
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
                            onDispatch(u.id, target.id)
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
                              onRecall(u.id)
                            }}
                          >
                            Recall
                          </Button>
                        </>
                      ) : (
                        <Badge tone={unitTone(u.status)}>{u.status}</Badge>
                      )}
                    </div>
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
