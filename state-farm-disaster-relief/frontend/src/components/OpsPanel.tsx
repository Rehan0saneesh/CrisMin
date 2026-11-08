"use client"

import { useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  CloudRain,
  Gauge,
  ListTree,
  Siren,
  Tornado,
  Wind,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import type { Claim, LogEntry, LogLevel, Unit } from "@/lib/data"
import { EmptyState, Pane, Tabs, cn } from "./ui"

type Tab = "activity" | "alerts" | "resources"

const LEVEL: Record<LogLevel, { icon: LucideIcon; cls: string }> = {
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

function Activity({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) return <EmptyState icon={ListTree} title="No activity yet" description="Dispatch events and solver runs appear here." />
  return (
    <ol className="py-1">
      {logs.map((l) => {
        const { icon: Icon, cls } = LEVEL[l.level]
        return (
          <li key={l.id} className="flex gap-2.5 px-3 py-1.5 transition-colors duration-150 hover:bg-zinc-800/30 animate-fade-in">
            <span className="num shrink-0 pt-px text-zinc-600">{l.ts}</span>
            <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", cls)} />
            <span className={cn("min-w-0 break-words font-mono text-xs leading-5", l.level === "error" ? "text-red-400" : "text-zinc-300")}>
              {l.msg}
            </span>
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
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
              severe ? "border-critical/20 bg-critical/10 text-red-400" : "border-warning/20 bg-warning/10 text-amber-400",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-zinc-200">{type}</div>
            <div className="text-xs text-zinc-500">{area}</div>
          </div>
          <span className="num pt-0.5 text-zinc-600">{time}</span>
        </li>
      ))}
      <li className="flex items-center justify-between px-3 py-2.5 text-xs text-zinc-500">
        <span className="flex items-center gap-2">
          <Wind className="h-3.5 w-3.5" /> Sustained winds
        </span>
        <span className="num text-zinc-300">45–60 mph</span>
      </li>
    </ul>
  )
}

function Meter({ label, value, total, tone = "bg-zinc-300" }: { label: string; value: number; total: number; tone?: string }) {
  const pct = total ? (value / total) * 100 : 0
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
        <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Resources({ units, claims }: { units: Unit[]; claims: Claim[] }) {
  const types: Unit["type"][] = ["Command Vehicle", "Adjuster Team", "Supply Vehicle"]
  const busy = units.filter((u) => u.status !== "Idle").length
  const critical = claims.filter((c) => (c.severity ?? 0) >= 8)
  const covered = critical.filter((c) => c.status === "assigned").length
  const scored = claims.filter((c) => c.severity !== null).length
  return (
    <div className="space-y-5 p-3">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-800/80 bg-zinc-800/80">
        {[
          ["Utilization", units.length ? `${Math.round((busy / units.length) * 100)}%` : "—"],
          ["Scored", `${scored}/${claims.length}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-zinc-950 px-3 py-2">
            <div className="text-2xs text-zinc-500">{k}</div>
            <div className="num mt-0.5 text-sm text-zinc-100">{v}</div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-zinc-500">Units committed by type</h3>
        {types.map((t) => {
          const of = units.filter((u) => u.type === t)
          return <Meter key={t} label={t} value={of.filter((u) => u.status !== "Idle").length} total={of.length} />
        })}
      </div>
      <div className="space-y-3">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-zinc-500">Coverage</h3>
        <Meter label="Critical claims covered" value={covered} total={critical.length} tone="bg-red-500" />
        <Meter
          label="All claims assigned"
          value={claims.filter((c) => c.status === "assigned").length}
          total={claims.length}
          tone="bg-blue-500"
        />
      </div>
    </div>
  )
}

export function OpsPanel({ logs, units, claims }: { logs: LogEntry[]; units: Unit[]; claims: Claim[] }) {
  const [tab, setTab] = useState<Tab>("activity")
  return (
    <Pane className="h-full">
      <div className="flex h-10 shrink-0 items-stretch border-b border-zinc-800/80 px-2">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { id: "activity", label: "Activity", icon: ListTree, count: logs.length },
            { id: "alerts", label: "Alerts", icon: Siren, count: ALERTS.length },
            { id: "resources", label: "Resources", icon: Gauge },
          ]}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === "activity" && <Activity logs={logs} />}
        {tab === "alerts" && <Alerts />}
        {tab === "resources" && <Resources units={units} claims={claims} />}
      </div>
    </Pane>
  )
}
