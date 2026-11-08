import { Activity, AlertOctagon, CheckCheck, FileStack, Truck, type LucideIcon } from "lucide-react"
import type { OpsState } from "@/lib/api"
import { pct } from "@/lib/data"
import { Skeleton, cn } from "./ui"

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  valueClass,
  loading,
  children,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  sub: React.ReactNode
  valueClass?: string
  loading?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="relative flex min-w-0 flex-col gap-1.5 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-14" />
      ) : (
        <div className={cn("font-mono text-xl font-medium leading-6 tabular-nums tracking-tight text-zinc-100", valueClass)}>{value}</div>
      )}
      <div className="truncate font-mono text-2xs tabular-nums text-zinc-500">{loading ? " " : sub}</div>
      {children}
    </div>
  )
}

/** Tiny SVG sparkline of mean route confidence over recent solves. */
function Sparkline({ values, threshold }: { values: number[]; threshold: number }) {
  if (values.length < 2) return null
  const w = 72, h = 22
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - v * h}`).join(" ")
  return (
    <svg width={w} height={h} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-80" aria-hidden>
      <line x1={0} x2={w} y1={h - threshold * h} y2={h - threshold * h} className="stroke-zinc-700" strokeDasharray="2 2" strokeWidth={1} />
      <polyline points={pts} fill="none" className="stroke-zinc-300" strokeWidth={1.25} strokeLinejoin="round" />
    </svg>
  )
}

export function KPIStrip({ ops, loading }: { ops: OpsState | null; loading: boolean }) {
  const claims = ops?.claims ?? []
  const units = ops?.units ?? []
  const active = claims.filter((c) => c.status !== "resolved")
  const open = claims.filter((c) => c.status === "open" || c.status === "pending")
  const pending = claims.filter((c) => c.status === "pending").length
  const critical = active.filter((c) => (c.severity ?? 0) >= 8)
  const criticalOpen = critical.filter((c) => c.status === "open").length
  const busy = units.filter((u) => u.status !== "Idle").length
  const s = ops?.solver
  const threshold = ops?.control.threshold ?? 0.9
  const hist = (s?.history ?? []).map((h) => h.confidence).filter((v): v is number => v !== null)

  return (
    <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-800/80 md:grid-cols-3 xl:grid-cols-5 [&>*]:bg-zinc-950 max-md:[&>*:last-child]:col-span-2 md:max-xl:[&>*:last-child]:col-span-2">
      <Stat
        icon={FileStack}
        label="Open claims"
        loading={loading}
        value={open.length}
        sub={pending ? `${pending} in Nemotron intake` : `${active.length} active total`}
      />
      <Stat
        icon={AlertOctagon}
        label="Critical"
        loading={loading}
        value={critical.length}
        valueClass={criticalOpen ? "text-red-400" : undefined}
        sub={criticalOpen ? `${criticalOpen} awaiting a unit` : "all covered"}
      />
      <Stat
        icon={Truck}
        label="Units committed"
        loading={loading}
        value={
          <>
            {busy}
            <span className="text-zinc-600">/{units.length}</span>
          </>
        }
        sub={`${units.length ? Math.round((busy / units.length) * 100) : 0}% utilization`}
      />
      <Stat
        icon={CheckCheck}
        label="Resolved"
        loading={loading}
        value={ops?.stats.resolved_total ?? 0}
        sub={ops?.stats.avg_response_min != null ? `avg ${ops.stats.avg_response_min} min to scene` : "no arrivals yet"}
      />
      <Stat
        icon={Activity}
        label="Route confidence"
        loading={loading}
        value={pct(s?.mean_confidence ?? null)}
        sub={s?.cycle ? `solve #${s.cycle} · ${s.replicas} replicas · ${s.ms}ms` : "waiting for first solve"}
      >
        <Sparkline values={hist} threshold={threshold} />
      </Stat>
    </div>
  )
}
