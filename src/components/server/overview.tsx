"use client"

import * as React from "react"
import { Board, Facts, Tile } from "@/components/board"
import { ConfirmAction, useAction } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { lwCall } from "@/lib/client"
import { formatDate, formatDateTime, humanize } from "@/lib/format"
import { get, text, type Dict, type ServerProps } from "./types"

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="display mb-5 text-2xl">{children}</h2>
}

export function DedicatedOverview({ kind, id, isAdmin, raw, onStarted }: ServerProps & { raw: Dict; onStarted: () => void }) {
  const { run } = useAction()
  const [cycle, setCycle] = React.useState(true)
  const disks = (get<Dict[]>(raw, "specs.hdd") ?? [])
    .map((d) => `${d.amount ?? 1} × ${d.size ?? "?"} ${d.unit ?? "GB"} ${d.type ?? ""}${d.performanceType ? ` (${d.performanceType})` : ""}`.trim())
    .join(", ")
  const pci = (get<Dict[]>(raw, "specs.pciCards") ?? []).map((c) => c.description).filter(Boolean).join(", ")
  const ports = (path: string) =>
    (get<Dict[]>(raw, path) ?? []).map((p) => [p.name, p.port].filter(Boolean).join(" ")).join(", ") || null
  const traffic = get<Dict>(raw, "contract.networkTraffic")
  const features = get<Dict>(raw, "featureAvailability") ?? {}
  const privateNets = get<Dict[]>(raw, "privateNetworks") ?? []

  return (
    <Board>
      <Tile className="col-span-12 lg:col-span-7">
        <SectionTitle>Hardware</SectionTitle>
        <Facts
          items={[
            ["Processor", text(get(raw, "specs.cpu.type")) && `${get(raw, "specs.cpu.quantity") ?? 1} × ${get(raw, "specs.cpu.type")}`],
            ["Memory", get(raw, "specs.ram.size") ? `${get(raw, "specs.ram.size")} ${get(raw, "specs.ram.unit") ?? "GB"}` : null],
            ["Disks", disks || null],
            ["Chassis", text(get(raw, "specs.chassis"))],
            ["Brand", text(get(raw, "specs.brand"))],
            ["Hardware RAID", text(get(raw, "specs.hardwareRaidCapable"))],
            ["PCI cards", pci || null],
            ["Serial number", text(raw.serialNumber)],
            ["Asset ID", text(raw.assetId)],
          ]}
        />
      </Tile>
      <Tile tone="tile" className="col-span-12 lg:col-span-5">
        <SectionTitle>Location</SectionTitle>
        <Facts
          items={[
            ["Data center", text(get(raw, "location.site"))],
            ["Suite", text(get(raw, "location.suite"))],
            ["Rack", text(get(raw, "location.rack"))],
            ["Unit", text(get(raw, "location.unit"))],
            ["Rack type", text(humanize(get<string>(raw, "rack.type") ?? null))],
            ["Rack capacity", text(get(raw, "rack.capacity"))],
          ]}
        />
      </Tile>
      <Tile tone="tile" className="col-span-12 lg:col-span-5">
        <SectionTitle>Network</SectionTitle>
        <Facts
          items={[
            ["Public IP", text(get(raw, "networkInterfaces.public.ip"))],
            ["Public MAC", text(get(raw, "networkInterfaces.public.mac"))],
            ["Gateway", text(get(raw, "networkInterfaces.public.gateway"))],
            ["Public ports", ports("networkInterfaces.public.ports")],
            ["Internal IP", text(get(raw, "networkInterfaces.internal.ip"))],
            ["Internal MAC", text(get(raw, "networkInterfaces.internal.mac"))],
            ["Remote management IP", text(get(raw, "networkInterfaces.remoteManagement.ip"))],
            ["Private networks", privateNets.length ? privateNets.map((n) => `${n.id} (${n.status ?? "?"})`).join(", ") : null],
          ]}
        />
      </Tile>
      <Tile className="col-span-12 lg:col-span-7">
        <SectionTitle>Contract</SectionTitle>
        <Facts
          items={[
            ["Status", text(humanize(get<string>(raw, "contract.deliveryStatus") ?? null))],
            ["Started", formatDate(get<string>(raw, "contract.startsAt"))],
            ["Ends", get(raw, "contract.endsAt") ? formatDate(get<string>(raw, "contract.endsAt")) : "Runs until cancelled"],
            ["Term", get(raw, "contract.contractTerm") ? `${get(raw, "contract.contractTerm")} months` : null],
            ["SLA", text(get(raw, "contract.sla"))],
            [
              "Data traffic",
              traffic
                ? [traffic.datatrafficLimit ? `${traffic.datatrafficLimit} ${traffic.datatrafficUnit ?? ""}` : null, humanize(String(traffic.type ?? "")), traffic.connectivityType]
                    .filter((v) => v && v !== "—")
                    .join(" · ") || null
                : null,
            ],
            ["IPv4 addresses", text(get(raw, "contract.ipv4Quantity"))],
            ...(isAdmin
              ? ([
                  ["Price", get(raw, "contract.pricePerFrequency") ? `${get(raw, "contract.pricePerFrequency")} ${get(raw, "contract.currency") ?? ""} every ${get(raw, "contract.billingFrequency") ?? "?"} month(s)` : null],
                ] as [string, React.ReactNode][])
              : []),
          ]}
        />
      </Tile>
      <Tile className="col-span-12">
        <SectionTitle>Maintenance</SectionTitle>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="prose-serif max-w-lg text-base text-muted-foreground">
              Reset the IPMI controller when the power status is stuck or remote management stops answering.
            </p>
            <ConfirmAction
              title="Reset the IPMI controller?"
              description="Leaseweb runs a job that resets the management controller. It takes a few minutes."
              confirmLabel="Reset IPMI"
              extra={
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={cycle} onCheckedChange={(v) => setCycle(!!v)} /> Power cycle the server as part of the job
                </label>
              }
              onConfirm={() =>
                run("ipmi", async () => {
                  await lwCall(kind, id, "POST", "ipmiReset", { powerCycle: cycle })
                  onStarted()
                }, "IPMI reset started")
              }
            >
              <Button variant="secondary" className="mt-4" disabled={features.ipmiReboot === false}>
                Reset IPMI
              </Button>
            </ConfirmAction>
          </div>
          <Facts
            items={[
              ["Automation", text(features.automation)],
              ["Power cycle", text(features.powerCycle)],
              ["IPMI reboot", text(features.ipmiReboot)],
              ["Remote management", text(features.remoteManagement)],
              ["Private network", text(features.privateNetwork)],
            ]}
          />
        </div>
      </Tile>
    </Board>
  )
}

export function CloudOverview({ kind, isAdmin, raw }: ServerProps & { raw: Dict }) {
  const speed = (path: string) => {
    const v = get<Dict>(raw, path)
    return v?.value ? `${v.value} ${v.unit ?? ""}`.trim() : null
  }
  const contract = get<Dict>(raw, "contract") ?? {}
  return (
    <Board>
      <Tile className="col-span-12 lg:col-span-7">
        <SectionTitle>Plan</SectionTitle>
        <Facts
          items={[
            [kind === "vps" ? "Package" : "Instance type", text(raw.type ?? raw.pack)],
            ["vCPU", text(get(raw, "resources.cpu.value"))],
            ["Memory", get(raw, "resources.memory.value") ? `${get(raw, "resources.memory.value")} ${get(raw, "resources.memory.unit") ?? "GiB"}` : null],
            ["Root disk", raw.rootDiskSize ? `${raw.rootDiskSize} GB ${raw.rootDiskStorageType ?? ""}`.trim() : null],
            ["Public network", speed("resources.publicNetworkSpeed")],
            ["Private network", speed("resources.privateNetworkSpeed")],
            ["Image", text(get(raw, "image.name"))],
            ["Market app", text(raw.marketAppId)],
            ["Public IPv4", text(raw.hasPublicIpV4)],
            ["ISO attached", text(get(raw, "iso.name")) ?? "None"],
          ]}
        />
      </Tile>
      <Tile tone="tile" className="col-span-12 lg:col-span-5">
        <SectionTitle>Where and since when</SectionTitle>
        <Facts
          items={[
            ["Region", text(raw.region)],
            ["Data center", text(raw.datacenter)],
            ["Running since", raw.startedAt ? formatDateTime(String(raw.startedAt)) : null],
            ["Contract", text(humanize(String(contract.type ?? "")))],
            ["Term", contract.term !== undefined ? `${contract.term} month(s)` : null],
            ["Contract state", text(humanize(String(contract.state ?? "")))],
            ["Ends", contract.endsAt ? formatDate(String(contract.endsAt)) : null],
            ...(isAdmin ? ([["Billing every", contract.billingFrequency ? `${contract.billingFrequency} month(s)` : null]] as [string, React.ReactNode][]) : []),
          ]}
        />
      </Tile>
    </Board>
  )
}
