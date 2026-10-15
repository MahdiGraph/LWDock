import { z } from "zod"
import { PROXY_PROTOCOLS } from "./settings"

export const AccountName = z.string().trim().min(1, "give it a name").max(60)
export const ApiKey = z.string().trim().min(8, "looks too short").max(512)

export const LeasewebInput = z.object({
  baseUrl: z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith("https://"), "must start with https://")
    .transform((u) => u.replace(/\/+$/, "")),
})

export const ProxyInput = z
  .object({
    enabled: z.boolean(),
    protocol: z.enum(PROXY_PROTOCOLS),
    host: z
      .string()
      .trim()
      .max(255)
      .regex(/^[A-Za-z0-9.:\-\[\]]*$/, "letters, numbers, dots, colons and dashes only"),
    port: z.number().int().min(1).max(65535).nullable(),
    username: z.string().max(255).default(""),
    /** undefined: keep, "": remove */
    password: z.string().max(512).optional(),
  })
  .refine((p) => !p.enabled || (p.host && p.port), {
    message: "host and port are required when the proxy is on",
    path: ["host"],
  })
