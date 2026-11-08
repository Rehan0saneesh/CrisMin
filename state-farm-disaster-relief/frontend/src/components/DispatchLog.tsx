"use client"

import { useEffect, useState } from "react"
import { Terminal } from "lucide-react"

const INITIAL_LOGS = [
  "10:15:22  CRU-01 deployed  Gulfport, MS  Roof Damage  severity=9",
  "10:12:15  ADJ-01 en route  Mobile, AL  Water Intrusion  severity=8",
  "10:08:00  Weather front crossing Mobile Bay",
  "10:05:30  SUP-01 staged  Pensacola, FL  Idle",
  "10:01:48  Hurricane tracking cone updated  Gulf Coast",
  "9:55:00  CRU-02 deployed  Biloxi, MS  Structural Collapse  severity=10",
  "9:48:10  Flooding reported  New Orleans, LA  Priority High",
  "9:42:00  QUBO solver complete  4 units assigned",
  "9:35:00  Nemotron normalized 47 telemetry reports",
  "9:30:00  System online  Catastrophe Response Platform active",
]

export function DispatchLog({ logs }: { logs: string[] }) {
  const [allLogs, setAllLogs] = useState<string[]>(INITIAL_LOGS)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
      const events = [
        `${now}  Telemetry ingested  structural damage detected`,
        `${now}  QUBO optimization cycle complete`,
        `${now}  Weather alert  wind speeds increasing near coast`,
      ]
      const event = events[Math.floor(Math.random() * events.length)]
      setAllLogs((prev) => [event, ...prev].slice(0, 30))
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  const displayLogs = logs.length > 0 ? logs : allLogs

  return (
    <div className="flex-1 min-h-0 border border-[#2D323E] bg-[#0F1117] flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-[#2D323E] bg-[#11141A] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[#3B82F6]" />
          <span className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">Dispatch Audit Log</span>
        </div>
        <span className="text-[10px] text-[#94A3B8]">Live audit trail</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[10px] pr-1">
        {displayLogs.length > 0 ? (
          displayLogs.map((log, i) => {
            const isAlert = log.includes("alert") || log.includes("Severe") || log.includes("severity=10") || log.includes("Critical")
            return (
              <div key={i} className={`px-3 py-0.5 ${isAlert ? "text-[#EF4444] font-bold" : "text-[#94A3B8]"}`}>
                {log}
              </div>
            )
          })
        ) : (
          <div className="px-3 py-2 text-[#64748B] italic">No dispatch events yet.</div>
        )}
      </div>
    </div>
  )
}
