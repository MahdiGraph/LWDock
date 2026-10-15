export function formatBits(bps: number | null | undefined) {
  if (bps === null || bps === undefined || Number.isNaN(bps)) return "—"
  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"]
  let v = bps
  let i = 0
  while (Math.abs(v) >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let v = bytes
  let i = 0
  while (Math.abs(v) >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDateTime(value: string | number | null | undefined) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function formatDate(value: string | number | null | undefined) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

export function timeAgo(value: string | number | null | undefined) {
  if (!value) return "never"
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return "—"
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 45) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} d ago`
  return formatDate(value)
}

/** "REMOTE_MANAGEMENT" → "Remote management" */
export function humanize(value: string | null | undefined) {
  if (!value) return "—"
  const spaced = value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function stripPrefix(ip: string | null | undefined) {
  return ip ? ip.split("/")[0] : ""
}

export function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}
