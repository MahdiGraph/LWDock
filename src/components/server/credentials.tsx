"use client"

import * as React from "react"
import { EyeIcon, PlusIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Tile } from "@/components/board"
import { ConfirmAction, CopyButton, ErrorNote, Loading, useAction } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLw } from "@/hooks/use-api"
import { api, errorMessage, lwCall, lwUrl } from "@/lib/client"
import { humanize } from "@/lib/format"
import type { ServerProps } from "./types"

type Credential = { type: string; username: string }

const DEDICATED_TYPES = [
  "OPERATING_SYSTEM",
  "CONTROL_PANEL",
  "REMOTE_MANAGEMENT",
  "RESCUE_MODE",
  "SWITCH",
  "PDU",
  "FIREWALL",
  "LOAD_BALANCER",
  "VNC",
  "TEMPORARY_OPERATING_SYSTEM",
  "VPN_USER",
  "DATABASE",
]
const CLOUD_TYPES = ["OPERATING_SYSTEM", "CONTROL_PANEL"]

export function Credentials({ account, kind, id }: ServerProps) {
  const list = useLw<{ credentials: Credential[] }>(account, kind, id, "credentials", kind === "dedicated" ? { limit: 100 } : undefined)
  const [revealed, setRevealed] = React.useState<Record<string, string>>({})
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null)
  const [dialog, setDialog] = React.useState<DialogState>(null)
  const { run } = useAction()
  const keyOf = (c: Credential) => `${c.type}/${c.username}`

  async function reveal(c: Credential) {
    setLoadingKey(keyOf(c))
    try {
      const res = await api<{ password?: string }>(lwUrl(account, kind, id, `credentials/${c.type}/${c.username}`))
      setRevealed((r) => ({ ...r, [keyOf(c)]: res.password ?? "" }))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div className="grid gap-2">
      <Tile className="lg:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="display text-3xl">Credentials</h2>
            <p className="prose-serif mt-2 max-w-2xl text-base text-muted-foreground">
              Passwords Leaseweb keeps for this server. Editing one here only updates the stored copy, not the password on
              the machine itself.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {kind !== "dedicated" ? (
              <ConfirmAction
                title="Reset the system password?"
                description="Leaseweb sets a new password on the running machine and stores it here. The machine may reboot."
                confirmLabel="Reset password"
                onConfirm={() =>
                  run("reset", async () => {
                    await lwCall(account, kind, id, "POST", "resetPassword")
                    setTimeout(() => list.mutate(), 5000)
                  }, "Password reset requested")
                }
              >
                <Button variant="secondary">Reset system password</Button>
              </ConfirmAction>
            ) : null}
            <Button onClick={() => setDialog({ mode: "add" })}>
              <PlusIcon /> Add
            </Button>
          </div>
        </div>
      </Tile>

      <ErrorNote error={list.error} />
      {list.isLoading && !list.data ? (
        <Loading />
      ) : list.data && list.data.credentials.length === 0 ? (
        <Tile>
          <p className="prose-serif text-base text-muted-foreground">No credentials are stored for this server.</p>
        </Tile>
      ) : list.data ? (
        <div className="bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Type</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Password</TableHead>
                <TableHead className="w-0 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.credentials.map((c) => {
                const key = keyOf(c)
                const pw = revealed[key]
                return (
                  <TableRow key={key}>
                    <TableCell className="py-3 pl-5">{humanize(c.type)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        {c.username}
                        <CopyButton value={c.username} label="Copy username" className="size-6" />
                      </span>
                    </TableCell>
                    <TableCell>
                      {pw !== undefined ? (
                        <span className="inline-flex items-center gap-1">
                          <code className="bg-muted px-1.5 py-0.5 text-[13px] break-all">{pw || "(empty)"}</code>
                          {pw ? <CopyButton value={pw} label="Copy password" className="size-6" /> : null}
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => reveal(c)} disabled={loadingKey === key}>
                          {loadingKey === key ? <Spinner /> : <EyeIcon />} Show
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ mode: "edit", cred: c })}>
                        Change
                      </Button>
                      <ConfirmAction
                        title="Delete this credential?"
                        description={`The stored ${humanize(c.type).toLowerCase()} password for ${c.username} is removed from Leaseweb.`}
                        confirmLabel="Delete"
                        destructive
                        onConfirm={async () => {
                          await lwCall(account, kind, id, "DELETE", `credentials/${c.type}/${c.username}`)
                          toast.success("Credential deleted")
                          await list.mutate()
                        }}
                      >
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          Delete
                        </Button>
                      </ConfirmAction>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <CredentialDialog
        account={account}
        kind={kind}
        id={id}
        state={dialog}
        onClose={() => setDialog(null)}
        onSaved={(c) => {
          setRevealed((r) => {
            const next = { ...r }
            delete next[keyOf(c)]
            return next
          })
          list.mutate()
        }}
      />
    </div>
  )
}

type DialogState = { mode: "add" } | { mode: "edit"; cred: Credential } | null

function CredentialDialog({
  account,
  kind,
  id,
  state,
  onClose,
  onSaved,
}: {
  account: number
  kind: string
  id: string
  state: DialogState
  onClose: () => void
  onSaved: (c: Credential) => void
}) {
  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {state ? (
          <CredentialForm
            account={account}
            key={state.mode === "edit" ? `${state.cred.type}/${state.cred.username}` : "add"}
            kind={kind}
            id={id}
            state={state}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CredentialForm({
  account,
  kind,
  id,
  state,
  onClose,
  onSaved,
}: {
  account: number
  kind: string
  id: string
  state: NonNullable<DialogState>
  onClose: () => void
  onSaved: (c: Credential) => void
}) {
  const types = kind === "dedicated" ? DEDICATED_TYPES : CLOUD_TYPES
  const editing = state.mode === "edit"
  const [type, setType] = React.useState(editing ? state.cred.type : types[0])
  const [username, setUsername] = React.useState(editing ? state.cred.username : "root")
  const [password, setPassword] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (editing) {
        await lwCall(account, kind, id, "PUT", `credentials/${type}/${username}`, { password })
      } else {
        await lwCall(account, kind, id, "POST", "credentials", { type, username, password })
      }
      toast.success("Credential saved")
      onSaved({ type, username })
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
        <DialogTitle className="display text-2xl">{editing ? "Change password" : "Add a credential"}</DialogTitle>
        <DialogDescription className="prose-serif text-[15px]">This only changes what Leaseweb has on file.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="my-6">
        <Field>
          <FieldLabel>Type</FieldLabel>
          <Select value={type} onValueChange={setType} disabled={editing}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {humanize(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="cred-user">Username</FieldLabel>
          <Input id="cred-user" value={username} onChange={(e) => setUsername(e.target.value)} disabled={editing} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="cred-pass">Password</FieldLabel>
          <Input id="cred-pass" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
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
