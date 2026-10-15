import type { Kind } from "@/lib/kinds"

export type Dict = Record<string, unknown>

export type ServerProps = {
  /** The Leaseweb account (API key) the server belongs to. */
  account: number
  kind: Kind
  id: string
  isAdmin: boolean
}

export const TRANSITIONAL = ["CREATING", "STARTING", "STOPPING", "DESTROYING"]

export function get<T = unknown>(obj: unknown, path: string): T | undefined {
  let cur: unknown = obj
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined
    cur = (cur as Dict)[key]
  }
  return cur as T | undefined
}

export function text(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}
