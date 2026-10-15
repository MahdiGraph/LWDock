import { cn } from "@/lib/utils"

/**
 * The board: a 12-column grid of flat tiles fitted edge to edge with narrow
 * gaps. Tiles are filled, never outlined, and never carry shadows.
 */
export function Board({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid grid-cols-12 gap-2", className)} {...props} />
}

const tones = {
  card: "bg-card text-card-foreground",
  tile: "bg-tile text-foreground",
  primary: "bg-primary text-primary-foreground",
  ink: "bg-foreground text-background",
}

export function Tile({
  className,
  tone = "card",
  ...props
}: React.ComponentProps<"section"> & { tone?: keyof typeof tones }) {
  return <section className={cn("relative min-w-0 overflow-hidden p-5", tones[tone], className)} {...props} />
}

export function TileLabel({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-[13px] leading-snug opacity-70", className)} {...props} />
}

export function TileValue({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("display mt-2 text-2xl leading-tight break-words md:text-[1.75rem]", className)} {...props} />
}

/** A definition list for details inside a tile. */
export function Facts({ items, className }: { items: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[13px] text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm break-words">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="display text-4xl md:text-5xl">{title}</h1>
        {description ? <p className="prose-serif mt-3 max-w-2xl text-base text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
