"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, X } from "lucide-react"
import { DAMAGE_TYPES, LOCATIONS } from "@/lib/data"
import { Button, Kbd } from "./ui"

const SAMPLES = [
  "911 transcript: caller reports tornado tore roof off, total loss, two adults sheltering in bathroom.",
  "Policyholder reports moderate roof damage, shingles missing over garage, no water inside.",
  "Fallen branch dented gutter, minor cosmetic damage to fascia.",
]

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (report: string, location: string, damageType: string) => Promise<boolean>
  submitting: boolean
  disabled: boolean
}

const selectCls =
  "h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-[13px] text-zinc-200 outline-none transition-colors duration-150 hover:border-zinc-700 focus:border-zinc-500"

export function IngestDialog({ open, onClose, onSubmit, submitting, disabled }: Props) {
  const [report, setReport] = useState("")
  const [location, setLocation] = useState(Object.keys(LOCATIONS)[0])
  const [damageType, setDamageType] = useState<string>(DAMAGE_TYPES[0])
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 20)
  }, [open])

  if (!open) return null

  const submit = async () => {
    if (!report.trim() || submitting || disabled) return
    if (await onSubmit(report.trim(), location, damageType)) {
      setReport("")
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 px-4 pt-[12vh] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit()
      }}
    >
      <div role="dialog" aria-modal aria-labelledby="ingest-title" className="w-full max-w-[520px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50">
        <div className="flex h-11 items-center justify-between border-b border-zinc-800/80 px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
            <h2 id="ingest-title" className="text-[13px] font-medium text-zinc-100">
              New loss report
            </h2>
          </div>
          <Button variant="ghost" size="icon-sm" icon={X} onClick={onClose} aria-label="Close" />
        </div>

        <div className="space-y-3 p-4">
          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-400">Report text</span>
            <textarea
              ref={ref}
              value={report}
              onChange={(e) => setReport(e.target.value)}
              rows={4}
              placeholder="Paste a 911 transcript, adjuster note, or policyholder report…"
              className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[13px] text-zinc-100 outline-none transition-colors duration-150 placeholder:text-zinc-600 hover:border-zinc-700 focus:border-zinc-500"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-2xs text-zinc-600">Samples:</span>
            {SAMPLES.map((s, i) => (
              <button
                key={i}
                onClick={() => setReport(s)}
                className="rounded border border-zinc-800 px-1.5 text-2xs text-zinc-400 transition-colors duration-150 hover:border-zinc-700 hover:text-zinc-200"
              >
                {["Critical", "Moderate", "Minor"][i]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs text-zinc-400">Location</span>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className={selectCls}>
                {Object.keys(LOCATIONS).map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-zinc-400">Damage type</span>
              <select value={damageType} onChange={(e) => setDamageType(e.target.value)} className={selectCls}>
                {DAMAGE_TYPES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
          <p className="flex items-center gap-1.5 text-2xs text-zinc-500"><Kbd>⌘</Kbd><Kbd>↵</Kbd> to submit · <Kbd>Esc</Kbd> to close</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submit} loading={submitting} disabled={!report.trim() || disabled}>
              Ingest report
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
