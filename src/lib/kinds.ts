/** Shared between server and client: no Node imports here. */

import { countryFor } from "./geo"

export const KINDS = ["dedicated", "instance", "vps"] as const
export type Kind = (typeof KINDS)[number]

export const KIND_META: Record<Kind, { label: string; plural: string; short: string; base: string; listKey: string }> = {
  dedicated: {
    label: "Dedicated server",
    plural: "Dedicated servers",
    short: "Dedicated",
    base: "/bareMetals/v2/servers",
    listKey: "servers",
  },
  instance: {
    label: "Public Cloud instance",
    plural: "Public Cloud instances",
    short: "Public Cloud",
    base: "/publicCloud/v1/instances",
    listKey: "instances",
  },
  vps: {
    label: "VPS",
    plural: "VPS",
    short: "VPS",
    base: "/publicCloud/v1/vps",
    listKey: "vps",
  },
}

export function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value)
}

export type ServerSummary = {
  kind: Kind
  id: string
  /** The Leaseweb account (API key) the server belongs to. */
  accountId: number
  accountName: string
  name: string
  reference: string | null
  ip: string | null
  location: string | null
  /** ISO country code of the data center, for the flag. */
  country: string | null
  spec: string | null
  state: string | null
  os: string | null
}

type Dict = Record<string, unknown>
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)

function mainIp(ips: unknown): string | null {
  if (!Array.isArray(ips)) return null
  const list = ips as Dict[]
  const pick =
    list.find((i) => i.mainIp && i.networkType === "PUBLIC") ?? list.find((i) => i.networkType === "PUBLIC") ?? list[0]
  return pick ? str(pick.ip) : null
}

export function summarize(kind: Kind, raw: Dict, account: { id: number; name: string }): ServerSummary {
  const id = String(raw.id ?? "")
  const owner = { accountId: account.id, accountName: account.name }
  if (kind === "dedicated") {
    const contract = (raw.contract ?? {}) as Dict
    const loc = (raw.location ?? {}) as Dict
    const specs = (raw.specs ?? {}) as Dict
    const cpu = (specs.cpu ?? {}) as Dict
    const ram = (specs.ram ?? {}) as Dict
    const nics = (raw.networkInterfaces ?? {}) as Dict
    const pub = (nics.public ?? {}) as Dict
    const reference = str(contract.reference)
    const cpuText = str(cpu.type) ? `${cpu.quantity && Number(cpu.quantity) > 1 ? `${cpu.quantity}× ` : ""}${cpu.type}` : null
    const ramText = ram.size ? `${ram.size} ${ram.unit ?? "GB"} RAM` : null
    return {
      kind,
      id,
      ...owner,
      name: reference ?? id,
      reference,
      ip: str(pub.ip)?.split("/")[0] ?? null,
      location: [str(loc.site), str(loc.suite)].filter(Boolean).join(" · ") || null,
      country: countryFor({ site: str(loc.site) }),
      spec: [cpuText, ramText].filter(Boolean).join(", ") || null,
      state: str(contract.deliveryStatus),
      os: null,
    }
  }
  const image = (raw.image ?? {}) as Dict
  const resources = (raw.resources ?? {}) as Dict
  const cpu = (resources.cpu ?? {}) as Dict
  const mem = (resources.memory ?? {}) as Dict
  const reference = str(raw.reference)
  const specParts = [
    str(raw.type) ?? str(raw.pack),
    cpu.value ? `${cpu.value} vCPU` : null,
    mem.value ? `${mem.value} ${mem.unit ?? "GiB"}` : null,
  ].filter(Boolean)
  return {
    kind,
    id,
    ...owner,
    name: reference ?? id,
    reference,
    ip: mainIp(raw.ips),
    location: [str(raw.region), str(raw.datacenter)].filter(Boolean).join(" · ") || null,
    country: countryFor({ datacenter: str(raw.datacenter), region: str(raw.region) }),
    spec: specParts.join(", ") || null,
    state: str(raw.state),
    os: str(image.name),
  }
}
