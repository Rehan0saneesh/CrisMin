"use client"

import { useEffect, useState } from "react"

const INITIAL_LOGS = [
  "10:15 AM  CRU Mobile Command Unit 1 deployed  Gulfport, MS  Roof Damage",
  "10:12 AM  Claims Adjuster Team A en route  Mobile, AL  Water Intrusion",
  "10:08 AM  Severe weather front crossing Mobile Bay",
  "10:05 AM  Supply Truck Delta staged  Pensacola, FL  Idle",
  "10:01 AM  Hurricane tracking cone updated  Gulf Coast",
  "9:55 AM   CRU Mobile Command Unit 2 deployed  Biloxi, MS  Structural Collapse",
  "9:48 AM   Flooding reported  New Orleans, LA  Priority High",
  "9:42 AM   QUBO solver complete  4 units assigned",
  "9:35 AM   Nemotron normalized 47 telemetry reports",
  "9:30 AM   System online  Catastrophe Response Platform active",
]

export function DispatchLog({ logs }: { logs: string[] }) {
  const [allLogs, setAllLogs] = useState<string[]>(INITIAL_LOGS)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      const events = [
        `${now}  Telemetry report ingested  structural damage detected`,
        `${now}  QUBO optimization cycle complete`,
        `${now}  Weather alert  wind speeds increasing near coast`,
      ]
      const event = events[Math.floor(Math.random() * events.length)]
      setAllLogs((prev) => [event, ...prev].slice(0, 20))
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  const displayLogs = logs.length > 0 ? logs : allLogs

  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">dispatch log</span>
        <span className="text-[10px] text-slate-600">live audit trail</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1.5 pr-2">
        {displayLogs.map((log, i) => (
          <div key={i} className="text-slate-400">
            <span className="text-slate-600">{log.split("  ")[0]}</span>{" "}
            <span className="text-slate-300">{log.split("  ").slice(1).join("  ")}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
