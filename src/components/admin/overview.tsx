"use client"

import Link from "next/link"
import { ArrowRightIcon } from "@phosphor-icons/react"
import { Board, Tile, TileLabel } from "@/components/board"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useApi } from "@/hooks/use-api"
import { KIND_META, type Kind, type ServerSummary } from "@/lib/kinds"
import type { AuditRow } from "@/lib/audit"
import type { PublicSettings } from "@/lib/settings"
import { timeAgo } from "@/lib/format"

function KindCount({ kind, enabled, className }: { kind: Kind; enabled: boolean; className?: string }) {
  const { data, error, isLoading } = useApi<{ servers: (ServerSummary & { assignees: unknown[] })[]; errors: { account: string }[] }>(
    enabled ? `/api/admin/servers?kind=${kind}` : null
  )
  const total = data?.servers.length ?? 0
  const shared = data?.servers.filter((s) => s.assignees.length > 0).length ?? 0
  return (
    <Tile tone="tile" className={className}>
      <Link href={`/admin/servers?kind=${kind}`} className="flex h-full flex-col justify-between gap-6 outline-none">
        <TileLabel>{KIND_META[kind].plural}</TileLabel>
        <div>
          {!enabled ? (
            <p className="display text-6xl text-muted-foreground">—</p>
          ) : isLoading && !data ? (
            <Skeleton className="h-14 w-20" />
          ) : error ? (
            <p className="text-sm text-destructive">{error.message}</p>
          ) : (
            <>
              <p className="display text-6xl tabular">{total}</p>
              <p className="mt-2 text-sm text-muted-foreground">{total ? `${shared} shared` : "None yet"}</p>
              {data?.errors.length ? (
                <p className="mt-1 text-sm text-destructive">
                  {data.errors.map((e) => e.account).join(", ")} could not be loaded
                </p>
              ) : null}
            </>
          )}
        </div>
      </Link>
    </Tile>
  )
}

export function AdminOverview({
  name,
  users,
  assignments,
  recent,
  settings,
}: {
  name: string
  users: { total: number; admins: number; disabled: number }
  assignments: { total: number; servers: number }
  recent: AuditRow[]
  settings: PublicSettings
}) {
  const configured = settings.leaseweb.configured
  const people = users.total - users.admins
  const proxy = settings.proxy
  const accounts = settings.leaseweb.accounts
  const unreadable = accounts.some((a) => a.unreadable)

  return (
    <Board>
      <Tile className="col-span-12 flex flex-col justify-between gap-10 lg:col-span-6 lg:row-span-2 lg:p-8">
        <h1 className="display text-5xl md:text-6xl">Hello, {name}</h1>
        <div>
          <p className="prose-serif max-w-xl text-xl md:text-2xl">
            {assignments.servers
              ? `${assignments.servers} server${assignments.servers === 1 ? " is" : "s are"} shared with ${people} user${people === 1 ? "" : "s"}.`
              : configured
                ? "Nothing is shared yet. Create a user, then assign them a server."
                : "Start by adding your Leaseweb API key."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {configured ? (
              <>
                <Button asChild size="lg">
                  <Link href="/admin/servers">Assign servers</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/admin/users">Add a user</Link>
                </Button>
              </>
            ) : (
              <Button asChild size="lg">
                <Link href="/admin/settings">Add the API key</Link>
              </Button>
            )}
          </div>
        </div>
      </Tile>

      <KindCount kind="dedicated" enabled={configured} className="col-span-6 lg:col-span-3" />
      <Tile tone="primary" className="col-span-6 lg:col-span-3">
        <Link href="/admin/settings" className="flex h-full flex-col justify-between gap-6 outline-none">
          <TileLabel className="opacity-80">Leaseweb API</TileLabel>
          <div>
            <p className="display text-3xl md:text-4xl">
              {!configured ? "Not set" : proxy.enabled ? proxy.protocol.toUpperCase() : "Direct"}
            </p>
            <p className="mt-2 text-sm opacity-80">
              {!configured
                ? unreadable
                  ? "A saved key cannot be read. Enter it again."
                  : "Add an API key in Settings"
                : `${accounts.length} account${accounts.length === 1 ? "" : "s"}${proxy.enabled ? ` via ${proxy.host}:${proxy.port}` : ", no proxy"}`}
            </p>
            {configured && unreadable ? <p className="mt-1 text-sm">A saved key cannot be read.</p> : null}
          </div>
        </Link>
      </Tile>
      <KindCount kind="instance" enabled={configured} className="col-span-6 lg:col-span-3" />
      <KindCount kind="vps" enabled={configured} className="col-span-6 lg:col-span-3" />

      <Tile className="col-span-12 lg:col-span-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="display text-2xl">Recent activity</h2>
          <Link href="/admin/activity" className="inline-flex items-center gap-1 text-sm hover:underline">
            All activity <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        {recent.length ? (
          <ol className="mt-5 grid gap-1">
            {recent.map((row) => (
              <li key={row.id} className="grid grid-cols-[1fr_auto] gap-4 bg-background/60 px-3 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{row.username ?? "Someone"}</span> · {row.action}
                  {row.server_id ? <span className="text-muted-foreground"> · {row.server_id}</span> : null}
                </span>
                <span className="text-muted-foreground tabular">{timeAgo(row.at)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="prose-serif mt-5 text-base text-muted-foreground">Actions people take show up here.</p>
        )}
      </Tile>

      <Tile tone="tile" className="col-span-12 flex flex-col justify-between gap-6 lg:col-span-4">
        <Link href="/admin/users" className="flex h-full flex-col justify-between gap-6 outline-none">
          <TileLabel>Users</TileLabel>
          <div>
            <p className="display text-6xl tabular">{users.total}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {users.admins} admin{users.admins === 1 ? "" : "s"}
              {users.disabled ? ` · ${users.disabled} disabled` : ""} · {assignments.total} assignment
              {assignments.total === 1 ? "" : "s"}
            </p>
          </div>
        </Link>
      </Tile>
    </Board>
  )
}
