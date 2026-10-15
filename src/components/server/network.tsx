"use client"

import * as React from "react"
import { PencilSimpleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Tile } from "@/components/board"
import { ConfirmAction, CopyButton, ErrorNote, Loading, StateMark, useAction } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLw } from "@/hooks/use-api"
import { lwCall } from "@/lib/client"
import { formatDateTime, humanize, stripPrefix } from "@/lib/format"
import type { ServerProps } from "./types"

type Ip = {
  ip: string
  prefixLength?: string
  networkType?: string
  mainIp?: boolean
  nullRouted?: boolean
  reverseLookup?: string
  gateway?: string
  version?: number
  ddos?: { detectionProfile?: string; protectionType?: string }
}

type Interface = { type?: string; status?: string; linkSpeed?: string; operStatus?: string; switchName?: string; switchInterface?: string }

const IFACE_URL: Record<string, string> = { PUBLIC: "public", INTERNAL: "internal", REMOTE_MANAGEMENT: "remoteManagement" }
const PROFILES = ["ADVANCED_DEFAULT", "ADVANCED_LOW_UDP", "ADVANCED_MED_UDP"]

export function Network(props: ServerProps) {
  return (
    <div className="grid gap-8">
      <IpTable {...props} />
      {props.kind === "dedicated" ? (
        <>
          <Interfaces {...props} />
          <NullRouteHistory {...props} />
        </>
      ) : null}
    </div>
  )
}

function IpTable({ account, kind, id }: ServerProps) {
  const ips = useLw<{ ips: Ip[] }>(account, kind, id, "ips", kind === "dedicated" ? { limit: 100 } : undefined)
  const [editing, setEditing] = React.useState<Ip | null>(null)
  const { busy, run } = useAction()
  const address = (ip: Ip) => stripPrefix(ip.ip)

  return (
    <section>
      <h2 className="display mb-4 text-3xl">IP addresses</h2>
      <ErrorNote error={ips.error} className="mb-2" />
      {ips.isLoading && !ips.data ? (
        <Loading />
      ) : ips.data ? (
        <div className="bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Address</TableHead>
                <TableHead className="hidden sm:table-cell">Network</TableHead>
                <TableHead>Reverse DNS</TableHead>
                {kind === "dedicated" ? <TableHead className="hidden lg:table-cell">DDoS protection</TableHead> : null}
                <TableHead>Status</TableHead>
                <TableHead className="w-0 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ips.data.ips.map((ip) => (
                <TableRow key={ip.ip}>
                  <TableCell className="py-3 pl-5">
                    <span className="inline-flex items-center gap-1 tabular">
                      {address(ip)}
                      {ip.prefixLength ? <span className="text-muted-foreground">/{ip.prefixLength}</span> : null}
                      {ip.ip.includes("/") ? <span className="text-muted-foreground">/{ip.ip.split("/")[1]}</span> : null}
                      <CopyButton value={address(ip)} label="Copy address" className="size-6" />
                    </span>
                    {ip.mainIp ? <div className="text-[13px] text-muted-foreground">Main address</div> : null}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {humanize(ip.networkType)} · IPv{ip.version ?? (address(ip).includes(":") ? 6 : 4)}
                  </TableCell>
                  <TableCell className="max-w-64">
                    <span className="break-all">{ip.reverseLookup || <span className="text-muted-foreground">Not set</span>}</span>
                  </TableCell>
                  {kind === "dedicated" ? (
                    <TableCell className="hidden lg:table-cell">
                      {ip.ddos ? `${humanize(ip.ddos.protectionType)} · ${humanize(ip.ddos.detectionProfile)}` : "—"}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    {ip.nullRouted ? <StateMark state="NULLROUTED" label="Null routed" /> : <StateMark state="ON" label="Routed" />}
                  </TableCell>
                  <TableCell className="pr-5 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(ip)}>
                      <PencilSimpleIcon /> Edit
                    </Button>
                    {ip.nullRouted ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!!busy}
                        onClick={() =>
                          run(ip.ip, async () => {
                            await lwCall(account, kind, id, "POST", `ips/${address(ip)}/unnull`)
                            await ips.mutate()
                          }, "Null route removal requested")
                        }
                      >
                        {busy === ip.ip ? <Spinner /> : null} Remove null route
                      </Button>
                    ) : (
                      <ConfirmAction
                        title={`Null route ${address(ip)}?`}
                        description="All traffic to this address is dropped at Leaseweb's edge until the null route is removed. Use it to stop an attack or abuse."
                        confirmLabel="Null route"
                        destructive
                        onConfirm={async () => {
                          await lwCall(account, kind, id, "POST", `ips/${address(ip)}/null`, kind === "dedicated" ? undefined : { comment: "Null routed from Leaseweb Dock" })
                          toast.success("Null route requested")
                          await ips.mutate()
                        }}
                      >
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          Null route
                        </Button>
                      </ConfirmAction>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <IpDialog account={account} kind={kind} id={id} ip={editing} onClose={() => setEditing(null)} onSaved={() => ips.mutate()} />
    </section>
  )
}

function IpDialog({
  account,
  kind,
  id,
  ip,
  onClose,
  onSaved,
}: {
  account: number
  kind: string
  id: string
  ip: Ip | null
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog open={!!ip} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {ip ? <IpForm key={ip.ip} account={account} kind={kind} id={id} ip={ip} onClose={onClose} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function IpForm({
  account,
  kind,
  id,
  ip,
  onClose,
  onSaved,
}: {
  account: number
  kind: string
  id: string
  ip: Ip
  onClose: () => void
  onSaved: () => void
}) {
  const [rdns, setRdns] = React.useState(ip.reverseLookup ?? "")
  const [profile, setProfile] = React.useState(ip.ddos?.detectionProfile ?? "")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)
  const advanced = kind === "dedicated" && ip.ddos?.protectionType === "ADVANCED"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, string> = { reverseLookup: rdns.trim() }
      if (advanced && profile && profile !== ip.ddos?.detectionProfile) body.detectionProfile = profile
      await lwCall(account, kind, id, "PUT", `ips/${stripPrefix(ip.ip)}`, body)
      toast.success("IP address updated")
      onSaved()
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle className="display text-2xl tabular">{stripPrefix(ip.ip)}</DialogTitle>
        <DialogDescription className="prose-serif text-[15px]">
          The reverse DNS name is what this address resolves back to, for example for a mail server.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="my-6">
        <Field>
          <FieldLabel htmlFor="rdns">Reverse DNS</FieldLabel>
          <Input id="rdns" value={rdns} onChange={(e) => setRdns(e.target.value)} placeholder="mail.example.com" />
          <FieldDescription>The name should resolve to this address first.</FieldDescription>
        </Field>
        {advanced ? (
          <Field>
            <FieldLabel>DDoS detection profile</FieldLabel>
            <Select value={profile} onValueChange={setProfile}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROFILES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {humanize(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <ErrorNote error={error} />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner /> : null} Save
        </Button>
      </DialogFooter>
    </form>
  )
}

function Interfaces({ account, kind, id }: ServerProps) {
  const data = useLw<{ networkInterfaces: Interface[] }>(account, kind, id, "networkInterfaces")
  const { busy, run } = useAction()

  const toggle = (iface: Interface, open: boolean) => {
    const url = IFACE_URL[String(iface.type)] ?? String(iface.type).toLowerCase()
    return run(`${iface.type}`, async () => {
      await lwCall(account, kind, id, "POST", `networkInterfaces/${url}/${open ? "open" : "close"}`)
      setTimeout(() => data.mutate(), 3000)
    }, open ? "Opening the port" : "Closing the port")
  }

  return (
    <section>
      <h2 className="display mb-4 text-3xl">Switch ports</h2>
      <ErrorNote error={data.error} className="mb-2" />
      {data.isLoading && !data.data ? (
        <Loading />
      ) : data.data ? (
        <div className="bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Interface</TableHead>
                <TableHead>Port</TableHead>
                <TableHead className="hidden sm:table-cell">Link</TableHead>
                <TableHead className="hidden md:table-cell">Switch</TableHead>
                <TableHead className="w-0 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.networkInterfaces.map((iface, i) => {
                const open = String(iface.status).toUpperCase() === "OPEN"
                return (
                  <TableRow key={`${iface.type}-${iface.switchInterface ?? i}`}>
                    <TableCell className="py-3 pl-5">{humanize(iface.type)}</TableCell>
                    <TableCell>
                      <StateMark state={iface.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {[iface.linkSpeed, iface.operStatus ? humanize(iface.operStatus) : null].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {[iface.switchName, iface.switchInterface].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {open ? (
                        <ConfirmAction
                          title={`Close the ${humanize(iface.type).toLowerCase()} port?`}
                          description="The switch port is shut. The server loses that network until it is opened again."
                          confirmLabel="Close port"
                          destructive
                          onConfirm={() => toggle(iface, false)}
                        >
                          <Button size="sm" variant="ghost" disabled={!!busy}>
                            Close
                          </Button>
                        </ConfirmAction>
                      ) : (
                        <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => toggle(iface, true)}>
                          {busy === iface.type ? <Spinner /> : null} Open
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  )
}

type NullRoute = { ip?: string; nulledAt?: string; automatedUnnullingAt?: string; comment?: string; nullLevel?: number; ticketId?: string }

function NullRouteHistory({ account, kind, id }: ServerProps) {
  const data = useLw<{ nullRoutes: NullRoute[] }>(account, kind, id, "nullRouteHistory", { limit: 20 })
  if (data.error || !data.data?.nullRoutes?.length) return null
  return (
    <section>
      <h2 className="display mb-4 text-3xl">Null route history</h2>
      <Tile className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Address</TableHead>
              <TableHead>Nulled</TableHead>
              <TableHead className="hidden md:table-cell">Lifted automatically</TableHead>
              <TableHead className="hidden sm:table-cell pr-5">Comment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.nullRoutes.map((n, i) => (
              <TableRow key={i}>
                <TableCell className="py-3 pl-5 tabular">{n.ip}</TableCell>
                <TableCell>{formatDateTime(n.nulledAt)}</TableCell>
                <TableCell className="hidden md:table-cell">{formatDateTime(n.automatedUnnullingAt)}</TableCell>
                <TableCell className="hidden pr-5 sm:table-cell">{n.comment || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Tile>
    </section>
  )
}
