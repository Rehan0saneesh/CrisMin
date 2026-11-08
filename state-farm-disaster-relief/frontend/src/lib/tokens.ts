/**
 * Hex values for Leaflet, which takes raw color strings. Status hues match
 * the CSS variables in globals.css; neutrals match Tailwind's zinc scale.
 */
export const color = {
  zinc950: "#09090b",
  zinc900: "#18181b",
  zinc800: "#27272a",
  zinc600: "#52525b",
  zinc500: "#71717a",
  zinc400: "#a1a1aa",
  zinc100: "#f4f4f5",
  critical: "#ef4444",
  warning: "#f59e0b",
  success: "#10b981",
  accent: "#3b82f6",
} as const

export type UnitStatus = "Deployed" | "En Route" | "Idle"
export type Tone = "critical" | "warning" | "success" | "accent" | "neutral"

/** Bands match the backend normalizer weights (2 / 6 / 10). */
export function severityTone(severity: number | null): Tone {
  if (severity === null) return "neutral"
  if (severity >= 8) return "critical"
  if (severity >= 5) return "warning"
  return "success"
}

export function toneHex(tone: Tone): string {
  return tone === "neutral" ? color.zinc600 : color[tone]
}

/** One mapping for unit status: map pins, badges, and legend all use it. */
export function unitTone(status: UnitStatus): Tone {
  if (status === "Deployed") return "accent"
  if (status === "En Route") return "warning"
  return "success"
}
