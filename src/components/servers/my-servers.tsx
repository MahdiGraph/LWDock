"use client"

import Link from "next/link"
import { ArrowRightIcon } from "@phosphor-icons/react"
import { PageHeader } from "@/components/board"
import { ErrorNote, Loading, StateMark } from "@/components/common"
import { useApi } from "@/hooks/use-api"
import { KIND_META, type ServerSummary } from "@/lib/kinds"

type Row = ServerSummary & { error?: string }

export function MyServers({ name }: { name: string }) {
  const { data, error, isLoading } = useApi<{ servers: Row[] }>("/api/servers")
  const servers = data?.servers ?? []

  return (
    <>
      <PageHeader
        title="My servers"
        description={
          servers.length
            ? `${name}, these are the servers you look after. Open one to power it, reinstall it or change its network.`
            : undefined
        }
      />
      <ErrorNote error={error} className="mb-4" />
      {isLoading && !data ? (
        <Loading label="Loading your servers…" />
      ) : data && servers.length === 0 ? (
        <div className="bg-card p-8 md:p-12">
          <p className="display text-3xl">No servers yet</p>
          <p className="prose-serif mt-3 max-w-lg text-base text-muted-foreground">
            Your admin has not assigned you a server. Once they do, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {servers.map((s) => (
            <li key={`${s.kind}:${s.id}`}>
              <Link
                href={`/servers/${s.kind}/${encodeURIComponent(s.id)}`}
                className="group grid grid-cols-12 items-center gap-x-4 gap-y-2 bg-card p-5 transition-colors outline-none hover:bg-accent focus-visible:bg-accent md:p-6"
              >
                <div className="col-span-12 min-w-0 md:col-span-4">
                  <p className="text-[13px] text-muted-foreground">{KIND_META[s.kind].label}</p>
                  <p className="display mt-1 truncate text-2xl md:text-3xl">{s.name}</p>
                </div>
                {s.error ? (
                  <p className="col-span-12 text-sm text-destructive md:col-span-7">{s.error}</p>
                ) : (
                  <>
                    <div className="col-span-6 md:col-span-2">
                      <p className="text-[13px] text-muted-foreground">IP address</p>
                      <p className="mt-0.5 truncate text-base tabular">{s.ip ?? "—"}</p>
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <p className="text-[13px] text-muted-foreground">Location</p>
                      <p className="mt-0.5 truncate text-base">{s.location ?? "—"}</p>
                    </div>
                    <div className="col-span-9 min-w-0 md:col-span-3">
                      <p className="text-[13px] text-muted-foreground">{s.kind === "dedicated" ? "Hardware" : "Plan"}</p>
                      <p className="mt-0.5 truncate text-base">{s.spec ?? s.os ?? "—"}</p>
                      {s.state && s.kind !== "dedicated" ? <StateMark state={s.state} className="mt-1" /> : null}
                    </div>
                  </>
                )}
                <div className="col-span-3 flex justify-end md:col-span-1">
                  <ArrowRightIcon className="size-6 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
