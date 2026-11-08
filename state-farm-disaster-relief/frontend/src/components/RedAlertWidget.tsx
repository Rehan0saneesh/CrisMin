"use client"

import { AlertTriangle, CloudRain, Wind } from "lucide-react"

const ALERTS = [
  { type: "Severe Thunderstorm", area: "Mobile, AL", time: "10:14", icon: "cloud-rain" },
  { type: "Hurricane Watch", area: "Gulf Coast", time: "10:09", icon: "wind" },
  { type: "Flash Flood Warning", area: "New Orleans, LA", time: "10:03", icon: "cloud-rain" },
  { type: "Tornado Warning", area: "Pensacola, FL", time: "9:58", icon: "alert-triangle" },
]

const icons: Record<string, any> = {
  "cloud-rain": CloudRain,
  wind: Wind,
  "alert-triangle": AlertTriangle,
}

export function RedAlertWidget() {
  return (
    <div className="fixed bottom-4 right-4 w-72 z-50 border border-[#330000] bg-[#110000]/90 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-none bg-[#EF4444] animate-pulse" />
        <span className="text-[10px] font-bold text-[#FF6B6B] uppercase tracking-wider">RED ALERT</span>
        <span className="ml-auto text-[10px] text-[#EF4444]">ACTIVE</span>
      </div>
      <div className="space-y-1.5">
        {ALERTS.map((alert, i) => {
          const Icon = icons[alert.icon] || AlertTriangle
          const [type, area, time] = [alert.type, alert.area, alert.time]
          return (
            <div key={i} className="flex justify-between items-start">
              <div className="flex-1">
                <div className="text-[10px] font-bold text-[#F8FAFC]">{type}</div>
                <div className="text-[10px] text-[#94A3B8/80]">{area}</div>
              </div>
              <div className="text-[9px] text-[#EF4444]/60 font-mono">{time}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 pt-1 border-t border-[#330000]">
        <div className="flex items-center gap-1.5">
          <Wind size={12} className="text-[#EF4444]/50" />
          <span className="text-[10px] text-[#F8FAFC]/70">Winds 45-60 mph</span>
        </div>
      </div>
    </div>
  )
}
