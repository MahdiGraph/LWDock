"use client"

import * as React from "react"
import { Board, Facts, Tile } from "@/components/board"
import { ConfirmAction, ErrorNote, Loading } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useLw } from "@/hooks/use-api"
import { lwCall } from "@/lib/client"
import { formatBytes, formatDateTime } from "@/lib/format"
import { toast } from "sonner"
import type { Dict, ServerProps } from "./types"

type Hardware = { scannedAt?: string; parserVersion?: string; result?: Dict }

const s = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v))

function bytes(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? formatBytes(n) : s(v)
}

function hz(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? `${(n / 1e9).toFixed(2)} GHz` : s(v)
}

export function Hardware({ kind, id, onStarted }: ServerProps & { onStarted: () => void }) {
  const hw = useLw<Hardware>(kind, id, "hardwareInfo")
  const [cycle, setCycle] = React.useState(true)
  const r = hw.data?.result ?? {}
  const chassis = (r.chassis ?? {}) as Dict
  const cpus = (r.cpu ?? []) as Dict[]
  const memory = (r.memory ?? []) as Dict[]
  const disks = (r.disks ?? []) as Dict[]
  const nics = (r.network ?? []) as Dict[]
  const ipmi = (r.ipmi ?? {}) as Dict

  const scan = (
    <ConfirmAction
      title="Run a hardware scan?"
      description="Leaseweb boots the server into a scan image, reads the hardware and boots it back. The server is offline meanwhile."
      confirmLabel="Run scan"
      extra={
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={cycle} onCheckedChange={(v) => setCycle(!!v)} /> Reboot the server automatically
        </label>
      }
      onConfirm={async () => {
        await lwCall(kind, id, "POST", "hardwareScan", { powerCycle: cycle })
        toast.success("Hardware scan started")
        onStarted()
      }}
    >
      <Button variant="secondary">Run hardware scan</Button>
    </ConfirmAction>
  )

  if (hw.isLoading && !hw.data) return <Loading />
  if (hw.error && !hw.data) {
    return (
      <Tile className="lg:p-8">
        <h2 className="display text-3xl">Hardware</h2>
        <p className="prose-serif mt-2 text-base text-muted-foreground">
          No hardware report yet ({hw.error.message}). A scan creates one.
        </p>
        <div className="mt-6">{scan}</div>
      </Tile>
    )
  }

  return (
    <Board>
      <Tile className="col-span-12 lg:col-span-8 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="display text-3xl">Hardware</h2>
            <p className="mt-2 text-sm text-muted-foreground">Last scanned {formatDateTime(hw.data?.scannedAt)}</p>
          </div>
          {scan}
        </div>
        <Facts
          items={[
            ["Chassis", [s(chassis.vendor), s(chassis.product)].filter(Boolean).join(" ") || null],
            ["Chassis serial", s(chassis.serial)],
            ["Motherboard", [s((chassis.motherboard as Dict)?.vendor), s((chassis.motherboard as Dict)?.product)].filter(Boolean).join(" ") || null],
            ["Firmware", [s((chassis.firmware as Dict)?.description), s((chassis.firmware as Dict)?.version), s((chassis.firmware as Dict)?.date)].filter(Boolean).join(" · ") || null],
            ["IPMI", [s(ipmi.vendor), s(ipmi.firmware), s(ipmi.ipaddress)].filter(Boolean).join(" · ") || null],
            ["Memory total", memory.length ? formatBytes(memory.reduce((a, m) => a + (Number(m.size_bytes) || 0), 0)) : null],
          ]}
        />
      </Tile>
      <Tile tone="tile" className="col-span-12 lg:col-span-4">
        <h3 className="display text-xl">Processors</h3>
        <ul className="mt-4 grid gap-3 text-sm">
          {cpus.length ? (
            cpus.map((c, i) => (
              <li key={i}>
                <p>{s(c.description) ?? s(c.vendor) ?? "CPU"}</p>
                <p className="text-[13px] text-muted-foreground">
                  {[s(c.slot), hz(c.hz), (c.settings as Dict)?.cores ? `${(c.settings as Dict).cores} cores` : null, (c.settings as Dict)?.threads ? `${(c.settings as Dict).threads} threads` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">Not reported</li>
          )}
        </ul>
      </Tile>
      <Tile className="col-span-12 lg:col-span-6">
        <h3 className="display text-xl">Disks</h3>
        <ul className="mt-4 grid gap-1 text-sm">
          {disks.length ? (
            disks.map((d, i) => (
              <li key={i} className="bg-muted px-3 py-2">
                <p>{[s(d.vendor), s(d.product)].filter(Boolean).join(" ") || s(d.description) || `Disk ${i + 1}`}</p>
                <p className="text-[13px] text-muted-foreground">
                  {[bytes(d.size), s(d.id), s(d.serial_number) ? `serial ${d.serial_number}` : null].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">Not reported</li>
          )}
        </ul>
      </Tile>
      <Tile tone="tile" className="col-span-12 lg:col-span-6">
        <h3 className="display text-xl">Memory and network</h3>
        <ul className="mt-4 grid gap-1 text-sm">
          {memory.map((m, i) => (
            <li key={`m${i}`} className="bg-background/60 px-3 py-2">
              {[s(m.id), bytes(m.size_bytes), m.clock_hz ? `${Math.round(Number(m.clock_hz) / 1e6)} MHz` : null].filter(Boolean).join(" · ")}
            </li>
          ))}
          {nics.map((n, i) => (
            <li key={`n${i}`} className="bg-background/60 px-3 py-2">
              {[s(n.logical_name), s(n.product), s(n.mac_address)].filter(Boolean).join(" · ")}
            </li>
          ))}
          {!memory.length && !nics.length ? <li className="text-muted-foreground">Not reported</li> : null}
        </ul>
      </Tile>
      <Tile className="col-span-12">
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Full report as JSON</summary>
          <pre className="mt-4 max-h-[32rem] overflow-auto bg-muted p-4 text-[13px] leading-relaxed">
            <code>{JSON.stringify(hw.data, null, 2)}</code>
          </pre>
        </details>
      </Tile>
      <ErrorNote error={hw.error} className="col-span-12" />
    </Board>
  )
}
