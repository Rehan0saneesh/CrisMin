"use strict"

export function ResourceAllocation() {
  const resources = [
    { name: "Personnel", deployed: 142, requested: 160 },
    { name: "Vehicles", deployed: 38, requested: 52 },
    { name: "Supplies", deployed: 94, requested: 110 },
  ]

  return (
    <div className="border border-[#2D323E] bg-[#1E222B] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[#F8FAFC] uppercase tracking-wider">Resource Allocation</span>
        <span className="text-xs font-mono text-[#3B82F6]">88%</span>
      </div>
      <div className="space-y-2">
        {resources.map((r) => {
          const pct = Math.round((r.deployed / r.requested) * 100)
          return (
            <div key={r.name} className="flex items-baseline gap-2">
              <span className="text-[10px] text-[#94A3B8] w-16">{r.name}</span>
              <div className="flex-1 h-1 bg-[#2D323E] overflow-hidden">
                <div className="h-full bg-[#3B82F6]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-[#F8FAFC] w-12 text-right">{r.deployed}/{r.requested}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
