"use client"

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react"
import { Loader2, type LucideIcon } from "lucide-react"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Tone } from "@/lib/tokens"

export function cn(...args: Parameters<typeof clsx>) {
  return twMerge(clsx(...args))
}

/* ---------------------------------------------------------------- Button */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "icon" | "icon-sm"
  loading?: boolean
  icon?: LucideIcon
}

const BUTTON_VARIANT = {
  primary: "bg-zinc-100 text-zinc-900 hover:bg-white border border-transparent",
  secondary: "bg-zinc-900 text-zinc-200 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700",
  ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-transparent",
}
const BUTTON_SIZE = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-8 px-3 text-[13px] gap-2",
  icon: "h-8 w-8",
  "icon-sm": "h-7 w-7",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon: Icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center shrink-0 whitespace-nowrap rounded-md font-medium",
        "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      ) : null}
      {children}
    </button>
  )
})

/* ----------------------------------------------------------------- Badge */

const BADGE_TONE: Record<Tone, string> = {
  critical: "border-critical/20 bg-critical/10 text-red-400",
  warning: "border-warning/20 bg-warning/10 text-amber-400",
  success: "border-success/20 bg-success/10 text-emerald-400",
  accent: "border-accent/20 bg-accent/10 text-blue-400",
  neutral: "border-zinc-800 bg-zinc-900 text-zinc-400",
}
const DOT_TONE: Record<Tone, string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  success: "bg-success",
  accent: "bg-accent",
  neutral: "bg-zinc-500",
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONE[tone], className)} />
}

export function Badge({
  tone = "neutral",
  dot = true,
  mono,
  children,
  className,
}: {
  tone?: Tone
  dot?: boolean
  mono?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 text-2xs font-medium",
        mono && "font-mono",
        BADGE_TONE[tone],
        className,
      )}
    >
      {dot && <Dot tone={tone} />}
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ Tabs */

export type TabItem<T extends string> = { id: T; label: string; count?: number; icon?: LucideIcon }

/** Underline tabs with an active indicator, used in pane headers. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn("flex h-full items-stretch gap-1", className)}>
      {items.map(({ id, label, count, icon: Icon }) => {
        const active = id === value
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "relative flex items-center gap-1.5 px-2 text-[13px] transition-colors duration-150",
              active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
            {count !== undefined && (
              <span
                className={cn(
                  "num rounded px-1 text-[10px] leading-4",
                  active ? "bg-zinc-800 text-zinc-300" : "bg-zinc-900 text-zinc-500",
                )}
              >
                {count}
              </span>
            )}
            <span
              className={cn(
                "absolute inset-x-1 -bottom-px h-px transition-colors duration-150",
                active ? "bg-zinc-100" : "bg-transparent",
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

/** Compact segmented filter, used inside panes. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="inline-flex h-7 items-center rounded-md border border-zinc-800/80 bg-zinc-950 p-0.5">
      {items.map((it) => {
        const active = it.id === value
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={cn(
              "flex h-full items-center gap-1.5 rounded px-2 text-xs transition-colors duration-150",
              active ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {it.label}
            {it.count !== undefined && <span className="num text-[10px] text-zinc-500">{it.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ Pane */

export function Pane({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900/50", className)}>
      {children}
    </section>
  )
}

export function PaneHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex h-10 shrink-0 items-center justify-between gap-3 border-b border-zinc-800/80 px-3", className)}>
      {children}
    </div>
  )
}

export function PaneTitle({ icon: Icon, children, meta }: { icon?: LucideIcon; children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
      <h2 className="truncate text-[13px] font-medium text-zinc-200">{children}</h2>
      {meta && <span className="num hidden truncate text-zinc-500 sm:inline">{meta}</span>}
    </div>
  )
}

/* ---------------------------------------------------- Empty / Loading */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center animate-fade-in", className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
        <Icon className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="space-y-1">
        <p className="text-[13px] font-medium text-zinc-300">{title}</p>
        {description && <p className="mx-auto max-w-[260px] text-xs text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded bg-zinc-800/60", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-zinc-700/30 to-transparent" />
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-zinc-700/80 bg-zinc-800/60 px-1 font-mono text-[10px] text-zinc-400">
      {children}
    </kbd>
  )
}

/** Thin indeterminate bar for in-flight requests. */
export function ProgressBar({ active }: { active: boolean }) {
  return (
    <div className={cn("h-px w-full overflow-hidden transition-opacity duration-150", active ? "opacity-100" : "opacity-0")}>
      <div className="h-full w-1/4 animate-indeterminate bg-zinc-300" />
    </div>
  )
}
