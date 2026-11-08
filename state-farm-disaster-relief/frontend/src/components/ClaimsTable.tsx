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
  { id: "1", claimNumber: "Claim #4", location: "Mobile, AL", damageType: "Roof Damage", timestamp: "10:14 AM", severity: 9 },
  { id: "2", claimNumber: "Claim #11", location: "Gulfport, MS", damageType: "Water Intrusion", timestamp: "10:09 AM", severity: 8 },
  { id: "3", claimNumber: "Claim #18", location: "Pensacola, FL", damageType: "Structural Collapse", timestamp: "10:03 AM", severity: 10 },
  { id: "4", claimNumber: "Claim #23", location: "Biloxi, MS", damageType: "Roof Damage", timestamp: "9:58 AM", severity: 6 },
  { id: "5", claimNumber: "Claim #31", location: "New Orleans, LA", damageType: "Flooding", timestamp: "9:52 AM", severity: 7 },
  { id: "6", claimNumber: "Claim #37", location: "Mobile, AL", damageType: "Shingle Loss", timestamp: "9:45 AM", severity: 4 },
  { id: "7", claimNumber: "Claim #42", location: "Gulfport, MS", damageType: "Water Intrusion", timestamp: "9:38 AM", severity: 5 },
  { id: "8", claimNumber: "Claim #49", location: "Pensacola, FL", damageType: "Downed Power Lines", timestamp: "9:30 AM", severity: 8 },
]

function severityDot(severity: number) {
  const color = severity >= 8 ? "#ef4444" : severity >= 5 ? "#f59e0b" : "#22c55e"
  return (
    <div
      className="w-2 h-2 rounded-full"
      style={{ backgroundColor: color }}
    />
  )
}

export function ClaimsTable() {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400">
            <th className="pb-2 font-medium w-16">Claim</th>
            <th className="pb-2 font-medium w-24">Location</th>
            <th className="pb-2 font-medium w-32">Damage</th>
            <th className="pb-2 font-medium w-16">Time</th>
            <th className="pb-2 font-medium w-20">Severity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {MOCK_CLAIMS.map((claim, i) => (
            <tr key={claim.id} className="hover:bg-slate-800/30 transition group">
              <td className="py-2 text-slate-200 font-mono">{claim.claimNumber}</td>
              <td className="py-2 text-slate-300">{claim.location}</td>
              <td className="py-2 text-slate-300 capitalize">{claim.damageType}</td>
              <td className="py-2 text-slate-400 font-mono">{claim.timestamp}</td>
              <td className="py-2 flex items-center gap-2">
                <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${claim.severity * 10}%` }} />
                </div>
                <span className={`text-xs font-bold ${claim.severity >= 8 ? "text-red-400" : claim.severity >= 5 ? "text-amber-400" : "text-emerald-400"}`}>
                  {claim.severity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
