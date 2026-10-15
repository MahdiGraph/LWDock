"use client"

import * as React from "react"
import { PlusIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Board, Tile } from "@/components/board"
import { ConfirmAction, ErrorNote, Loading, StateMark, useAction } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useCatalog, useLw } from "@/hooks/use-api"
import { lwCall } from "@/lib/client"
import { formatDateTime } from "@/lib/format"
import { get, type Dict, type ServerProps } from "./types"

type Image = { id: string; name: string; family?: string; custom?: boolean }

export function CloudReinstall({ kind, id, onStarted }: ServerProps & { onStarted: () => void }) {
  const images = useLw<{ images: Image[] }>(kind, id, "reinstall/images", { limit: 100 })
  const [imageId, setImageId] = React.useState("")
  const list = [...(images.data?.images ?? [])].sort(
    (a, b) => Number(!!a.custom) - Number(!!b.custom) || a.name.localeCompare(b.name)
  )
  const chosen = list.find((i) => i.id === imageId)

  return (
    <Board>
      <Tile className="col-span-12 lg:col-span-8 lg:p-8">
        <h2 className="display text-3xl">Reinstall</h2>
        <p className="prose-serif mt-2 max-w-2xl text-base text-muted-foreground">
          Replaces the system disk with a fresh image. Everything on the disk is erased.
        </p>
        <ErrorNote error={images.error} className="mt-4" />
        {images.isLoading && !images.data ? (
          <Loading label="Loading images…" />
        ) : (
          <FieldGroup className="mt-6 max-w-xl">
            <Field>
              <FieldLabel>Image</FieldLabel>
              <Select value={imageId} onValueChange={setImageId}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {list.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                      {i.custom ? " (your image)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div>
              <ConfirmAction
                title={`Erase and reinstall with ${chosen?.name ?? "this image"}?`}
                description="The system disk is wiped and the machine reboots. There is no undo. The new password appears under Credentials."
                confirmLabel="Erase and reinstall"
                destructive
                onConfirm={async () => {
                  await lwCall(kind, id, "PUT", "reinstall", { imageId })
                  toast.success("Reinstall started")
                  onStarted()
                }}
              >
                <Button size="lg" disabled={!imageId}>
                  Reinstall
                </Button>
              </ConfirmAction>
            </div>
          </FieldGroup>
        )}
      </Tile>
      <Tile tone="tile" className="col-span-12 lg:col-span-4">
        <h3 className="display text-xl">Before you start</h3>
        <div className="prose-serif mt-3 grid gap-3 text-[15px] text-muted-foreground">
          <p>Take a snapshot first if you might want the current disk back.</p>
          <p>The state changes while it reinstalls. It is done when it shows Running again.</p>
        </div>
      </Tile>
    </Board>
  )
}

type Snapshot = { id: string; displayName?: string; state?: string; created?: string }

export function CloudSnapshots({ kind, id }: ServerProps) {
  const snaps = useLw<{ snapshots: Snapshot[] }>(kind, id, "snapshots", undefined, {
    refreshInterval: (d) => (d?.snapshots?.some((s) => s.state === "CREATING") ? 5000 : 0),
  })
  const [name, setName] = React.useState("")
  const { busy, run } = useAction()

  return (
    <div className="grid gap-2">
      <Tile className="lg:p-8">
        <h2 className="display text-3xl">Snapshots</h2>
        <p className="prose-serif mt-2 max-w-2xl text-base text-muted-foreground">
          A snapshot is a copy of the disk at one moment. Restoring one rolls the disk back to it.
        </p>
        <form
          className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            run("create", async () => {
              await lwCall(kind, id, "POST", "snapshots", { name: name.trim() || `Snapshot ${new Date().toLocaleString()}` })
              setName("")
              await snaps.mutate()
            }, "Snapshot is being created")
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, for example before-upgrade" className="bg-background" />
          <Button type="submit" disabled={!!busy}>
            {busy === "create" ? <Spinner /> : <PlusIcon />} Take snapshot
          </Button>
        </form>
      </Tile>
      <ErrorNote error={snaps.error} />
      {snaps.isLoading && !snaps.data ? (
        <Loading />
      ) : snaps.data?.snapshots.length ? (
        <ul className="grid gap-2">
          {snaps.data.snapshots.map((snap) => (
            <li key={snap.id} className="flex flex-col gap-3 bg-card p-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="truncate text-base font-medium">{snap.displayName || snap.id}</p>
                <p className="text-[13px] text-muted-foreground">{formatDateTime(snap.created)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StateMark state={snap.state} className="mr-2" />
                <ConfirmAction
                  title="Restore this snapshot?"
                  description="The disk goes back to how it was when the snapshot was taken. Changes since then are lost."
                  confirmLabel="Restore"
                  destructive
                  onConfirm={async () => {
                    await lwCall(kind, id, "PUT", `snapshots/${snap.id}`)
                    toast.success("Restore started")
                  }}
                >
                  <Button size="sm" variant="secondary" disabled={snap.state !== "READY"}>
                    Restore
                  </Button>
                </ConfirmAction>
                <ConfirmAction
                  title="Delete this snapshot?"
                  description="It cannot be brought back."
                  confirmLabel="Delete"
                  destructive
                  onConfirm={async () => {
                    await lwCall(kind, id, "DELETE", `snapshots/${snap.id}`)
                    toast.success("Snapshot deleted")
                    await snaps.mutate()
                  }}
                >
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                    Delete
                  </Button>
                </ConfirmAction>
              </div>
            </li>
          ))}
        </ul>
      ) : snaps.data ? (
        <Tile>
          <p className="prose-serif text-base text-muted-foreground">No snapshots yet.</p>
        </Tile>
      ) : null}
    </div>
  )
}

type Iso = { id: string; name: string }

export function CloudIso({ kind, id, raw, onChanged }: ServerProps & { raw: Dict; onChanged: () => void }) {
  const isos = useCatalog<{ isos: Iso[] }>(kind === "vps" ? "publicCloud/v1/vps/isos" : "publicCloud/v1/isos", { all: "isos" })
  const [isoId, setIsoId] = React.useState("")
  const { busy, run } = useAction()
  const current = get<Iso>(raw, "iso")

  return (
    <Board>
      <Tile className="col-span-12 lg:col-span-8 lg:p-8">
        <h2 className="display text-3xl">ISO image</h2>
        <p className="prose-serif mt-2 max-w-2xl text-base text-muted-foreground">
          Attach an installer or tool ISO, then reboot and use the Console to boot from it.
        </p>
        {current?.id ? (
          <div className="mt-6 flex flex-col gap-3 bg-tile p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base">
              Attached: <span className="font-medium">{current.name}</span>
            </p>
            <Button
              variant="secondary"
              disabled={!!busy}
              onClick={() =>
                run("detach", async () => {
                  await lwCall(kind, id, "POST", "detachIso")
                  onChanged()
                }, "ISO detached")
              }
            >
              {busy === "detach" ? <Spinner /> : null} Detach
            </Button>
          </div>
        ) : null}
        <ErrorNote error={isos.error} className="mt-4" />
        <FieldGroup className="mt-6 max-w-xl">
          <Field>
            <FieldLabel>ISO</FieldLabel>
            <Select value={isoId} onValueChange={setIsoId}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder={isos.isLoading ? "Loading…" : "Choose one"} />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {(isos.data?.isos ?? []).map((iso) => (
                  <SelectItem key={iso.id} value={iso.id}>
                    {iso.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div>
            <Button
              disabled={!isoId || !!busy}
              onClick={() =>
                run("attach", async () => {
                  await lwCall(kind, id, "POST", "attachIso", { isoId })
                  onChanged()
                }, "ISO attached")
              }
            >
              {busy === "attach" ? <Spinner /> : null} Attach
            </Button>
          </div>
        </FieldGroup>
      </Tile>
      <Tile tone="tile" className="col-span-12 lg:col-span-4">
        <h3 className="display text-xl">Booting from it</h3>
        <div className="prose-serif mt-3 grid gap-3 text-[15px] text-muted-foreground">
          <p>After attaching, reboot from the State tile and open the Console to pick the CD drive in the boot menu.</p>
          <p>Detach the ISO when you are done so the machine boots from its disk again.</p>
        </div>
      </Tile>
    </Board>
  )
}
