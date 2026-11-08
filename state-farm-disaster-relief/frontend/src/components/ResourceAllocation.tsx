"use strict"

export function ResourceAllocation() {
  const resources = [
    { name: "personnel", deployed: 142, requested: 160 },
    { name: "vehicles", deployed: 38, requested: 52 },
    { name: "supplies", deployed: 94, requested: 110 },
  ]

  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-200 uppercase tracking-wider">resource allocation</span>
        <span className="font-bold text-slate-100 font-mono">88%</span>
      </div>
      <div className="space-y-3">
        {resources.map((r) => {
          const pct = Math.round((r.deployed / r.requested) * 100)
          return (
            <div key={r.name} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">{r.name}</span>
                <span className="text-slate-200 font-mono">{r.deployed} / {r.requested}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-slate-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
