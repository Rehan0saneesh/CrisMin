"use strict"

type ClaimRow = {
  id: string
  claimNumber: string
  location: string
  damageType: string
  timestamp: string
  severity: number
}

const MOCK_CLAIMS: ClaimRow[] = [
  { id: "1", claimNumber: "CLM-4004", location: "Mobile, AL", damageType: "Roof Damage", timestamp: "10:14:22", severity: 9 },
  { id: "2", claimNumber: "CLM-4011", location: "Gulfport, MS", damageType: "Water Intrusion", timestamp: "10:09:15", severity: 8 },
  { id: "3", claimNumber: "CLM-4018", location: "Pensacola, FL", damageType: "Structural Collapse", timestamp: "10:03:48", severity: 10 },
  { id: "4", claimNumber: "CLM-4023", location: "Biloxi, MS", damageType: "Roof Damage", timestamp: "9:58:30", severity: 6 },
  { id: "5", claimNumber: "CLM-4031", location: "New Orleans, LA", damageType: "Flooding", timestamp: "9:52:10", severity: 8 },
  { id: "6", claimNumber: "CLM-4037", location: "Mobile, AL", damageType: "Shingle Loss", timestamp: "9:45:00", severity: 4 },
  { id: "7", claimNumber: "CLM-4042", location: "Gulfport, MS", damageType: "Water Intrusion", timestamp: "9:38:45", severity: 5 },
  { id: "8", claimNumber: "CLM-4049", location: "Pensacola, FL", damageType: "Downed Power Lines", timestamp: "9:30:12", severity: 8 },
]

function severityBar(severity: number) {
  const width = (severity / 10) * 100
  const color = severity >= 8 ? "#EF4444" : severity >= 5 ? "#F59E0B" : "#10B981"
  return (
    <div className="w-full h-1 bg-[#2D323E] overflow-hidden">
      <div className="h-full" style={{ width: `${width}%`, backgroundColor: color }} />
    </div>
  )
}

export function ClaimsTable() {
  return (
    <div className="flex-1 min-h-0 border border-[#2D323E] bg-[#1E222B] flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-[#2D323E] bg-[#11141A] flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">Incoming Claims Feed</span>
        <span className="text-[10px] text-[#94A3B8] font-mono">{MOCK_CLAIMS.length} active</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="text-[#94A3B8] border-b border-[#2D323E]">
              <th className="px-3 py-1.5 font-medium uppercase tracking-wider w-16">Claim ID</th>
              <th className="px-3 py-1.5 font-medium uppercase tracking-wider w-24">Location</th>
              <th className="px-3 py-1.5 font-medium uppercase tracking-wider w-32">Damage Type</th>
              <th className="px-3 py-1.5 font-medium uppercase tracking-wider w-16">Time</th>
              <th className="px-3 py-1.5 font-medium uppercase tracking-wider w-20 text-right">Severity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2D323E]">
            {MOCK_CLAIMS.map((claim, i) => (
              <tr key={claim.id} className="hover:bg-[#11141A] transition-colors group">
                <td className="px-3 py-1.5 text-[#F8FAFC] font-mono">{claim.claimNumber}</td>
                <td className="px-3 py-1.5 text-[#E2E8F0]">{claim.location}</td>
                <td className="px-3 py-1.5 text-[#CBD5E1] capitalize">{claim.damageType}</td>
                <td className="px-3 py-1.5 text-[#94A3B8] font-mono">{claim.timestamp}</td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    {severityBar(claim.severity)}
                    <span className={`ml-1 text-[10px] font-bold whitespace-nowrap ${claim.severity >= 8 ? "text-[#EF4444]" : claim.severity >= 5 ? "text-[#F59E0B]" : "text-[#10B981]"}`}>{claim.severity}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
