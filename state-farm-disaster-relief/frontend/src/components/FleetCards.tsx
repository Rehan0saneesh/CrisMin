"use strict"

type FleetUnit = {
  name: string
  type: string
  status: "Deployed" | "En Route" | "Idle"
  location: string
}

const FLEET_UNITS: FleetUnit[] = [
  { name: "Mobile Command Unit 1", type: "Command Vehicle", status: "Deployed", location: "Gulfport, MS" },
  { name: "Claims Adjuster Team A", type: "Adjuster Team", status: "En Route", location: "Mobile, AL" },
  { name: "Supply Truck Delta", type: "Supply Vehicle", status: "Idle", location: "Pensacola, FL" },
  { name: "Mobile Command Unit 2", type: "Command Vehicle", status: "Deployed", location: "Biloxi, MS" },
]

function statusColor(status: string) {
  if (status === "Deployed") return "#ef4444"
  if (status === "En Route") return "#f59e0b"
  return "#22c55e"
}

export function FleetCards() {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-3">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">catastrophe response units</span>
      <div className="space-y-2">
        {FLEET_UNITS.map((unit, i) => {
          const color = statusColor(unit.status)
          return (
            <div key={i} className="flex gap-3 rounded border border-slate-800 bg-slate-800/30 p-2.5 hover:bg-slate-800/50 transition">
              <div className={`w-10 h-10 rounded flex items-center justify-center border border-slate-700 ${color}/20`}>
                <span className="text-xs font-bold text-slate-300">{unit.type.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200 truncate">{unit.name}</div>
                <div className="text-xs text-slate-500">{unit.location}</div>
              </div>
              <span className={`text-xs font-bold border rounded px-2 py-0.5 ${color}`}>{unit.status}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
