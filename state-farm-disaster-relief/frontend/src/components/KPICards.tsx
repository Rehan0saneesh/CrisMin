"use strict"

type KPICardProps = {
  label: string
  value: string | number
  status?: "deployed" | "pending" | "neutral"
}

function KPICard({ label, value, status = "neutral" }: KPICardProps) {
  const statusColor = status === "deployed" ? "#22c55e" : status === "pending" ? "#f59e0b" : "#3b82f6"

  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        {status !== "neutral" && (
          <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: statusColor }} />
        )}
      </div>
      <span className="text-2xl font-bold text-slate-100 font-mono">{value}</span>
    </div>
  )
}

type KPICardsProps = {
  totalClaims: number
  deployedUnits: number
  pendingUnits: number
}

export function KPICards({ totalClaims, deployedUnits, pendingUnits }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <KPICard label="total claims" value={totalClaims} status="neutral" />
      <KPICard label="deployed units" value={deployedUnits} status="deployed" />
      <KPICard label="pending units" value={pendingUnits} status="pending" />
      <KPICard label="avg response" value="< 2s" status="neutral" />
    </div>
  )
}
