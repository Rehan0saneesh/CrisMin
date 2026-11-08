"use client"

import { useState } from "react"
import { Bell, User, Wifi, Clock, Play, Send, RefreshCw } from "lucide-react"

export function TopNav() {
  const [connected, setConnected] = useState(true)

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0F1117] border-b border-[#2D323E] h-14 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#3B82F6] border border-[#2D323E] flex items-center justify-center">
            <span className="text-white text-xs font-bold">SF</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#F8FAFC] tracking-tight leading-none">
              CrisMin
            </h1>
            <p className="text-[10px] text-[#94A3B8] leading-none">
              State Farm Catastrophe Response &amp; Optimization Platform
            </p>
          </div>
        </div>

        <div className="h-6 w-px bg-[#2D323E] mx-2" />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1E222B] border border-[#2D323E]">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#10B981]" : "bg-[#EF4444]"}`} />
            <span className="text-xs text-[#94A3B8]">System Online</span>
          </div>

          <div className="h-6 w-px bg-[#2D323E] mx-2" />

          <button className="btn-primary flex items-center gap-1.5">
            <Send size={14} /> Ingest Telemetry
          </button>
          <button className="btn-primary flex items-center gap-1.5">
            <Play size={14} /> Run Optimization
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#1E222B] border border-[#2D323E]">
          <Wifi size={14} className="text-[#94A3B8]" />
          <span className="text-xs text-[#F8FAFC]">All Services Operational</span>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#1E222B] border border-[#2D323E]">
          <Clock size={14} className="text-[#94A3B8]" />
          <span className="text-xs text-[#F8FAFC]" id="live-clock">--:--:--</span>
        </div>

        <div className="h-6 w-px bg-[#2D323E] mx-2" />

        <div className="flex items-center gap-2">
          <button className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors" title="Notifications">
            <Bell size={16} />
          </button>
          <button className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors" title="Operator Profile">
            <User size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
