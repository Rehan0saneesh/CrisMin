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
  if (status === "Deployed") return "#EF4444"
  if (status === "En Route") return "#F59E0B"
  return "#10B981"
}

export function FleetCards() {
  return (
    <div className="border border-[#2D323E] bg-[#1E222B] p-3 flex flex-col">
      <span className="text-[10px] font-bold text-[#F8FAFC] uppercase tracking-wider mb-2 block">Catastrophe Response Units</span>
      <div className="space-y-2">
        {FLEET_UNITS.map((unit, i) => {
          const color = statusColor(unit.status)
          return (
            <div key={i} className="flex gap-2 rounded-none border border-[#2D323E] bg-[#0F1117] p-2 hover:bg-[#11141A] transition-colors">
              <div className={`w-8 h-8 rounded-none flex items-center justify-center border border-[#2D323E] ${color}/20`}>
                <span className="text-[10px] font-bold text-[#94A3B8]">{unit.type.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-[#F8FAFC] truncate">{unit.name}</div>
                <div className="text-[10px] text-[#94A3B8]">{unit.location}</div>
              </div>
              <span className={`text-[10px] font-bold border border-solid rounded-none px-2 py-0.5 ${color}`}>{unit.status}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
