"use client"

import { useEffect, useState } from "react"
import { PanelLeft, Play, Plus, RotateCcw } from "lucide-react"
import { Badge, Button, Dot, Kbd, ProgressBar } from "./ui"

type Props = {
  backendOnline: boolean | null
  latencyMs: number | null
  busy: boolean
  isOptimizing: boolean
  onToggleSidebar: () => void
  onIngest: () => void
  onOptimize: () => void
  onReset: () => void
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const t = now ? now.toLocaleTimeString([], { hour12: false }) : "--:--:--"
  const tz = now ? now.toLocaleTimeString([], { timeZoneName: "short" }).split(" ").pop() : ""
  return (
    <span className="num text-zinc-400">
      {t} <span className="text-zinc-600">{tz}</span>
    </span>
  )
}

/** Small geometric mark: a crosshair inside a rounded square. */
function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" className="fill-zinc-100" />
      <circle cx="12" cy="12" r="5" className="fill-none stroke-zinc-950" strokeWidth="2" />
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" className="stroke-zinc-950" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function TopNav({
  backendOnline,
  latencyMs,
  busy,
  isOptimizing,
  onToggleSidebar,
  onIngest,
  onOptimize,
  onReset,
}: Props) {
  const tone = backendOnline === null ? "neutral" : backendOnline ? "success" : "critical"
  const label = backendOnline === null ? "Connecting" : backendOnline ? "Operational" : "Offline"

  return (
    <header className="relative z-40 shrink-0 border-b border-zinc-800/80 bg-zinc-950">
      <div className="flex h-12 items-center gap-2 px-3">
        <Button variant="ghost" size="icon-sm" icon={PanelLeft} onClick={onToggleSidebar} aria-label="Toggle fleet panel" />

        <div className="flex min-w-0 items-center gap-2.5 pl-1">
          <LogoMark />
          <span className="text-[13px] font-semibold tracking-tight text-zinc-100">CrisMin</span>
          <span className="hidden text-zinc-700 sm:inline">/</span>
          <span className="hidden truncate text-[13px] text-zinc-400 sm:inline">Gulf Coast</span>
          <span className="hidden text-zinc-700 md:inline">/</span>
          <span className="hidden truncate text-[13px] text-zinc-400 md:inline">Hurricane response</span>
          <Badge tone="critical" className="ml-1 hidden md:inline-flex">
            Active
          </Badge>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="hidden h-7 items-center gap-2 rounded-md border border-zinc-800/80 px-2.5 lg:flex"
            title={backendOnline === false ? "Backend unreachable" : "Backend health"}
          >
            <Dot tone={tone} />
            <span className="text-xs text-zinc-400">{label}</span>
            {backendOnline && latencyMs !== null && <span className="num text-zinc-600">{latencyMs}ms</span>}
          </div>
          <div className="hidden h-7 items-center rounded-md border border-zinc-800/80 px-2.5 xl:flex">
            <LiveClock />
          </div>

          <div className="mx-1 hidden h-5 w-px bg-zinc-800 lg:block" />

          <Button variant="ghost" size="icon-sm" icon={RotateCcw} onClick={onReset} title="Reset scenario" aria-label="Reset scenario" />
          <Button variant="secondary" size="sm" icon={Plus} onClick={onIngest} title="New loss report (N)">
            <span className="hidden sm:inline">New report</span>
            <span className="hidden lg:inline-flex">
              <Kbd>N</Kbd>
            </span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Play}
            loading={isOptimizing}
            onClick={onOptimize}
            disabled={backendOnline === false}
            title="Run optimization (O)"
          >
            <span className="hidden sm:inline">{isOptimizing ? "Solving…" : "Run optimization"}</span>
          </Button>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 translate-y-px">
        <ProgressBar active={busy} />
      </div>
    </header>
  )
}
