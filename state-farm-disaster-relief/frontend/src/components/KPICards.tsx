"use strict"

type KPICardProps = {
  label: string
  value: string | number
  status?: "deployed" | "pending" | "neutral"
}

function KPICard({ label, value, status = "neutral" }: KPICardProps) {
  const statusColor = status === "deployed" ? "#10B981" : status === "pending" ? "#F59E0B" : "#3B82F6"

  return (
    <div className="flex-1 border border-[#2D323E] bg-[#1E222B] p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">{label}</span>
        {status !== "neutral" && (
          <span className="w-2 h-2 rounded-none" style={{ backgroundColor: statusColor }} />
        )}
      </div>
      <span className="text-xl font-mono text-[#F8FAFC] tabular-nums">{value}</span>
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
    <div className="flex gap-3">
      <KPICard label="total claims" value={totalClaims} status="neutral" />
      <KPICard label="deployed units" value={deployedUnits} status="deployed" />
      <KPICard label="pending units" value={pendingUnits} status="pending" />
      <KPICard label="avg response" value="< 2s" status="neutral" />
    </div>
  )
}
