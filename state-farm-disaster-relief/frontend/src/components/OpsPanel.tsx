"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  CloudRain,
  Cpu,
  ListTree,
  Route,
  Siren,
  Tornado,
  Wind,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import type { OpsEvent, OpsState } from "@/lib/api"
import { clockTime, fmtDuration, fmtSeverity, pct } from "@/lib/data"
import { ConfidenceBar, EmptyState, Pane, Skeleton, StreakPips, Switch, Tabs, cn } from "./ui"

type Tab = "routing" | "activity" | "alerts" | "system"

const LEVEL: Record<OpsEvent["level"], { icon: LucideIcon; cls: string }> = {
  info: { icon: CircleDot, cls: "text-zinc-600" },
  success: { icon: CheckCircle2, cls: "text-emerald-500" },
  alert: { icon: AlertTriangle, cls: "text-amber-500" },
  error: { icon: XCircle, cls: "text-red-500" },
}

// Static NWS-style advisories for the demo scenario.
const ALERTS = [
  { type: "Tornado Warning", area: "Pensacola, FL", time: "10:14", icon: Tornado, severe: true },
  { type: "Hurricane Watch", area: "Gulf Coast", time: "10:09", icon: Wind, severe: true },
  { type: "Flash Flood Warning", area: "New Orleans, LA", time: "10:03", icon: CloudRain, severe: false },
  { type: "Severe Thunderstorm", area: "Mobile, AL", time: "09:58", icon: CloudRain, severe: false },
]

function KV({ k, v, mono = true }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="bg-zinc-950 px-3 py-2">
      <div className="text-2xs text-zinc-500">{k}</div>
      <div className={cn("mt-0.5 truncate text-[13px] text-zinc-100", mono && "font-mono tabular-nums")}>{v}</div>
    </div>
  )
}

function Routing({ ops, onToggleAutopilot, onToggleFeed, onSelectClaim }: {
  ops: OpsState
  onToggleAutopilot: () => void
  onToggleFeed: () => void
  onSelectClaim: (id: string) => void
}) {
  const s = ops.solver
  const c = ops.control
  const claimById = useMemo(() => new Map(ops.claims.map((x) => [x.id, x])), [ops.claims])
  // In motion: en route first (soonest arrival), then on scene (soonest free).
  const moving = useMemo(
    () =>
      ops.units
        .filter((u) => u.status !== "Idle" && u.assigned_claim && claimById.has(u.assigned_claim))
        .sort((a, b) =>
          a.status === b.status
            ? (a.eta_s ?? a.service_s ?? 0) - (b.eta_s ?? b.service_s ?? 0)
            : a.status === "En Route" ? -1 : 1,
        ),
    [ops.units, claimById],
  )

  return (
    <div className="space-y-5 p-3">
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-2xs font-medium uppercase tracking-wider text-zinc-500">In motion</h3>
          <span className="num text-zinc-600">{moving.length}/{ops.units.length} units</span>
        </div>
        {moving.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-800 px-3 py-4 text-center text-xs text-zinc-500">No units dispatched.</div>
        ) : (
          <ul className="space-y-px">
            {moving.map((u) => {
              const cl = claimById.get(u.assigned_claim!)!
              const enRoute = u.status === "En Route"
              return (
                <li key={u.id}>
                  <button
                    onClick={() => onSelectClaim(cl.id)}
                    className="w-full rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-zinc-900"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", enRoute ? "bg-warning" : "bg-accent")} />
                      <span className="num text-zinc-200">{u.id}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-zinc-600" />
                      <span className="num text-zinc-100">{cl.claim_number}</span>
                      <span className="truncate text-zinc-400">{cl.location}</span>
                      <span className={cn("num ml-auto shrink-0", enRoute ? "text-amber-400" : "text-blue-400")}>
                        {enRoute ? `ETA ${fmtDuration(u.eta_s, c.time_scale)}` : `${fmtDuration(u.service_s, c.time_scale)} left`}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-3.5 text-2xs text-zinc-500">
                      <span>{enRoute ? "En route" : "On scene"}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="truncate">{cl.damage_type}</span>
                      <span className={cn("num ml-auto shrink-0", (cl.severity ?? 0) >= 8 ? "text-red-400" : "text-zinc-500")}>
                        sev {fmtSeverity(cl.severity)}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-2xs font-medium uppercase tracking-wider text-zinc-500">Predicted next</h3>
          <span className="num text-zinc-600">auto-dispatch ≥ {Math.round(c.threshold * 100)}%</span>
        </div>
        {ops.predictions.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-800 px-3 py-4 text-center text-xs text-zinc-500">
            {ops.units.some((u) => u.status === "Idle") ? "No open claim is worth an idle unit right now." : "All units are committed."}
          </div>
        ) : (
          <ul className="space-y-px">
            {ops.predictions.map((p) => {
              const cl = claimById.get(p.claim_id)
              const ready = p.confidence >= c.threshold
              return (
                <li key={`${p.unit_id}-${p.claim_id}`}>
                  <button
                    onClick={() => onSelectClaim(p.claim_id)}
                    className="w-full rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-zinc-900"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="num text-zinc-300">{p.unit_id}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-zinc-700" />
                      <span className="num text-zinc-300">{cl?.claim_number ?? p.claim_id}</span>
                      <span className="truncate text-zinc-500">{cl?.location}</span>
                      <span className="num ml-auto shrink-0 text-zinc-500">{Math.round(p.eta_min)}m away</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ConfidenceBar value={p.confidence} threshold={c.threshold} />
                      <span className={cn("num w-9 shrink-0 text-right", ready ? "text-emerald-400" : "text-zinc-400")}>{pct(p.confidence)}</span>
                      <StreakPips streak={p.streak} of={c.commit_streak} />
                    </div>
                    {p.basis === "coverage" && (
                      <div className="mt-1 text-2xs text-red-400/80">Critical · committing on coverage</div>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2 border-t border-zinc-800/80 pt-4">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
          <span className="text-zinc-300">Auto-dispatch</span>
          <Switch checked={c.autopilot} onChange={onToggleAutopilot} label="Auto-dispatch" />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
          <span className="text-zinc-300">Simulated report feed</span>
          <Switch checked={c.feed_enabled} onChange={onToggleFeed} label="Simulated feed" />
        </label>
        <div className="flex items-center justify-between pt-1 font-mono text-[10px] tabular-nums text-zinc-600">
          <span>solve #{s.cycle} · {s.ms ?? "—"}ms · {s.replicas} replicas</span>
          <span>⟨H⟩ {s.energy === null ? "—" : s.energy.toFixed(2)}</span>
        </div>
      </section>
    </div>
  )
}

function Activity({ events }: { events: OpsEvent[] }) {
  if (events.length === 0) return <EmptyState icon={ListTree} title="No activity yet" description="Intake, solver, and dispatch events appear here." />
  return (
    <ol className="py-1">
      {events.map((l) => {
        const { icon: Icon, cls } = LEVEL[l.level]
        return (
          <li key={l.id} className="flex gap-2.5 px-3 py-1.5 transition-colors duration-150 hover:bg-zinc-800/30">
            <span className="num shrink-0 pt-px text-zinc-600">{clockTime(l.ts)}</span>
            <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", cls)} />
            <span className={cn("min-w-0 break-words font-mono text-xs leading-5", l.level === "error" ? "text-red-400" : "text-zinc-300")}>{l.msg}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Alerts() {
  return (
    <ul className="divide-y divide-zinc-800/60">
      {ALERTS.map(({ type, area, time, icon: Icon, severe }) => (
        <li key={type} className="flex items-start gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-zinc-800/30">
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border", severe ? "border-critical/20 bg-critical/10 text-red-400" : "border-warning/20 bg-warning/10 text-amber-400")}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-zinc-200">{type}</div>
            <div className="text-xs text-zinc-500">{area}</div>
          </div>
          <span className="num pt-0.5 text-zinc-600">{time}</span>
        </li>
      ))}
    </ul>
  )
}

function Meter({ label, value, total, tone = "bg-zinc-300" }: { label: string; value: number; total: number; tone?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="num text-zinc-300">
          {value}
          <span className="text-zinc-600">/{total}</span>
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
        <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
      </div>
    </div>
  )
}

function System({ ops }: { ops: OpsState }) {
  const n = ops.nemotron
  const live = n.mode === "nemotron"
  const types = ["Command Vehicle", "Adjuster Team", "Supply Vehicle"] as const
  const active = ops.claims.filter((c) => c.status !== "resolved")
  const critical = active.filter((c) => (c.severity ?? 0) >= 8)
  return (
    <div className="space-y-5 p-3">
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-zinc-500">
          <BrainCircuit className="h-3 w-3" /> Nemotron intake
        </h3>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-800/80 bg-zinc-800/80">
          <KV k="Mode" mono={false} v={<span className={live ? "text-emerald-400" : "text-amber-400"}>{live ? "Live" : n.mode === "disabled" ? "No API key" : n.mode === "starting" ? "Connecting" : "Rule fallback"}</span>} />
          <KV k="Model" v={n.model?.split("/").pop() ?? "—"} />
          <KV k="API calls" v={`${n.calls}${n.failures ? ` · ${n.failures} failed` : ""}`} />
          <KV k="Avg latency" v={n.avg_latency_ms === null ? "—" : `${n.avg_latency_ms}ms`} />
          <KV k="Reports scored" v={n.reports} />
          <KV k="Via fallback" v={n.fallback_reports} />
        </div>
        {n.last_error && (
          <p className="mt-2 break-words rounded-md border border-warning/20 bg-warning/5 px-2.5 py-2 font-mono text-[11px] leading-4 text-amber-300/90">{n.last_error}</p>
        )}
        {n.mode === "disabled" && (
          <p className="mt-2 text-2xs text-zinc-500">
            Set <span className="font-mono text-zinc-300">NEMOTRON_API_KEY</span> in <span className="font-mono text-zinc-300">.env</span> and restart the backend.
          </p>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-zinc-500">Units committed by type</h3>
        {types.map((t) => {
          const of = ops.units.filter((u) => u.type === t)
          return <Meter key={t} label={t} value={of.filter((u) => u.status !== "Idle").length} total={of.length} />
        })}
      </div>
      <div className="space-y-3">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-zinc-500">Coverage</h3>
        <Meter label="Critical claims covered" value={critical.filter((c) => c.status === "assigned" || c.status === "on_scene").length} total={critical.length} tone="bg-red-500" />
        <Meter label="Active claims with a unit" value={active.filter((c) => c.status === "assigned" || c.status === "on_scene").length} total={active.length} tone="bg-blue-500" />
      </div>
    </div>
  )
}

export function OpsPanel({
  ops,
  events,
  onToggleAutopilot,
  onToggleFeed,
  onSelectClaim,
}: {
  ops: OpsState | null
  events: OpsEvent[]
  onToggleAutopilot: () => void
  onToggleFeed: () => void
  onSelectClaim: (id: string) => void
}) {
  const [tab, setTab] = useState<Tab>("routing")
  return (
    <Pane className="h-full">
      <div className="flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-zinc-800/80 px-2">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { id: "routing", label: "Routing", icon: Route, count: ops?.predictions.length },
            { id: "activity", label: "Activity", icon: ListTree, count: events.length },
            { id: "alerts", label: "Alerts", icon: Siren },
            { id: "system", label: "System", icon: Cpu },
          ]}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {!ops ? (
          <div className="space-y-3 p-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {tab === "routing" && <Routing ops={ops} onToggleAutopilot={onToggleAutopilot} onToggleFeed={onToggleFeed} onSelectClaim={onSelectClaim} />}
            {tab === "activity" && <Activity events={events} />}
            {tab === "alerts" && <Alerts />}
            {tab === "system" && <System ops={ops} />}
          </>
        )}
      </div>
    </Pane>
  )
}
