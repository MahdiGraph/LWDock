"use client"

import * as React from "react"
import Link from "next/link"
import useSWRInfinite from "swr/infinite"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { PageHeader } from "@/components/board"
import { ErrorNote, Loading } from "@/components/common"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetcher, serverHref } from "@/lib/client"
import { formatDateTime, timeAgo } from "@/lib/format"
import { isKind, KIND_META } from "@/lib/kinds"
import type { AuditRow } from "@/lib/audit"

type Page = { rows: AuditRow[]; more: boolean }

export function ActivityLog() {
  const [query, setQuery] = React.useState("")
  const [debounced, setDebounced] = React.useState("")

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite<Page>(
    (index, previous) => {
      if (previous && !previous.more) return null
      const params = new URLSearchParams({ limit: "50" })
      const last = previous?.rows[previous.rows.length - 1]
      if (index > 0 && last) params.set("before", String(last.id))
      if (debounced) params.set("q", debounced)
      return `/api/admin/activity?${params}`
    },
    fetcher<Page>,
    { revalidateOnFocus: false }
  )

  const rows = data?.flatMap((p) => p.rows) ?? []
  const more = data?.[data.length - 1]?.more ?? false
  const loadingMore = isValidating && size > (data?.length ?? 0)

  return (
    <>
      <PageHeader
        title="Activity"
        description="Every change made through the panel: who did it, to which server, and what Leaseweb answered."
        actions={
          <InputGroup className="h-9 bg-card md:w-80">
            <InputGroupAddon>
              <MagnifyingGlassIcon />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search user, action, server…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </InputGroup>
        }
      />
      <ErrorNote error={error} className="mb-4" />
      {isLoading && rows.length === 0 ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="prose-serif bg-card p-8 text-base text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead className="hidden md:table-cell">Server</TableHead>
                <TableHead className="hidden sm:table-cell">Result</TableHead>
                <TableHead className="hidden pr-4 lg:table-cell">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const failed = r.status !== null && r.status >= 400
                return (
                  <TableRow key={r.id}>
                    <TableCell className="py-3 pl-4 whitespace-nowrap" title={formatDateTime(r.at)}>
                      {timeAgo(r.at)}
                    </TableCell>
                    <TableCell>{r.username ?? "—"}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="whitespace-normal">{r.action}</div>
                      {r.detail ? <div className="mt-0.5 text-[13px] break-all text-muted-foreground">{r.detail}</div> : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {r.server_id && r.kind && r.account_id && isKind(r.kind) ? (
                        <Link href={serverHref(r.account_id, r.kind, r.server_id)} className="hover:underline">
                          {r.server_id}
                          <span className="text-muted-foreground"> · {KIND_META[r.kind].short}</span>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {r.status === null ? "—" : failed ? <span className="text-destructive">Failed ({r.status})</span> : "Done"}
                    </TableCell>
                    <TableCell className="hidden pr-4 text-muted-foreground lg:table-cell tabular">{r.ip ?? "—"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {more ? (
        <div className="mt-4">
          <Button variant="secondary" disabled={loadingMore} onClick={() => setSize(size + 1)}>
            {loadingMore ? <Spinner /> : null} Load more
          </Button>
        </div>
      ) : null}
    </>
  )
}
