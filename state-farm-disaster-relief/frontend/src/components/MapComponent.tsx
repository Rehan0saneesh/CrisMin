"use client"

import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, Polyline } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { useEffect, useState } from "react"
import L from "leaflet"

const DEFAULT_CENTER: [number, number] = [30.0, -88.5]
const DEFAULT_ZOOM = 7

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

function setupLeafletIcons() {
  delete (L.Icon.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  })
}

export function MapComponent({ claims, units }: MapComponentProps) {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER)

  useEffect(() => {
    setupLeafletIcons()

    const allPins = [...claims, ...units]
    if (allPins.length > 0) {
      setCenter([allPins[0].lat, allPins[0].lng])
    }
  }, [claims, units])

  return (
    <div className="flex-1 min-h-0 bg-[#0F1117] relative overflow-hidden">
      <div className="absolute top-3 left-3 z-10 bg-[#1E222B]/90 backdrop-blur px-3 py-1 rounded-none border border-[#2D323E] text-[10px] font-bold text-[#F8FAFC] uppercase tracking-wider">
        Imagery & Sensor Overlay
      </div>

      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
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
          color="#EF4444"
          weight={2}
          fillColor="#EF4444"
          fillOpacity={0.15}
        >
          <Popup>
            <div className="p-2 text-xs">
              <div className="text-[#EF4444] font-bold">CRITICAL DISASTER SECTOR</div>
              <div className="text-[#94A3B8]">Hurricane tracking cone Gulf Coast</div>
            </div>
          </Popup>
        </Polygon>

        <Polygon
          positions={[
            [26.0, -84.0],
            [27.0, -82.0],
            [28.0, -81.0],
            [27.0, -80.0],
            [26.0, -81.0],
          ]}
          color="#10B981"
          weight={2}
          fillColor="#10B981"
          fillOpacity={0.1}
        >
          <Popup>
            <div className="p-2 text-xs">
              <div className="text-[#10B981] font-bold">CLEARED ZONE</div>
              <div className="text-[#94A3B8]">No active claims resources released</div>
            </div>
          </Popup>
        </Polygon>

        <Circle
          center={[29.0, -88.5]}
          radius={120000}
          color="#F59E0B"
          weight={2}
          fillColor="#F59E0B"
          fillOpacity={0.08}
        >
          <Popup>Severe Storm Impact Zone</Popup>
        </Circle>

        <Polyline
          positions={[
            [26.0, -92.0],
            [28.0, -90.0],
            [30.0, -88.0],
            [32.0, -86.0],
            [34.0, -84.0],
          ]}
          color="#94A3B8"
          weight={2}
          dashArray="5,5"
          opacity={0.6}
        >
          <Popup>Weather Front</Popup>
        </Polyline>

        {claims.map((claim, i) => {
          const color =
            claim.severity >= 8 ? "#EF4444" : claim.severity >= 5 ? "#F59E0B" : "#10B981"
          const divIcon = L.divIcon({
            className: "",
            html: `<div style="width:10px;height:10px;background:${color};border:2px solid #0F1117;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5],
          })
          return (
            <Marker key={i} position={[claim.lat, claim.lng]} icon={divIcon}>
              <Popup>
                <div className="p-2 text-xs">
                  <div className="text-[#F8FAFC] font-bold">{claim.label}</div>
                  <div className="text-[#94A3B8]">Severity {claim.severity}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {units.map((unit, i) => {
          const color =
            unit.status === "Deployed"
              ? "#3B82F6"
              : unit.status === "En Route"
              ? "#F59E0B"
              : "#10B981"
          const divIcon = L.divIcon({
            className: "",
            html: `<div style="width:12px;height:12px;background:${color};border:2px solid #0F1117;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          })
          return (
            <Marker key={i} position={[unit.lat, unit.lng]} icon={divIcon}>
              <Popup>
                <div className="p-2 text-xs">
                  <div className="text-[#F8FAFC] font-bold">{unit.label}</div>
                  <div className="text-[#94A3B8]">{unit.status}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      <div className="absolute bottom-3 left-3 z-10 bg-[#1E222B]/90 backdrop-blur px-3 py-1.5 border border-[#2D323E] flex items-center gap-3 text-[10px] text-[#94A3B8]">
        <span id="map-coords">30.0000, -88.5000</span>
        <span className="w-px h-3 bg-[#2D323E] mx-1" />
        <span>Zoom 7</span>
      </div>
    </div>
  )
}
