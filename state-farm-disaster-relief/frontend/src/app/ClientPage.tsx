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
import { TopNav } from "@/components/TopNav"
import { Sidebar } from "@/components/Sidebar"
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
  { id: "1", lat: 30.69, lng: -88.04, severity: 9, label: "CLM-4004 - Mobile, AL" },
  { id: "2", lat: 30.37, lng: -89.09, severity: 8, label: "CLM-4011 - Gulfport, MS" },
  { id: "3", lat: 30.42, lng: -87.22, severity: 10, label: "CLM-4018 - Pensacola, FL" },
  { id: "4", lat: 30.39, lng: -88.89, severity: 6, label: "CLM-4023 - Biloxi, MS" },
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
      addLog(`Solver complete energy ${result.best_energy.toFixed(2)}`)
    } catch (err) {
      addLog(`Optimization error ${(err as Error).message}`)
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
    <div className="min-h-screen bg-[#0F1117] text-[#F8FAFC]">
      <RedAlertWidget />

      <TopNav />

      <div className="pt-14 pb-6">
        {/* Top metric bar */}
        <div className="flex gap-3 px-4 mb-4">
          <KPICards
            totalClaims={4157}
            deployedUnits={deployedCount || 2}
            pendingUnits={pendingCount || 5}
          />
        </div>

        {/* Main layout: Sidebar + Map + Bottom Dock */}
        <div className="flex flex-col lg:flex-row gap-4 px-4 h-[calc(100vh-220px)] max-h-[700px]">
          <Sidebar />

          {/* Map viewport */}
          <div className="flex-1 min-h-0 border border-[#2D323E] bg-[#0F1117] relative overflow-hidden flex flex-col">
            <MapComponent claims={MOCK_CLAIM_PINS} units={MOCK_UNIT_PINS} />
          </div>
        </div>

        {/* Bottom dock: Claims + Resource + Fleet */}
        <div className="mt-3 flex flex-col lg:flex-row gap-4 px-4 h-[300px]">
          <div className="flex-1 min-h-0">
            <ClaimsTable />
          </div>
          <div className="lg:w-80 flex flex-col gap-3 min-h-0">
            <ResourceAllocation />
            <FleetCards />
          </div>
        </div>

        {/* Bottom dispatch log */}
        <div className="mt-3 px-4">
          <DispatchLog logs={logs} />
        </div>
      </div>

      {isLoading && (
        <div className="fixed bottom-4 left-4 rounded-none border border-[#2D323E] bg-[#1E222B] px-3 py-1.5 text-[10px] text-[#F8FAFC]">
          Processing
        </div>
      )}
    </div>
  )
}
