"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeftIcon, PencilSimpleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Board, Tile, TileLabel } from "@/components/board"
import { Flag } from "@/components/flag"
import { CopyButton, ErrorNote, Loading } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLw } from "@/hooks/use-api"
import { api, errorMessage } from "@/lib/client"
import { KIND_META, summarize } from "@/lib/kinds"
import { CloudIso, CloudReinstall, CloudSnapshots } from "./cloud"
import { Credentials } from "./credentials"
import { Graphs } from "./graphs"
import { Hardware } from "./hardware"
import { InstallOs, RescueMode } from "./install"
import { Jobs } from "./jobs"
import { Network } from "./network"
import { CloudOverview, DedicatedOverview } from "./overview"
import { PowerTile } from "./power"
import { TRANSITIONAL, type Dict, type ServerProps } from "./types"

export function ServerView({
  account,
  accountName,
  kind,
  id,
  isAdmin,
  canRename,
  nickname: initialNickname,
}: ServerProps & { accountName: string; canRename: boolean; nickname: string | null }) {
  const [tab, setTab] = React.useState("overview")
  const [nickname, setNickname] = React.useState(initialNickname)
  const detail = useLw<Dict>(account, kind, id, "", undefined, {
    refreshInterval: (d) => (kind !== "dedicated" && d && TRANSITIONAL.includes(String(d.state)) ? 4000 : 0),
  })
  const raw = detail.data
  const s = raw ? summarize(kind, raw, { id: account, name: accountName }) : null
  const props = { account, kind, id, isAdmin }
  const refreshDetail = () => detail.mutate()
  const showJobs = () => setTab("jobs")

  const tabs: { value: string; label: string; content: React.ReactNode }[] =
    kind === "dedicated"
      ? [
          { value: "overview", label: "Overview", content: raw && <DedicatedOverview {...props} raw={raw} onStarted={showJobs} /> },
          { value: "install", label: "Install OS", content: <InstallOs {...props} onStarted={showJobs} /> },
          { value: "rescue", label: "Rescue", content: <RescueMode {...props} onStarted={showJobs} /> },
          { value: "network", label: "Network", content: <Network {...props} /> },
          { value: "credentials", label: "Credentials", content: <Credentials {...props} /> },
          { value: "graphs", label: "Graphs", content: <Graphs {...props} /> },
          { value: "jobs", label: "Jobs", content: <Jobs {...props} /> },
          { value: "hardware", label: "Hardware", content: <Hardware {...props} onStarted={showJobs} /> },
        ]
      : [
          { value: "overview", label: "Overview", content: raw && <CloudOverview {...props} raw={raw} /> },
          { value: "reinstall", label: "Reinstall", content: <CloudReinstall {...props} onStarted={refreshDetail} /> },
          { value: "network", label: "Network", content: <Network {...props} /> },
          { value: "credentials", label: "Credentials", content: <Credentials {...props} /> },
          { value: "graphs", label: "Graphs", content: <Graphs {...props} /> },
          { value: "snapshots", label: "Snapshots", content: <CloudSnapshots {...props} /> },
          { value: "iso", label: "ISO", content: raw && <CloudIso {...props} raw={raw} onChanged={refreshDetail} /> },
        ]

  return (
    <>
      <Link
        href={isAdmin ? `/admin/servers?kind=${kind}` : "/servers"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> {isAdmin ? "All servers" : "My servers"}
      </Link>

      {detail.error && !raw ? (
        <ErrorNote error={detail.error} />
      ) : !raw || !s ? (
        <Loading label="Loading the server from Leaseweb…" />
      ) : (
        <>
          <Board className="mb-8">
            <Tile className="col-span-12 flex flex-col justify-between gap-8 lg:col-span-6 lg:p-8">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[13px] text-muted-foreground">
                  {KIND_META[kind].label} · {accountName} · <span className="tabular">{id}</span>
                </p>
                {canRename ? (
                  <RenameButton {...props} leasewebName={s.name} nickname={nickname} onSaved={setNickname} />
                ) : null}
              </div>
              <div>
                <h1 className="display text-4xl break-words md:text-6xl">{nickname || s.name}</h1>
                {nickname ? (
                  <p className="mt-3 text-sm text-muted-foreground">Leaseweb name: {s.name}</p>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{[s.spec, s.os].filter(Boolean).join(" · ") || " "}</p>
            </Tile>
            <PowerTile {...props} raw={raw} onChanged={refreshDetail} className="col-span-12 sm:col-span-6 lg:col-span-3" />
            <Tile tone="tile" className="col-span-12 flex flex-col justify-between gap-6 sm:col-span-6 lg:col-span-3">
              <TileLabel>Main IP address</TileLabel>
              <div>
                <div className="flex items-center gap-1">
                  <p className="display text-2xl break-all tabular md:text-[1.75rem]">{s.ip ?? "—"}</p>
                  {s.ip ? <CopyButton value={s.ip} label="Copy IP" /> : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  <Flag country={s.country} className="mr-1.5" />
                  {s.location ?? " "}
                </p>
              </div>
            </Tile>
          </Board>

          <Tabs value={tab} onValueChange={setTab}>
            <div className="mb-6 overflow-x-auto">
              <TabsList variant="line" className="h-10">
                {tabs.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="px-3 text-sm">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {tabs.map((t) => (
              <TabsContent key={t.value} value={t.value}>
                {t.content}
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </>
  )
}

/** A name for the server that only this user sees. The Leaseweb reference is never changed. */
function RenameButton({
  account,
  kind,
  id,
  leasewebName,
  nickname,
  onSaved,
}: ServerProps & { leasewebName: string; nickname: string | null; onSaved: (nickname: string | null) => void }) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(nickname ?? "")
  const [busy, setBusy] = React.useState(false)

  async function save(next: string | null) {
    setBusy(true)
    try {
      const res = await api<{ nickname: string | null }>("/api/servers/nickname", {
        method: "PUT",
        body: { accountId: account, kind, serverId: id, nickname: next },
      })
      onSaved(res.nickname)
      toast.success(res.nickname ? "Name saved. Only you see it." : "Back to the Leaseweb name")
      setOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(nickname ?? "")
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Rename for me">
          <PencilSimpleIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          method="post"
          onSubmit={(e) => {
            e.preventDefault()
            save(value.trim() || null)
          }}
        >
          <DialogHeader>
            <DialogTitle className="display text-2xl">Your name for this server</DialogTitle>
            <DialogDescription className="prose-serif text-[15px]">
              Only you see this name. At Leaseweb the server keeps its name, {leasewebName}.
            </DialogDescription>
          </DialogHeader>
          <Input
            className="my-6"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={leasewebName}
            maxLength={80}
            autoFocus
          />
          <DialogFooter>
            {nickname ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => save(null)} className="sm:mr-auto">
                Use the Leaseweb name
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : null} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
