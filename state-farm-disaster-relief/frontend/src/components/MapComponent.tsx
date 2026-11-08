"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { Circle, CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "maplibre-gl/dist/maplibre-gl.css"
// Registers L.maplibreGL: renders MapLibre vector tiles as a Leaflet layer.
import "@maplibre/maplibre-gl-leaflet"
import { CloudLightning, CloudOff, MapPin, Maximize2, Route, Truck, Map as MapIcon, type LucideIcon } from "lucide-react"
import type { Claim, Prediction, Unit } from "@/lib/api"
import { fmtDuration, fmtSeverity, pct } from "@/lib/data"
import { color, severityTone, toneHex, unitTone } from "@/lib/tokens"
import { Button, Pane, PaneHeader, PaneTitle, cn } from "./ui"

const DEFAULT_CENTER: [number, number] = [30.25, -88.3]
const DEFAULT_ZOOM = 8

/**
 * Basemap: OpenFreeMap vector tiles. Free, no API key, no request limits,
 * commercial use allowed. Other styles: /styles/fiord (slate blue),
 * /styles/liberty (light streets), /styles/positron (light grey).
 */
const BASEMAP_STYLE = process.env.NEXT_PUBLIC_BASEMAP_STYLE || "https://tiles.openfreemap.org/styles/dark"
const BASEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'

function Basemap({ onError }: { onError: (failed: boolean) => void }) {
  const map = useMap()
  useEffect(() => {
    const layer = L.maplibreGL({
      style: BASEMAP_STYLE,
      // The plugin forwards customAttribution to Leaflet's attribution control.
      attributionControl: { customAttribution: BASEMAP_ATTRIBUTION },
    })
    layer.addTo(map)
    const gl = layer.getMaplibreMap()
    // Style or tile fetch failures (offline, blocked network) surface as a notice.
    const handleError = () => onError(true)
    const handleLoad = () => onError(false)
    gl.on("error", handleError)
    gl.on("load", handleLoad)
    return () => {
      gl.off("error", handleError)
      gl.off("load", handleLoad)
      layer.remove()
    }
  }, [map, onError])
  return null
}

type Props = {
  claims: Claim[]
  units: Unit[]
  predictions: Prediction[]
  threshold: number
  timeScale: number
  selectedClaimId: string | null
  selectedUnitId: string | null
  onSelectClaim: (id: string) => void
  onSelectUnit: (id: string) => void
}

const iconCache = new Map<string, L.DivIcon>()
function pinIcon(shape: "circle" | "square", fill: string, size: number, selected: boolean) {
  const key = `${shape}|${fill}|${size}|${selected}`
  let icon = iconCache.get(key)
  if (!icon) {
    const radius = shape === "circle" ? "50%" : "3px"
    const border = selected ? color.zinc100 : color.zinc950
    icon = L.divIcon({
      className: "",
      html: `<div class="map-pin${selected ? " is-selected" : ""}" style="width:${size}px;height:${size}px;background:${fill};border:2px solid ${border};border-radius:${radius};box-shadow:0 1px 2px rgba(0,0,0,.5)"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2 - 2],
    })
    iconCache.set(key, icon)
  }
  return icon
}

/**
 * Unit pin: status-colored square plus one permanent label that travels with
 * the unit and says where it is going: "ADJ-01 → 4003 · 4m", "ADJ-02 · on scene 12m".
 */
function unitIcon(id: string, fill: string, selected: boolean, detail: string, state: "idle" | "enroute" | "onscene", dy = 0) {
  const esc = (t: string) => t.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!)
  return L.divIcon({
    className: "",
    html: `<div class="unit-pin is-${state}${selected ? " is-selected" : ""}"><span class="unit-sq" style="background:${fill}"></span><span class="unit-lbl" style="margin-top:${dy}px"><b>${esc(id)}</b>${detail ? ` ${esc(detail)}` : ""}</span></div>`,
    iconSize: [13, 13],
    iconAnchor: [6.5, 6.5],
    popupAnchor: [0, -9],
  })
}

function unitDetail(u: Unit, claimById: Map<string, Claim>, timeScale: number) {
  if (u.status === "En Route") {
    const num = claimById.get(u.assigned_claim ?? "")?.claim_number.replace("CLM-", "") ?? ""
    return `→ ${num} · ${fmtDuration(u.eta_s, timeScale)}`
  }
  if (u.status === "Deployed") return `· on scene ${fmtDuration(u.service_s, timeScale)}`
  return ""
}

/**
 * Unit markers with label decluttering: labels that would overlap on screen
 * at the current zoom are stacked into a column next to their pins.
 */
function UnitMarkers({ units, claimById, selectedUnitId, onSelectUnit, timeScale }: {
  units: Unit[]
  claimById: Map<string, Claim>
  selectedUnitId: string | null
  onSelectUnit: (id: string) => void
  timeScale: number
}) {
  const map = useMap()
  const [view, setView] = useState(0)
  useMapEvents({ zoomend: () => setView((v) => v + 1) })

  const offsets = useMemo(() => {
    const LINE = 16
    const boxes: { x0: number; x1: number; y0: number; y1: number }[] = []
    const out = new Map<string, number>()
    const placed = units
      .map((u) => {
        const pt = map.latLngToLayerPoint([u.lat, u.lng])
        const text = `${u.id} ${unitDetail(u, claimById, timeScale)}`.trim()
        return { u, x: pt.x + 17, y: pt.y, w: text.length * 6.2 + 10 }
      })
      .sort((a, b) => a.y - b.y || a.x - b.x)
    for (const p of placed) {
      let dy = 0
      for (let tries = 0; tries < 8; tries++) {
        const box = { x0: p.x, x1: p.x + p.w, y0: p.y + dy - LINE / 2, y1: p.y + dy + LINE / 2 }
        const hit = boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)
        if (!hit) {
          boxes.push(box)
          break
        }
        dy += LINE + 2
      }
      out.set(p.u.id, dy)
    }
    return out
    // `view` re-runs placement after zooming.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, claimById, timeScale, map, view])

  return (
    <>
      {units.map((u) => (
        <Marker
          key={u.id}
          position={[u.lat, u.lng]}
          icon={unitIcon(
            u.id,
            toneHex(unitTone(u.status)),
            u.id === selectedUnitId,
            unitDetail(u, claimById, timeScale),
            u.status === "En Route" ? "enroute" : u.status === "Deployed" ? "onscene" : "idle",
            offsets.get(u.id) ?? 0,
          )}
          zIndexOffset={u.id === selectedUnitId ? 1500 : 500}
          eventHandlers={{ click: () => onSelectUnit(u.id) }}
        >
          <Popup>
            <div className="text-xs font-medium text-zinc-100">{u.name}</div>
            <div className="font-mono text-[11px] text-zinc-500">
              {u.id} · {u.status.toLowerCase()}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function FlyToSelection({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 9), { duration: 0.5 })
  }, [target, map])
  return null
}

/** Exposes fit-to-data to the header button via a counter prop. */
function FitBounds({ points, nonce }: { points: [number, number][]; nonce: number }) {
  const map = useMap()
  useEffect(() => {
    if (nonce && points.length) map.flyToBounds(L.latLngBounds(points), { padding: [48, 48], duration: 0.5 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce])
  return null
}

function Readout() {
  const map = useMap()
  const [pos, setPos] = useState<L.LatLng>(map.getCenter())
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({ mousemove: (e) => setPos(e.latlng), zoomend: () => setZoom(map.getZoom()) })
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-[400] flex h-6 items-center gap-2.5 rounded-md border border-zinc-800/80 bg-zinc-950/85 px-2 font-mono text-[11px] tabular-nums text-zinc-400 backdrop-blur">
      <span>{pos.lat.toFixed(4)}°N</span>
      <span>{Math.abs(pos.lng).toFixed(4)}°W</span>
      <span className="h-3 w-px bg-zinc-800" />
      <span>z{zoom}</span>
    </div>
  )
}

function ZoomControl() {
  const map = useMap()
  useEffect(() => {
    const ctl = L.control.zoom({ position: "topleft" })
    ctl.addTo(map)
    return () => {
      ctl.remove()
    }
  }, [map])
  return null
}

type LayerKey = "hazards" | "claims" | "units" | "routes"
const LAYERS: { id: LayerKey; label: string; icon: LucideIcon }[] = [
  { id: "hazards", label: "Storm overlays", icon: CloudLightning },
  { id: "claims", label: "Claims", icon: MapPin },
  { id: "units", label: "Units", icon: Truck },
  { id: "routes", label: "Routes & predictions", icon: Route },
]

export function MapComponent({ claims: allClaims, units, predictions, threshold, timeScale, selectedClaimId, selectedUnitId, onSelectClaim, onSelectUnit }: Props) {
  // Pending claims have no coordinates until Nemotron + geocoding finish.
  const claims = useMemo(() => allClaims.filter((c) => c.lat !== null && c.lng !== null) as (Claim & { lat: number; lng: number })[], [allClaims])
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ hazards: true, claims: true, units: true, routes: true })
  const [fitNonce, setFitNonce] = useState(0)
  const [basemapFailed, setBasemapFailed] = useState(false)

  const flyTarget = useMemo(() => {
    const c = claims.find((x) => x.id === selectedClaimId)
    if (c) return { lat: c.lat, lng: c.lng }
    const u = units.find((x) => x.id === selectedUnitId)
    return u ? { lat: u.lat, lng: u.lng } : null
    // Re-fly only when the selection changes, not on every data update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClaimId, selectedUnitId])

  const claimById = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims])
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])
  const allPoints = useMemo<[number, number][]>(
    () => [...claims, ...units].map((p) => [p.lat, p.lng]),
    [claims, units],
  )

  return (
    <Pane className="h-full">
      <PaneHeader>
        <PaneTitle icon={MapIcon} meta={`${claims.filter((c) => c.status !== "resolved").length} claims · ${units.length} units · ${predictions.length} predicted`}>
          Operations map
        </PaneTitle>
        <div className="flex items-center gap-0.5">
          {LAYERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setLayers((l) => ({ ...l, [id]: !l[id] }))}
              aria-pressed={layers[id]}
              title={`${layers[id] ? "Hide" : "Show"} ${label.toLowerCase()}`}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150",
                layers[id] ? "bg-zinc-800 text-zinc-100" : "text-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-300",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-zinc-800" />
          <Button variant="ghost" size="icon-sm" icon={Maximize2} onClick={() => setFitNonce((n) => n + 1)} title="Fit to data" aria-label="Fit to data" />
        </div>
      </PaneHeader>

      <div className="relative isolate min-h-0 flex-1">
        <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="h-full w-full" zoomControl={false}>
          <Basemap onError={setBasemapFailed} />
          <ZoomControl />
          <FlyToSelection target={flyTarget} />
          <FitBounds points={allPoints} nonce={fitNonce} />
          <Readout />

          {layers.hazards && (
            <>
              <Polygon
                positions={[[28.6, -90.4], [29.6, -89.2], [30.9, -88.0], [31.3, -86.6], [30.6, -85.4], [29.6, -85.9], [28.8, -87.2], [28.2, -88.9]]}
                pathOptions={{ color: color.critical, weight: 1, opacity: 0.6, fillColor: color.critical, fillOpacity: 0.06 }}
              >
                <Popup>
                  <div className="text-xs font-medium text-red-400">Hurricane tracking cone</div>
                  <div className="text-xs text-zinc-400">Projected 48h path</div>
                </Popup>
              </Polygon>
              <Circle
                center={[30.3, -88.6]}
                radius={55_000}
                pathOptions={{ color: color.warning, weight: 1, opacity: 0.6, fillColor: color.warning, fillOpacity: 0.05 }}
              >
                <Popup>
                  <div className="text-xs font-medium text-amber-400">Severe storm impact zone</div>
                </Popup>
              </Circle>
              <Polyline
                positions={[[28.2, -91.5], [29.4, -90.0], [30.4, -88.4], [31.4, -86.6], [32.4, -85.0]]}
                pathOptions={{ color: color.zinc500, weight: 1, dashArray: "4 6", opacity: 0.7 }}
              >
                <Popup>
                  <div className="text-xs">Weather front</div>
                </Popup>
              </Polyline>
            </>
          )}

          {layers.routes &&
            units
              .filter((u) => u.assigned_claim && claimById.has(u.assigned_claim))
              .map((u) => {
                const c = claimById.get(u.assigned_claim!)!
                const hex = toneHex(unitTone(u.status))
                return (
                  <Fragment key={`route-${u.id}`}>
                    <CircleMarker
                      center={[c.lat, c.lng]}
                      radius={11}
                      pathOptions={{ color: hex, weight: 1.5, opacity: 0.9, fill: false }}
                      interactive={false}
                    />
                    {u.status === "En Route" && (
                      <Polyline positions={[[u.lat, u.lng], [c.lat, c.lng]]} pathOptions={{ color: hex, weight: 2, opacity: 0.95 }} />
                    )}
                  </Fragment>
                )
              })}

          {layers.routes &&
            predictions.map((p) => {
              const u = unitById.get(p.unit_id)
              const c = claimById.get(p.claim_id)
              if (!u || !c) return null
              const ready = p.confidence >= threshold
              return (
                <Polyline
                  key={`pred-${p.unit_id}-${p.claim_id}`}
                  positions={[[u.lat, u.lng], [c.lat, c.lng]]}
                  pathOptions={{
                    color: ready ? color.success : color.zinc400,
                    weight: 1.25,
                    dashArray: "2 5",
                    opacity: 0.25 + 0.65 * p.confidence,
                  }}
                >
                  <Tooltip permanent direction="center" className={cn("route-label", ready && "is-ready")} opacity={1}>
                    {pct(p.confidence)}
                  </Tooltip>
                </Polyline>
              )
            })}

          {layers.claims &&
            claims.map((c) => (
              <Marker
                key={c.id}
                position={[c.lat, c.lng]}
                icon={pinIcon("circle", c.status === "resolved" ? color.zinc600 : toneHex(severityTone(c.severity)), c.status === "resolved" ? 7 : 11, c.id === selectedClaimId)}
                zIndexOffset={c.id === selectedClaimId ? 1000 : 0}
                eventHandlers={{ click: () => onSelectClaim(c.id) }}
              >
                <Popup>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-mono text-xs text-zinc-100">{c.claim_number}</span>
                    <span className="font-mono text-[11px] text-zinc-500">sev {fmtSeverity(c.severity)}</span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {c.location} · {c.damage_type}
                  </div>
                  <p className="mt-1.5 max-w-[240px] text-[11px] leading-4 text-zinc-500">{c.report}</p>
                  <div className="mt-1.5 font-mono text-[10px] text-zinc-500">
                    {c.source === "nemotron" ? `nemotron · conf ${pct(c.extraction_confidence)}` : "keyword rules"}
                  </div>
                  {c.assigned_unit && <div className="mt-1 font-mono text-[11px] text-blue-400">→ {c.assigned_unit}</div>}
                  {!c.assigned_unit && c.prediction && (
                    <div className="mt-1 font-mono text-[11px] text-zinc-300">
                      predicted {c.prediction.unit_id} · {pct(c.prediction.confidence)}
                    </div>
                  )}
                </Popup>
              </Marker>
            ))}

          {layers.units && (
            <UnitMarkers
              units={units}
              claimById={claimById}
              selectedUnitId={selectedUnitId}
              onSelectUnit={onSelectUnit}
              timeScale={timeScale}
            />
          )}
        </MapContainer>

        {basemapFailed && (
          <div className="absolute left-12 top-2 z-[450] flex h-7 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/90 px-2.5 text-xs text-zinc-400 backdrop-blur animate-fade-in">
            <CloudOff className="h-3.5 w-3.5 text-zinc-500" />
            Basemap unavailable · overlays still live
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 right-2 z-[400] hidden flex-col gap-1 rounded-md border border-zinc-800/80 bg-zinc-950/85 px-2.5 py-2 text-[11px] text-zinc-400 backdrop-blur lg:flex">
          <Legend shape="circle" c={color.critical} label="Severity ≥ 8" />
          <Legend shape="circle" c={color.warning} label="Severity 5–7" />
          <Legend shape="circle" c={color.success} label="Severity < 5" />
          <Legend shape="circle" c={color.zinc600} label="Unscored" />
          <span className="my-0.5 h-px bg-zinc-800" />
          <Legend shape="square" c={color.accent} label="Unit deployed" />
          <Legend shape="square" c={color.warning} label="Unit en route" />
          <Legend shape="square" c={color.success} label="Unit idle" />
          <span className="my-0.5 h-px bg-zinc-800" />
          <span className="flex items-center gap-2"><span className="w-3 border-t-2 border-amber-500" />Dispatched (label: dest · ETA)</span>
          <span className="flex items-center gap-2"><span className="w-3 border-t border-dashed border-zinc-400" />Predicted route</span>
          <span className="flex items-center gap-2"><span className="w-3 border-t border-dashed border-emerald-500" />≥ {Math.round(threshold * 100)}% · committing</span>
        </div>
      </div>
    </Pane>
  )
}

function Legend({ shape, c, label }: { shape: "circle" | "square"; c: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("h-2 w-2", shape === "circle" ? "rounded-full" : "rounded-[2px]")} style={{ backgroundColor: c }} />
      {label}
    </span>
  )
}
