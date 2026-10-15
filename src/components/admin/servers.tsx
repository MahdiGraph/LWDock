"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowsClockwiseIcon, MagnifyingGlassIcon, UserPlusIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { PageHeader } from "@/components/board"
import { ErrorNote, Loading, StateMark } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApi } from "@/hooks/use-api"
import { api, errorMessage, serverHref } from "@/lib/client"
import { Flag } from "@/components/flag"
import { KIND_META, KINDS, type Kind, type ServerSummary } from "@/lib/kinds"
import type { AdminUserRow } from "@/lib/users"

type Row = ServerSummary & { assignees: { userId: number; username: string; name: string | null }[] }
type ListResponse = { servers: Row[]; errors: { accountId: number; account: string; message: string }[] }

export function AdminServers({ configured, initialKind }: { configured: boolean; initialKind: Kind }) {
  const [kind, setKind] = React.useState<Kind>(initialKind)
  const [query, setQuery] = React.useState("")
  const [refreshing, setRefreshing] = React.useState(false)
  const [assigning, setAssigning] = React.useState<Row | null>(null)
  const { data, error, isLoading, mutate } = useApi<ListResponse>(configured ? `/api/admin/servers?kind=${kind}` : null)

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = data?.servers ?? []
    if (!q) return list
    return list.filter((s) =>
      [s.id, s.name, s.ip, s.location, s.spec, s.os, s.accountName, ...s.assignees.map((a) => a.username)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [data, query])

  async function refresh() {
    setRefreshing(true)
    try {
      await mutate(await api<ListResponse>(`/api/admin/servers?kind=${kind}&refresh=1`), { revalidate: false })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setRefreshing(false)
    }
  }

  if (!configured) {
    return (
      <>
        <PageHeader title="Servers" />
        <Empty className="bg-card py-16">
          <EmptyHeader>
            <EmptyTitle className="display text-2xl">The Leaseweb API key is missing</EmptyTitle>
            <EmptyDescription className="prose-serif text-base">
              Add it in Settings and your servers show up here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/admin/settings">Open Settings</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Servers"
        description="Every server on your Leaseweb account. Assign one to a user and it appears in their panel."
        actions={
          <Button variant="secondary" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Spinner /> : <ArrowsClockwiseIcon />} Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList variant="line">
            {KINDS.map((k) => (
              <TabsTrigger key={k} value={k} className="px-3 text-sm">
                {KIND_META[k].short}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <InputGroup className="h-9 bg-card md:w-80">
          <InputGroupAddon>
            <MagnifyingGlassIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search name, IP, user…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
      </div>

      <ErrorNote error={error} className="mb-4" />
      {data?.errors.map((e) => (
        <ErrorNote key={e.accountId} error={new Error(`${e.account}: ${e.message}`)} className="mb-2" />
      ))}
      {isLoading && !data ? (
        <Loading label="Loading servers from Leaseweb…" />
      ) : data && rows.length === 0 ? (
        <p className="prose-serif bg-card p-8 text-base text-muted-foreground">
          {query ? "No server matches that search." : `There are no ${KIND_META[kind].plural.toLowerCase()} on this account.`}
        </p>
      ) : data ? (
        <div className="bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Server</TableHead>
                <TableHead>IP address</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead className="hidden xl:table-cell">Spec</TableHead>
                <TableHead className="hidden md:table-cell">State</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead className="w-0 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={`${s.accountId}:${s.id}`}>
                  <TableCell className="py-3 pl-4">
                    <Link href={serverHref(s.accountId, s.kind, s.id)} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <div className="text-[13px] text-muted-foreground">
                      {s.name !== s.id ? <span className="tabular">{s.id} · </span> : null}
                      {s.accountName}
                    </div>
                  </TableCell>
                  <TableCell className="tabular">{s.ip ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Flag country={s.country} className="mr-1.5" />
                    {s.location ?? "—"}
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate xl:table-cell">{s.spec ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.state ? <StateMark state={s.state} /> : "—"}</TableCell>
                  <TableCell className="max-w-56">
                    {s.assignees.length ? (
                      <span className="line-clamp-2">{s.assignees.map((a) => a.username).join(", ")}</span>
                    ) : (
                      <span className="text-muted-foreground">Nobody</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setAssigning(s)}>
                      <UserPlusIcon /> Assign
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <AssignDialog server={assigning} onClose={() => setAssigning(null)} onSaved={() => mutate()} />
    </>
  )
}

function AssignDialog({ server, onClose, onSaved }: { server: Row | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={!!server} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {server ? <AssignForm key={`${server.accountId}:${server.kind}:${server.id}`} server={server} onClose={onClose} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function AssignForm({ server, onClose, onSaved }: { server: Row; onClose: () => void; onSaved: () => void }) {
  const users = useApi<{ users: AdminUserRow[] }>("/api/admin/users")
  const [selected, setSelected] = React.useState<Set<number>>(() => new Set(server.assignees.map((a) => a.userId)))
  const [saving, setSaving] = React.useState(false)

  const people = (users.data?.users ?? []).filter((u) => u.role === "user")

  async function save() {
    setSaving(true)
    try {
      await api("/api/admin/assignments", {
        method: "PUT",
        body: { accountId: server.accountId, kind: server.kind, serverId: server.id, label: server.name, userIds: [...selected] },
      })
      toast.success("Assignment saved")
      onSaved()
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle className="display text-2xl">Assign {server.name}</DialogTitle>
          <DialogDescription className="prose-serif text-[15px]">
            Users you tick can manage this server: power, reinstall, rescue, network and credentials. Admins already see
            every server.
          </DialogDescription>
        </DialogHeader>
        {users.isLoading ? (
          <Loading />
        ) : people.length === 0 ? (
          <p className="prose-serif bg-muted p-4 text-[15px]">
            There are no users yet.{" "}
            <Link href="/admin/users" className="underline">
              Create one first
            </Link>
            .
          </p>
        ) : (
          <ul className="grid max-h-80 gap-1 overflow-y-auto">
            {people.map((u) => {
              const checked = selected.has(u.id)
              return (
                <li key={u.id}>
                  <label className="flex cursor-pointer items-center gap-3 bg-muted px-3 py-2.5 text-sm hover:bg-accent">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = new Set(selected)
                        if (v) next.add(u.id)
                        else next.delete(u.id)
                        setSelected(next)
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{u.name || u.username}</span>
                      {u.name ? <span className="text-muted-foreground"> · {u.username}</span> : null}
                    </span>
                    {u.disabled ? <span className="text-[13px] text-muted-foreground">Disabled</span> : null}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || users.isLoading}>
            {saving ? <Spinner /> : null} Save
          </Button>
        </DialogFooter>
    </>
  )
}
