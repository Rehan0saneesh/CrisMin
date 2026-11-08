"use client"

import { useEffect, useState } from "react"

const ALERTS = [
  "Severe Thunderstorm  Mobile, AL  10:14 AM",
  "Hurricane Watch  Gulf Coast  10:09 AM",
  "Flash Flood Warning  New Orleans, LA  10:03 AM",
  "Tornado Warning  Pensacola, FL  9:58 AM",
]

export function RedAlertWidget() {
  const [alerts, setAlerts] = useState(ALERTS)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      const newAlert = `Severe Weather Update  Coastal Zone  ${now}`
      setAlerts((prev) => [newAlert, ...prev].slice(0, 4))
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed bottom-4 right-4 w-72 rounded border border-red-500/30 bg-red-950/90 p-3 z-50 backdrop-blur">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">red alert</span>
        <span className="ml-auto text-[10px] text-red-400">active</span>
      </div>
      <div className="space-y-1.5">
        {alerts.map((alert, i) => {
          const [type, area, time] = alert.split("  ")
          return (
            <div key={i} className="flex justify-between items-start">
              <div className="flex-1">
                <div className="text-[10px] font-bold text-red-200">{type}</div>
                <div className="text-[10px] text-red-200/60">{area}</div>
              </div>
              <div className="text-[9px] text-red-300/50 font-mono">{time}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 pt-1 border-t border-red-500/10">
        <div className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-red-500/50" />
          <span className="text-[10px] text-red-200">Winds 45-60 mph</span>
        </div>
      </div>
    </div>
  )
}
