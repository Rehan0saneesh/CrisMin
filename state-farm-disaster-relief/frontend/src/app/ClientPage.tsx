"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { MapComponent } from "@/components/MapComponent"
import { ClaimsTable } from "@/components/ClaimsTable"
import { KPICards } from "@/components/KPICards"
import { ResourceAllocation } from "@/components/ResourceAllocation"
import { FleetCards } from "@/components/FleetCards"
import { DispatchLog } from "@/components/DispatchLog"
import { RedAlertWidget } from "@/components/RedAlertWidget"
import { runOptimization } from "@/lib/api"
import { Play, Send, RefreshCw } from "lucide-react"

type ClaimPin = {
  id: string
  lat: number
  lng: number
  severity: number
  label: string
}

type UnitPin = {
  id: string
  lat: number
  lng: number
  status: "Deployed" | "En Route" | "Idle"
  label: string
}

const MOCK_CLAIM_PINS: ClaimPin[] = [
  { id: "1", lat: 30.69, lng: -88.04, severity: 9, label: "Claim #4 - Mobile, AL" },
  { id: "2", lat: 30.37, lng: -89.09, severity: 8, label: "Claim #11 - Gulfport, MS" },
  { id: "3", lat: 30.42, lng: -87.22, severity: 10, label: "Claim #18 - Pensacola, FL" },
  { id: "4", lat: 30.39, lng: -88.89, severity: 6, label: "Claim #23 - Biloxi, MS" },
]

const MOCK_UNIT_PINS: UnitPin[] = [
  { id: "1", lat: 30.37, lng: -89.09, status: "Deployed", label: "Mobile Command Unit 1" },
  { id: "2", lat: 30.69, lng: -88.04, status: "En Route", label: "Claims Adjuster Team A" },
  { id: "3", lat: 30.42, lng: -87.22, status: "Idle", label: "Supply Truck Delta" },
]

export default function ClientPage() {
  const [reports, setReports] = useState<string[]>([""])
  const [optimizationResult, setOptimizationResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message])
  }

  const handleIngest = async () => {
    const validReports = reports.filter((r) => r.trim().length > 0)
    if (validReports.length === 0) return
    setIsLoading(true)
    addLog(`Ingesting ${validReports.length} telemetry reports`)
    setIsLoading(false)
  }

  const handleOptimize = async () => {
    const validReports = reports.filter((r) => r.trim().length > 0)
    if (validReports.length === 0) return
    setIsLoading(true)
    addLog("Compiling QUBO Hamiltonian launching solver")
    try {
      const result = await runOptimization(validReports, 2)
      setOptimizationResult(result)
      addLog(`Solver complete  energy ${result.best_energy.toFixed(2)}`)
    } catch (err) {
      addLog(`Optimization error  ${(err as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    addLog("Dashboard initialized monitoring Gulf Coast")
  }, [])

  const deployedCount = optimizationResult?.deployed_zones?.filter((z: any) => z.deployed).length || 0
  const pendingCount = optimizationResult?.deployed_zones?.filter((z: any) => !z.deployed).length || 0

  return (
    <div className="min-h-screen bg-black text-slate-300 p-4 md:p-6">
      <RedAlertWidget />

      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-sm font-bold text-slate-100 tracking-tight">crismin</h1>
          <p className="text-[10px] text-slate-500">state farm catastrophe response  optimization platform</p>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={handleIngest}
            disabled={isLoading}
            className="px-3 py-1.5 rounded border border-slate-700 bg-slate-900/50 text-xs font-medium text-slate-300 hover:bg-slate-800/70 transition disabled:opacity-50"
          >
            <Send size={14} className="mr-1" /> ingest telemetry
          </button>
          <button
            onClick={handleOptimize}
            disabled={isLoading}
            className="px-3 py-1.5 rounded border border-slate-700 bg-slate-900/50 text-xs font-medium text-slate-300 hover:bg-slate-800/70 transition disabled:opacity-50"
          >
            <Play size={14} className="mr-1" /> run optimization
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-[10px] text-slate-500 hover:text-slate-300 underline"
          >
            <RefreshCw size={12} className="mr-1" /> refresh
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <KPICards
          totalClaims={4157}
          deployedUnits={deployedCount || 2}
          pendingUnits={pendingCount || 5}
        />

        <div className="lg:col-span-3 flex flex-col lg:flex-row gap-4 min-h-[520px]">
          <div className="flex-1 min-h-[400px] rounded border border-slate-800 overflow-hidden">
            <MapComponent claims={MOCK_CLAIM_PINS} units={MOCK_UNIT_PINS} />
          </div>
          <div className="w-full lg:w-80 flex flex-col gap-4">
            <ClaimsTable />
            <FleetCards />
          </div>
        </div>

        <div className="flex-1">
          <ResourceAllocation />
        </div>
      </div>

      <div className="mt-5 flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <DispatchLog logs={logs} />
        </div>
      </div>

      {isLoading && (
        <div className="fixed bottom-4 left-4 rounded border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 animate-pulse">
          processing
        </div>
      )}
    </div>
  )
}
