"use client"

import * as React from "react"
import Link from "next/link"
import { DotsThreeIcon, PlusIcon, XIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { PageHeader } from "@/components/board"
import { ConfirmAction, CopyButton, ErrorNote, Loading } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApi } from "@/hooks/use-api"
import { api, errorMessage } from "@/lib/client"
import { timeAgo } from "@/lib/format"
import { isKind, KIND_META } from "@/lib/kinds"
import type { AdminUserRow } from "@/lib/users"

export function generatePassword(length = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join("")
}

function PasswordInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <InputGroup className="h-9">
      <InputGroupInput id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="xs" onClick={() => onChange(generatePassword())}>
          Generate
        </InputGroupButton>
        {value ? <CopyButton value={value} className="size-6" /> : null}
      </InputGroupAddon>
    </InputGroup>
  )
}

export function AdminUsers({ meId }: { meId: number }) {
  const { data, error, isLoading, mutate } = useApi<{ users: AdminUserRow[] }>("/api/admin/users")
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<AdminUserRow | null>(null)
  const [resetting, setResetting] = React.useState<AdminUserRow | null>(null)

  async function patch(user: AdminUserRow, body: Record<string, unknown>, message: string) {
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body })
      toast.success(message)
      await mutate()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="People who can sign in. A user only ever sees the servers you assign to them."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> New user
          </Button>
        }
      />
      <ErrorNote error={error} className="mb-4" />
      {isLoading && !data ? (
        <Loading />
      ) : data ? (
        <div className="bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Servers</TableHead>
                <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="w-0 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="py-3 pl-4">
                    <div className="font-medium">{u.name || u.username}</div>
                    <div className="text-[13px] text-muted-foreground">{u.username}</div>
                  </TableCell>
                  <TableCell>{u.role === "admin" ? "Admin" : "User"}</TableCell>
                  <TableCell className="tabular">
                    {u.role === "admin" ? <span className="text-muted-foreground">All</span> : u.servers.length}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{timeAgo(u.last_login_at)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {u.disabled ? <span className="text-destructive">Disabled</span> : "Active"}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.username}`}>
                          <DotsThreeIcon className="size-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => setEditing(u)}>Edit and servers</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setResetting(u)}>Reset password</DropdownMenuItem>
                        {u.id !== meId ? (
                          <DropdownMenuItem
                            onSelect={() =>
                              patch(u, { disabled: !u.disabled }, u.disabled ? "User enabled" : "User disabled")
                            }
                          >
                            {u.disabled ? "Enable" : "Disable"}
                          </DropdownMenuItem>
                        ) : null}
                        {u.id !== meId ? (
                          <>
                            <DropdownMenuSeparator />
                            <ConfirmAction
                              title={`Delete ${u.username}?`}
                              description="The account and its server assignments are removed. The servers themselves are not touched."
                              confirmLabel="Delete user"
                              destructive
                              onConfirm={async () => {
                                await api(`/api/admin/users/${u.id}`, { method: "DELETE" })
                                toast.success("User deleted")
                                await mutate()
                              }}
                            >
                              <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                                Delete
                              </DropdownMenuItem>
                            </ConfirmAction>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <CreateUserDialog open={creating} onClose={() => setCreating(false)} onSaved={() => mutate()} />
      <EditUserDialog user={editing} meId={meId} onClose={() => setEditing(null)} onSaved={() => mutate()} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
    </>
  )
}

function CreateUserDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">{open ? <CreateUserForm onClose={onClose} onSaved={onSaved} /> : null}</DialogContent>
    </Dialog>
  )
}

function CreateUserForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = React.useState("")
  const [name, setName] = React.useState("")
  const [password, setPassword] = React.useState(() => generatePassword())
  const [role, setRole] = React.useState<"user" | "admin">("user")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api("/api/admin/users", { method: "POST", body: { username, name, password, role } })
      toast.success(`Created ${username}. Send them the password.`)
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
        <DialogTitle className="display text-2xl">New user</DialogTitle>
        <DialogDescription className="prose-serif text-[15px]">
          Copy the password before you save; it is not shown again.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="my-6">
        <Field>
          <FieldLabel htmlFor="nu-username">Username</FieldLabel>
          <Input id="nu-username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          <FieldDescription>3–32 letters, numbers, dots, dashes or underscores.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="nu-name">Display name</FieldLabel>
          <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        </Field>
        <Field>
          <FieldLabel htmlFor="nu-password">Password</FieldLabel>
          <PasswordInput id="nu-password" value={password} onChange={setPassword} />
        </Field>
        <Field>
          <FieldLabel>Role</FieldLabel>
          <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User: only assigned servers</SelectItem>
              <SelectItem value="admin">Admin: everything, including settings</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <ErrorNote error={error} />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner /> : null} Create user
        </Button>
      </DialogFooter>
    </form>
  )
}

function EditUserDialog({
  user,
  meId,
  onClose,
  onSaved,
}: {
  user: AdminUserRow | null
  meId: number
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {user ? <EditUserForm key={user.id} user={user} meId={meId} onClose={onClose} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function EditUserForm({
  user,
  meId,
  onClose,
  onSaved,
}: {
  user: AdminUserRow
  meId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState(user.name ?? "")
  const [role, setRole] = React.useState<"user" | "admin">(user.role)
  const [disabled, setDisabled] = React.useState(!!user.disabled)
  const [servers, setServers] = React.useState(user.servers)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)

  async function unassign(kind: string, serverId: string) {
    try {
      await api("/api/admin/assignments", { method: "DELETE", body: { kind, serverId, userId: user.id } })
      setServers((list) => list.filter((s) => !(s.kind === kind && s.server_id === serverId)))
      onSaved()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: { name: name || null, role, disabled } })
      toast.success("User saved")
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
        <DialogTitle className="display text-2xl">{user.username}</DialogTitle>
        <DialogDescription className="prose-serif text-[15px]">
          Change the name, role or access. Assign more servers from the Servers page.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="my-6">
        <Field>
          <FieldLabel htmlFor="eu-name">Display name</FieldLabel>
          <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel>Role</FieldLabel>
          <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {user.id !== meId ? (
          <Field orientation="horizontal">
            <Switch id="eu-disabled" checked={disabled} onCheckedChange={setDisabled} />
            <FieldLabel htmlFor="eu-disabled">Disabled (cannot sign in)</FieldLabel>
          </Field>
        ) : null}
        {user.role === "user" ? (
          <div>
            <p className="text-sm font-medium">Assigned servers</p>
            {servers.length ? (
              <ul className="mt-2 grid gap-1">
                {servers.map((s) => (
                  <li key={`${s.kind}:${s.server_id}`} className="flex items-center gap-3 bg-muted px-3 py-2 text-sm">
                    <Link
                      href={`/servers/${s.kind}/${encodeURIComponent(s.server_id)}`}
                      className="min-w-0 flex-1 truncate hover:underline"
                    >
                      {s.label || s.server_id}
                      <span className="text-muted-foreground"> · {isKind(s.kind) ? KIND_META[s.kind].short : s.kind}</span>
                    </Link>
                    <Button type="button" size="icon-xs" variant="ghost" aria-label="Unassign" onClick={() => unassign(s.kind, s.server_id)}>
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
            )}
          </div>
        ) : null}
        <ErrorNote error={error} />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner /> : null} Save
        </Button>
      </DialogFooter>
    </form>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: AdminUserRow | null; onClose: () => void }) {
  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {user ? <ResetPasswordForm key={user.id} user={user} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordForm({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [password, setPassword] = React.useState(() => generatePassword())
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: { password } })
      toast.success(`New password set for ${user.username}. They were signed out everywhere.`)
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
        <DialogTitle className="display text-2xl">Reset password</DialogTitle>
        <DialogDescription className="prose-serif text-[15px]">
          Set a new password for {user.username}. Copy it before you save.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="my-6">
        <Field>
          <FieldLabel htmlFor="rp-password">New password</FieldLabel>
          <PasswordInput id="rp-password" value={password} onChange={setPassword} />
        </Field>
        <ErrorNote error={error} />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || password.length < 8}>
          {busy ? <Spinner /> : null} Set password
        </Button>
      </DialogFooter>
    </form>
  )
}
