"use client"

import { useEffect, useState } from "react"
import { BrainCircuit, Cpu, Loader2, PanelLeft, Plus, RotateCcw } from "lucide-react"
import type { OpsState } from "@/lib/api"
import { Badge, Button, Dot, Switch, cn } from "./ui"

type Props = {
  backendOnline: boolean | null
  latencyMs: number | null
  nemotron: OpsState["nemotron"] | null
  autopilot: boolean
  threshold: number
  busy: boolean
  solving: boolean
  onToggleSidebar: () => void
  onIngest: () => void
  onToggleAutopilot: () => void
  onSolve: () => void
  onReset: () => void
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="num text-zinc-400">{now ? now.toLocaleTimeString([], { hour12: false }) : "--:--:--"}</span>
}

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" className="fill-zinc-100" />
      <circle cx="12" cy="12" r="5" className="fill-none stroke-zinc-950" strokeWidth="2" />
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" className="stroke-zinc-950" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function NemotronChip({ n }: { n: OpsState["nemotron"] | null }) {
  if (!n) return null
  const live = n.mode === "nemotron"
  const tone = live ? "success" : n.mode === "starting" ? "neutral" : "warning"
  const label = live ? n.model?.split("/").pop()?.replace("nemotron-", "") : n.mode === "disabled" ? "No API key" : n.mode === "starting" ? "Connecting" : "Rule fallback"
  const title = live
    ? `NVIDIA Nemotron · ${n.model} · ${n.calls} calls · avg ${n.avg_latency_ms ?? "—"} ms`
    : n.mode === "disabled"
      ? "NEMOTRON_API_KEY is not set — reports are scored by keyword rules"
      : `Nemotron unavailable — keyword rules in use${n.last_error ? `\n${n.last_error}` : ""}`
  return (
    <div className="hidden h-7 items-center gap-2 rounded-md border border-zinc-800/80 px-2.5 lg:flex" title={title}>
      <BrainCircuit className="h-3.5 w-3.5 text-zinc-500" />
      <span className="text-xs text-zinc-400">Nemotron</span>
      <Dot tone={tone} />
      <span className={cn("max-w-[140px] truncate text-xs", live ? "text-zinc-200" : "text-amber-400")}>{label}</span>
      {live && n.avg_latency_ms !== null && (
        <span className="num text-zinc-600">{n.avg_latency_ms < 1000 ? `${n.avg_latency_ms}ms` : `${(n.avg_latency_ms / 1000).toFixed(1)}s`}</span>
      )}
      {n.queue > 0 && <span className="num rounded bg-zinc-800 px-1 text-[10px] text-zinc-300">{n.queue} queued</span>}
    </div>
  )
}

export function TopNav(p: Props) {
  const tone = p.backendOnline === null ? "neutral" : p.backendOnline ? "success" : "critical"
  return (
    <header className="relative z-40 shrink-0 border-b border-zinc-800/80 bg-zinc-950">
      <div className="flex h-12 items-center gap-2 px-3">
        <Button variant="ghost" size="icon-sm" icon={PanelLeft} onClick={p.onToggleSidebar} aria-label="Toggle fleet panel" title="Toggle fleet ([)" />

        <div className="flex min-w-0 items-center gap-2.5 pl-1">
          <LogoMark />
          <span className="text-[13px] font-semibold tracking-tight text-zinc-100">CrisMin</span>
          <span className="hidden text-zinc-700 sm:inline">/</span>
          <span className="hidden truncate text-[13px] text-zinc-400 sm:inline">Gulf Coast</span>
          <span className="hidden text-zinc-700 xl:inline">/</span>
          <span className="hidden truncate text-[13px] text-zinc-400 xl:inline">Hurricane response</span>
          <Badge tone="critical" className="ml-1 hidden md:inline-flex">
            Active
          </Badge>
          <Loader2
            aria-label="Working"
            className={cn("h-3.5 w-3.5 shrink-0 animate-spin text-zinc-500 transition-opacity duration-150", p.busy ? "opacity-100" : "opacity-0")}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden h-7 items-center gap-2 rounded-md border border-zinc-800/80 px-2.5 2xl:flex" title="Backend health">
            <Dot tone={tone} />
            <span className="text-xs text-zinc-400">API</span>
            {p.backendOnline && p.latencyMs !== null && <span className="num text-zinc-600">{p.latencyMs}ms</span>}
          </div>
          <NemotronChip n={p.nemotron} />
          <div className="hidden h-7 items-center rounded-md border border-zinc-800/80 px-2.5 2xl:flex">
            <LiveClock />
          </div>

          <div className="mx-1 hidden h-5 w-px bg-zinc-800 lg:block" />

          <label
            className={cn(
              "flex h-7 cursor-pointer select-none items-center gap-2 rounded-md border px-2.5 text-xs transition-colors duration-150",
              p.autopilot ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-zinc-800/80 text-zinc-500 hover:text-zinc-300",
            )}
            title={`Auto-dispatch routes that hold ≥ ${Math.round(p.threshold * 100)}% confidence (A)`}
          >
            <Switch checked={p.autopilot} onChange={p.onToggleAutopilot} label="Auto-dispatch" disabled={!p.backendOnline} />
            <span className="hidden sm:inline">Auto-dispatch</span>
            <span className="num hidden text-zinc-500 md:inline">≥{Math.round(p.threshold * 100)}%</span>
          </label>

          <Button variant="ghost" size="icon-sm" icon={RotateCcw} onClick={p.onReset} disabled={!p.backendOnline} title="Reset scenario" aria-label="Reset scenario" />
          <Button variant="secondary" size="sm" icon={Cpu} onClick={p.onSolve} loading={p.solving} disabled={!p.backendOnline} title="Re-solve routing now (S)">
            <span className="hidden md:inline">Solve now</span>
          </Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={p.onIngest} title="New loss report (N)">
            <span className="hidden sm:inline">New report</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
