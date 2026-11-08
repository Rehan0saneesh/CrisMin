"use client"

import { useEffect, useMemo, useState } from "react"
import { Circle, MapContainer, Marker, Polygon, Polyline, Popup, useMap, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "maplibre-gl/dist/maplibre-gl.css"
// Registers L.maplibreGL: renders MapLibre vector tiles as a Leaflet layer.
import "@maplibre/maplibre-gl-leaflet"
import { CloudLightning, CloudOff, Loader2, MapPin, Maximize2, Route, Truck, Map as MapIcon, type LucideIcon } from "lucide-react"
import type { Claim, Unit } from "@/lib/data"
import { color, severityTone, toneHex, unitTone } from "@/lib/tokens"
import { Button, Pane, PaneHeader, PaneTitle, ProgressBar, cn } from "./ui"

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
  selectedClaimId: string | null
  selectedUnitId: string | null
  onSelectClaim: (id: string) => void
  onSelectUnit: (id: string) => void
  isOptimizing: boolean
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
  { id: "routes", label: "Dispatch routes", icon: Route },
]

export function MapComponent({ claims, units, selectedClaimId, selectedUnitId, onSelectClaim, onSelectUnit, isOptimizing }: Props) {
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
  const allPoints = useMemo<[number, number][]>(
    () => [...claims, ...units].map((p) => [p.lat, p.lng]),
    [claims, units],
  )

  return (
    <Pane className="h-full">
      <PaneHeader>
        <PaneTitle icon={MapIcon} meta={`${claims.length} claims · ${units.length} units`}>
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
              .filter((u) => u.assignedClaimId && claimById.has(u.assignedClaimId))
              .map((u) => {
                const c = claimById.get(u.assignedClaimId!)!
                return (
                  <Polyline
                    key={`route-${u.id}`}
                    positions={[[u.lat, u.lng], [c.lat, c.lng]]}
                    pathOptions={{ color: toneHex(unitTone(u.status)), weight: 1.25, dashArray: u.status === "En Route" ? "3 4" : undefined, opacity: 0.85 }}
                  />
                )
              })}

          {layers.claims &&
            claims.map((c) => (
              <Marker
                key={c.id}
                position={[c.lat, c.lng]}
                icon={pinIcon("circle", toneHex(severityTone(c.severity)), 11, c.id === selectedClaimId)}
                zIndexOffset={c.id === selectedClaimId ? 1000 : 0}
                eventHandlers={{ click: () => onSelectClaim(c.id) }}
              >
                <Popup>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-mono text-xs text-zinc-100">{c.claimNumber}</span>
                    <span className="font-mono text-[11px] text-zinc-500">sev {c.severity ?? "—"}</span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {c.location} · {c.damageType}
                  </div>
                  <p className="mt-1.5 max-w-[240px] text-[11px] leading-4 text-zinc-500">{c.report}</p>
                  {c.assignedUnitId && <div className="mt-1.5 font-mono text-[11px] text-blue-400">→ {c.assignedUnitId}</div>}
                </Popup>
              </Marker>
            ))}

          {layers.units &&
            units.map((u) => (
              <Marker
                key={u.id}
                position={[u.lat, u.lng]}
                icon={pinIcon("square", toneHex(unitTone(u.status)), 13, u.id === selectedUnitId)}
                zIndexOffset={500}
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
        </MapContainer>

        {basemapFailed && (
          <div className="absolute left-12 top-2 z-[450] flex h-7 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/90 px-2.5 text-xs text-zinc-400 backdrop-blur animate-fade-in">
            <CloudOff className="h-3.5 w-3.5 text-zinc-500" />
            Basemap unavailable · overlays still live
          </div>
        )}
        <div className="absolute inset-x-0 top-0 z-[450]">
          <ProgressBar active={isOptimizing} />
        </div>
        {isOptimizing && (
          <div className="absolute left-1/2 top-3 z-[450] flex h-7 -translate-x-1/2 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/90 px-2.5 text-xs text-zinc-300 backdrop-blur animate-fade-in">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
            <span className="font-mono">solving qubo…</span>
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
