import { cn } from "@/lib/utils"

/** The mark: a server front of three rack units, the middle one lit. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" className="fill-primary" />
      <rect x="6" y="7" width="20" height="4" className="fill-primary-foreground" opacity="0.55" />
      <rect x="6" y="14" width="20" height="4" className="fill-primary-foreground" />
      <rect x="6" y="21" width="20" height="4" className="fill-primary-foreground" opacity="0.55" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-7" />
      <span className="display text-lg tracking-tight">Leaseweb Dock</span>
    </span>
  )
}
