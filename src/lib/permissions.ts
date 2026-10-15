import type { Kind } from "./kinds"

/**
 * The allow-list of Leaseweb endpoints that can be reached through the panel.
 * Paths are relative to the server, e.g. "ips/1.2.3.4/null" for
 * /bareMetals/v2/servers/{id}/ips/1.2.3.4/null. Anything not listed is refused.
 */

type Method = "GET" | "POST" | "PUT" | "DELETE"
type Rule = { methods: Method[]; pattern: RegExp; adminOnly?: boolean }

const S = "[^/]+"
const r = (methods: Method[], source: string, adminOnly = false): Rule => ({
  methods,
  pattern: new RegExp(`^${source.replaceAll("{s}", S)}$`),
  adminOnly,
})

const DEDICATED: Rule[] = [
  r(["GET"], ""),
  r(["GET"], "(powerInfo|hardwareInfo|hardwareMonitoring|nullRouteHistory|networkInterfaces|ips|jobs|credentials|leases)"),
  r(["POST"], "(powerCycle|powerOn|powerOff|ipmiReset|hardwareScan|cancelActiveJob|expireActiveJob|install|rescueMode)"),
  r(["GET", "PUT"], "ips/{s}"),
  r(["POST"], "ips/{s}/(null|unnull)"),
  r(["GET"], "networkInterfaces/(public|internal|remoteManagement)"),
  r(["POST"], "networkInterfaces(/(public|internal|remoteManagement))?/(open|close)"),
  r(["GET"], "metrics/(bandwidth|datatraffic)"),
  r(["GET", "POST"], "notificationSettings/(bandwidth|datatraffic)"),
  r(["GET", "PUT", "DELETE"], "notificationSettings/(bandwidth|datatraffic)/{s}"),
  r(["GET", "PUT"], "notificationSettings/ddos"),
  r(["GET"], "jobs/{s}"),
  r(["POST"], "jobs/{s}/retry"),
  r(["POST"], "credentials"),
  r(["GET"], "credentials/{s}"),
  r(["GET", "PUT", "DELETE"], "credentials/{s}/{s}"),
  r(["POST", "DELETE"], "leases"),
]

const CLOUD: Rule[] = [
  r(["GET"], ""),
  r(["POST"], "(start|stop|reboot|resetPassword|attachIso|detachIso)"),
  r(["GET"], "(console|credentials|ips|snapshots|reinstall/images|notificationSettings/dataTraffic)"),
  r(["PUT"], "reinstall"),
  r(["POST", "DELETE"], "credentials"),
  r(["GET"], "credentials/{s}"),
  r(["GET", "PUT", "DELETE"], "credentials/{s}/{s}"),
  r(["GET", "PUT"], "ips/{s}"),
  r(["POST"], "ips/{s}/(null|unnull)"),
  r(["GET"], "metrics/(cpu|datatraffic)"),
  r(["POST"], "snapshots"),
  r(["GET", "PUT", "DELETE"], "snapshots/{s}"),
  r(["POST"], "notificationSettings/dataTraffic"),
  r(["GET", "POST", "PUT", "DELETE"], "notificationSettings/dataTraffic/{s}"),
]

const RULES: Record<Kind, Rule[]> = { dedicated: DEDICATED, instance: CLOUD, vps: CLOUD }

/** Global, read-only lists any signed-in user may load (operating systems, images, ISOs). */
const CATALOG = [
  /^bareMetals\/v2\/(operatingSystems|controlPanels|rescueImages)$/,
  /^bareMetals\/v2\/operatingSystems\/[^/]+$/,
  /^bareMetals\/v2\/operatingSystems\/[^/]+\/controlPanels$/,
  /^publicCloud\/v1\/(isos|vps\/isos|regions)$/,
]

const SEGMENT = /^[A-Za-z0-9._:@+-]+$/

/** Validates every segment, so nothing like "..", "?" or "#" can reach the upstream URL. */
export function safeSegments(segments: string[]): string[] | null {
  for (const s of segments) if (!s || s === "." || s === ".." || !SEGMENT.test(s)) return null
  return segments
}

export function allowedServerCall(kind: Kind, method: string, sub: string, isAdmin: boolean): "ok" | "forbidden" | "unknown" {
  const rule = RULES[kind].find((x) => x.methods.includes(method as Method) && x.pattern.test(sub))
  if (!rule) return "unknown"
  if (rule.adminOnly && !isAdmin) return "forbidden"
  return "ok"
}

export function allowedCatalogPath(path: string) {
  return CATALOG.some((re) => re.test(path))
}

const ACTION_NAMES: Record<string, string> = {
  powerCycle: "Power cycle (reboot)",
  powerOn: "Power on",
  powerOff: "Power off",
  ipmiReset: "IPMI reset",
  hardwareScan: "Hardware scan",
  cancelActiveJob: "Cancel active job",
  expireActiveJob: "Expire active job",
  install: "Install operating system",
  rescueMode: "Launch rescue mode",
  start: "Start",
  stop: "Stop",
  reboot: "Reboot",
  resetPassword: "Reset password",
  attachIso: "Attach ISO",
  detachIso: "Detach ISO",
  reinstall: "Reinstall",
  console: "Open console",
}

/** A human description for the activity log, or null when the call is not worth logging. */
export function describeCall(method: string, sub: string): string | null {
  const parts = sub.split("/")
  if (method === "GET") {
    if (parts[0] === "credentials" && parts.length === 3) return `Reveal ${parts[1]} password for ${parts[2]}`
    if (sub === "console") return ACTION_NAMES.console
    return null
  }
  if (sub === "") return method === "PUT" ? "Update server details" : `${method} server`
  if (ACTION_NAMES[sub]) return ACTION_NAMES[sub]
  if (parts[0] === "ips") {
    const ip = parts[1] ?? ""
    if (parts[2] === "null") return `Null route ${ip}`
    if (parts[2] === "unnull") return `Remove null route ${ip}`
    return `Update IP ${ip}`
  }
  if (parts[0] === "networkInterfaces") {
    const action = parts[parts.length - 1]
    const which = parts.length === 3 ? `${parts[1]} interface` : "all interfaces"
    return `${action === "open" ? "Open" : "Close"} ${which}`
  }
  if (parts[0] === "credentials") {
    if (method === "POST") return "Add credential"
    if (method === "PUT") return `Update ${parts[1]} credential ${parts[2] ?? ""}`
    if (method === "DELETE") return parts.length === 1 ? "Delete all credentials" : `Delete ${parts[1]} credential ${parts[2] ?? ""}`
  }
  if (parts[0] === "snapshots") {
    if (method === "POST") return "Create snapshot"
    if (method === "PUT") return "Restore snapshot"
    if (method === "DELETE") return "Delete snapshot"
  }
  if (parts[0] === "jobs" && parts[2] === "retry") return "Retry job"
  if (parts[0] === "notificationSettings") return `${method === "DELETE" ? "Delete" : "Save"} ${parts[1]} notification`
  if (parts[0] === "leases") return method === "POST" ? "Create DHCP reservation" : "Delete DHCP reservation"
  return `${method} ${sub}`
}

const SAFE_DETAIL_KEYS = [
  "operatingSystemId",
  "controlPanelId",
  "hostname",
  "rescueImageId",
  "imageId",
  "reverseLookup",
  "detectionProfile",
  "isoId",
  "name",
  "type",
  "username",
  "comment",
  "powerCycle",
  "reference",
]

/** Keeps only harmless fields of a request body for the log: never passwords, keys or scripts. */
export function safeDetail(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const picked: Record<string, unknown> = {}
  for (const k of SAFE_DETAIL_KEYS) {
    const v = (body as Record<string, unknown>)[k]
    if (v !== undefined && v !== null && v !== "") picked[k] = v
  }
  return Object.keys(picked).length ? JSON.stringify(picked) : null
}

const HIDDEN_KEYS = new Set(["pricePerFrequency", "currency", "prices", "price", "customerId", "salesOrgId"])

/** Removes billing details from responses shown to non-admin users. */
export function stripBilling(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map((v) => stripBilling(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) if (!HIDDEN_KEYS.has(k)) out[k] = stripBilling(v, depth + 1)
  return out
}
