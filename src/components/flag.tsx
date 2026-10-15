import { countryName, flagEmoji } from "@/lib/geo"
import { cn } from "@/lib/utils"

/**
 * A country flag emoji. It is drawn with the bundled Twemoji flag font, so it
 * shows as a flag on Windows too, where the system font has none.
 */
export function Flag({ country, className }: { country: string | null | undefined; className?: string }) {
  if (!country) return null
  const name = countryName(country)
  return (
    <span role="img" aria-label={name} title={name} className={cn("font-flags inline-block leading-none", className)}>
      {flagEmoji(country)}
    </span>
  )
}
