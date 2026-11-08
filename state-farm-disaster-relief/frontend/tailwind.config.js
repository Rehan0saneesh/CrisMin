/** @type {import('tailwindcss').Config} */
// Neutrals use Tailwind's zinc scale directly (bg-zinc-950, border-zinc-800/80…).
// Status colors are semantic tokens backed by CSS variables in globals.css,
// so the four status hues are defined exactly once. src/lib/tokens.ts mirrors
// them as hex for Leaflet, which only accepts raw color strings.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        critical: token("critical"),
        warning: token("warning"),
        success: token("success"),
        accent: token("accent"),
      },
      fontFamily: {
        sans: ["var(--font-sans, ui-sans-serif)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono, ui-monospace)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "16px" }],
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        indeterminate: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(400%)" } },
        "fade-in": { from: { opacity: "0", transform: "translateY(2px)" }, to: { opacity: "1", transform: "none" } },
        "row-flash": { from: { backgroundColor: "rgb(var(--accent) / 0.12)" }, to: { backgroundColor: "transparent" } },
      },
      animation: {
        shimmer: "shimmer 1.4s infinite",
        indeterminate: "indeterminate 1.1s ease-in-out infinite",
        "fade-in": "fade-in 150ms ease-out",
        "row-flash": "row-flash 1.8s ease-out",
      },
    },
  },
  plugins: [],
}
