import { Activity, AlertOctagon, Clock3, FileStack, Truck, type LucideIcon } from "lucide-react"
import { Skeleton, cn } from "./ui"

export type KPIData = {
  openClaims: number
  totalClaims: number
  critical: number
  unscored: number
  unitsBusy: number
  unitsTotal: number
  queued: number
  solverEnergy: number | null
  solverMs: number | null
  solverNodes: number | null
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  valueClass,
  loading,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  sub: React.ReactNode
  valueClass?: string
  loading?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-14" />
      ) : (
        <div className={cn("font-mono text-xl font-medium leading-6 tabular-nums tracking-tight text-zinc-100", valueClass)}>
          {value}
        </div>
      )}
      <div className="truncate font-mono text-2xs tabular-nums text-zinc-500">{sub}</div>
    </div>
  )
}

export function KPIStrip({ data, loading }: { data: KPIData; loading: boolean }) {
  const util = data.unitsTotal ? Math.round((data.unitsBusy / data.unitsTotal) * 100) : 0
  return (
    <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-800/80 md:grid-cols-3 xl:grid-cols-5 [&>*]:bg-zinc-950 max-md:[&>*:last-child]:col-span-2 md:max-xl:[&>*:last-child]:col-span-2">
      <Stat
        icon={FileStack}
        label="Open claims"
        value={data.openClaims}
        sub={data.unscored ? `${data.unscored} awaiting score` : `${data.totalClaims} total · all scored`}
      />
      <Stat
        icon={AlertOctagon}
        label="Critical"
        value={data.critical}
        valueClass={data.critical ? "text-red-400" : undefined}
        sub="severity ≥ 8"
        loading={loading}
      />
      <Stat
        icon={Truck}
        label="Units committed"
        value={
          <>
            {data.unitsBusy}
            <span className="text-zinc-600">/{data.unitsTotal}</span>
          </>
        }
        sub={`${util}% utilization`}
      />
      <Stat
        icon={Clock3}
        label="Queued"
        value={data.queued}
        valueClass={data.queued ? "text-amber-400" : undefined}
        sub="selected · no unit free"
      />
      <Stat
        icon={Activity}
        label="Solver energy"
        value={data.solverEnergy === null ? "—" : data.solverEnergy.toFixed(2)}
        sub={data.solverMs === null ? "no run yet" : `${data.solverNodes} nodes · ${data.solverMs}ms`}
        loading={loading}
      />
    </div>
  )
}
