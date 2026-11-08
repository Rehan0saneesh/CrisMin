"use client"

import { useEffect, useState } from "react"
import { Map, ChevronDown, ChevronRight, Play, Pause, Pin, Target } from "lucide-react"

type FleetUnit = {
  id: string
  name: string
  type: string
  status: "Deployed" | "En Route" | "Idle"
  location: string
}

const SELECTED_UNITS: FleetUnit[] = [
  { id: "CRU-01", name: "Mobile Command Unit 1", type: "Command Vehicle", status: "Deployed", location: "Gulfport, MS" },
  { id: "CRU-02", name: "Mobile Command Unit 2", type: "Command Vehicle", status: "Deployed", location: "Biloxi, MS" },
]

const ASSIGNABLE_UNITS: FleetUnit[] = [
  { id: "ADJ-01", name: "Claims Adjuster Team A", type: "Adjuster Team", status: "En Route", location: "Mobile, AL" },
  { id: "SUP-01", name: "Supply Truck Delta", type: "Supply Vehicle", status: "Idle", location: "Pensacola, FL" },
  { id: "ADJ-02", name: "Claims Adjuster Team B", type: "Adjuster Team", status: "Idle", location: "New Orleans, LA" },
  { id: "SUP-02", name: "Supply Truck Echo", type: "Supply Vehicle", status: "Idle", location: "Gulfport, MS" },
]

function statusColor(status: string) {
  if (status === "Deployed") return "#EF4444"
  if (status === "En Route") return "#F59E0B"
  return "#10B981"
}

export function Sidebar() {
  const [selectedUnitsExpanded, setSelectedUnitsExpanded] = useState(true)
  const [assignableUnitsExpanded, setAssignableUnitsExpanded] = useState(true)

  return (
    <aside className="fixed top-14 left-0 bottom-0 w-[320px] bg-[#1E222B] border-r border-[#2D323E] z-30 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-[#2D323E] flex-shrink-0">
        <h2 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">Command Center</h2>
        <p className="text-[10px] text-[#64748B] mt-0.5">Gulf Coast Catastrophe Zone</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Selected Units */}
        <div className="border border-[#2D323E] bg-[#0F1117]/50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#2D323E] bg-[#11141A] cursor-pointer group" onClick={() => setSelectedUnitsExpanded(!selectedUnitsExpanded)}>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Selected Units ({SELECTED_UNITS.length})</span>
            <ChevronDown size={14} className={selectedUnitsExpanded ? "text-[#94A3B8]" : "text-[#94A3B8] rotate-180"} />
          </div>
          {selectedUnitsExpanded && (
            <div className="p-2 space-y-2">
              {SELECTED_UNITS.map((unit) => (
                <div key={unit.id} className="flex items-center justify-between px-2 py-2 border border-[#2D323E] bg-[#0F1117] text-xs hover:bg-[#11141A] transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Pin size={12} className="text-[#94A3B8] shrink-0" />
                    <div>
                      <div className="text-[#F8FAFC] font-medium leading-tight">{unit.name}</div>
                      <div className="text-[#64748B] leading-tight">{unit.location}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`status-pill ${unit.status.toLowerCase().replace(" ", "-")}`}>{unit.status}</span>
                    <div className="text-[#94A3B8]">{unit.type}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assignable Units */}
        <div className="border border-[#2D323E] bg-[#0F1117]/50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#2D323E] bg-[#11141A] cursor-pointer group" onClick={() => setAssignableUnitsExpanded(!assignableUnitsExpanded)}>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Assignable Units ({ASSIGNABLE_UNITS.length})</span>
            <ChevronDown size={14} className={assignableUnitsExpanded ? "text-[#94A3B8]" : "text-[#94A3B8] rotate-180"} />
          </div>
          {assignableUnitsExpanded && (
            <div className="p-2 space-y-2">
              <div className="px-2 py-1.5 border-b border-[#2D323E]">
                <input
                  type="text"
                  placeholder="Search units..."
                  className="w-full bg-[#0F1117] border border-[#2D323E] text-[10px] text-[#F8FAFC] px-2 py-1 focus:border-[#3B82F6] outline-none"
                />
              </div>
              {ASSIGNABLE_UNITS.map((unit) => (
                <div key={unit.id} className="flex items-center justify-between px-2 py-2 border border-[#2D323E] bg-[#0F1117] text-xs hover:bg-[#11141A] transition-colors group">
                  <div className="flex items-center gap-2 min-w-0">
                    <Target size={12} className="text-[#94A3B8] shrink-0" />
                    <div>
                      <div className="text-[#F8FAFC] font-medium leading-tight">{unit.name}</div>
                      <div className="text-[#64748B] leading-tight">{unit.location}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`status-pill ${unit.status.toLowerCase().replace(" ", "-")}`}>{unit.status}</span>
                  </div>
                  <button className="btn-primary px-2 py-1 text-[10px]" disabled={unit.status !== "Idle"}>
                    Dispatch
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
