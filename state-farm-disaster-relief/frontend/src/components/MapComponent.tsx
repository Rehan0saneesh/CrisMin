"use client"

import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, Polyline } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { useEffect, useState } from "react"
import L from "leaflet"

const DEFAULT_CENTER: [number, number] = [30.5, -88.0]
const DEFAULT_ZOOM = 6

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

type MapComponentProps = {
  claims: ClaimPin[]
  units: UnitPin[]
}

export function MapComponent({ claims, units }: MapComponentProps) {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER)

  useEffect(() => {
    delete (L.Icon.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    })

    const allPins = [...claims, ...units]
    if (allPins.length > 0) {
      setCenter([allPins[0].lat, allPins[0].lng])
    }
  }, [claims, units])

  return (
    <div className="w-full h-full rounded border border-slate-800 overflow-hidden">
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
        style={{ height: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CartoDB"
        />

        <Polygon
          positions={[
            [28.0, -90.0],
            [29.0, -88.0],
            [30.5, -86.0],
            [31.0, -84.0],
            [30.0, -82.0],
            [28.5, -83.0],
            [27.5, -85.0],
            [27.0, -87.0],
          ]}
          color="slate-600"
          weight={2}
          fillColor="slate-600"
          fillOpacity={0.1}
        />

        <Circle center={[29.0, -88.5]} radius={120000} color="slate-500" weight={2} fillColor="slate-500" fillOpacity={0.08} />

        <Polyline positions={[[26.0, -92.0], [28.0, -90.0], [30.0, -88.0], [32.0, -86.0], [34.0, -84.0]]} color="slate-500" weight={2} dashArray="5,5" opacity={0.6} />

        {claims.map((claim, i) => {
          const color = claim.severity >= 8 ? "#ef4444" : claim.severity >= 5 ? "#f59e0b" : "#22c55e"
          const divIcon = L.divIcon({
            className: "",
            html: `<div style="width:12px;height:12px;background:${color};border:2px solid #0a0a0a;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          })
          return (
            <Marker key={i} position={[claim.lat, claim.lng]} icon={divIcon}>
              <Popup>
                <div className="p-2 text-xs">
                  <div className="text-slate-200 font-medium">{claim.label}</div>
                  <div className="text-slate-500">Severity {claim.severity}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {units.map((unit, i) => {
          const color = unit.status === "Deployed" ? "#ef4444" : unit.status === "En Route" ? "#f59e0b" : "#22c55e"
          const divIcon = L.divIcon({
            className: "",
            html: `<div style="width:14px;height:14px;background:${color};border:2px solid #0a0a0a;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })
          return (
            <Marker key={i} position={[unit.lat, unit.lng]} icon={divIcon}>
              <Popup>
                <div className="p-2 text-xs">
                  <div className="text-slate-200 font-medium">{unit.label}</div>
                  <div className="text-slate-500">{unit.status}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
