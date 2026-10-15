"use client"

import * as React from "react"
import { CheckCircleIcon, PlugsConnectedIcon, PlusIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Board, PageHeader, Tile } from "@/components/board"
import { ConfirmAction, ErrorNote } from "@/components/common"
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
import { Switch } from "@/components/ui/switch"
import { api, errorMessage } from "@/lib/client"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { AccountInfo } from "@/lib/accounts"
import type { PublicSettings } from "@/lib/settings"

const DEFAULT_BASE_URL = "https://api.leaseweb.com"

const PROTOCOLS = [
  { value: "socks5h", label: "SOCKS5, DNS resolved by the proxy", port: 1080 },
  { value: "socks5", label: "SOCKS5, DNS resolved locally", port: 1080 },
  { value: "socks4", label: "SOCKS4", port: 1080 },
  { value: "http", label: "HTTP proxy (CONNECT)", port: 8080 },
  { value: "https", label: "HTTPS proxy (TLS to the proxy)", port: 443 },
] as const

type TestResult = { ok: boolean; message: string; ms: number; viaProxy: boolean; reachable?: boolean }

function TestNote({ result, className }: { result: TestResult | null; className?: string }) {
  if (!result) return null
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 p-3 text-sm",
        result.ok ? "bg-success/10 text-success" : result.reachable ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive",
        className
      )}
    >
      {result.ok ? <CheckCircleIcon className="mt-0.5 size-4 shrink-0" /> : <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />}
      <span>
        {result.message} <span className="opacity-70 tabular">({result.ms} ms)</span>
      </span>
    </div>
  )
}

async function runTest(body: Record<string, unknown>): Promise<TestResult> {
  try {
    return await api<TestResult>("/api/admin/settings/test", { method: "POST", body })
  } catch (err) {
    return { ok: false, message: errorMessage(err), ms: 0, viaProxy: false }
  }
}

export function SettingsForms({ initial }: { initial: PublicSettings }) {
  const [accounts, setAccounts] = React.useState(initial.leaseweb.accounts)

  return (
    <>
      <PageHeader title="Settings" description="How Leaseweb Dock talks to the Leaseweb API." />
      <Board>
        <Tile className="col-span-12 lg:col-span-7 lg:p-8">
          <Accounts accounts={accounts} onChange={setAccounts} />
          <BaseUrlForm initial={initial.leaseweb.baseUrl} />
        </Tile>
        <Tile tone="tile" className="col-span-12 lg:col-span-5 lg:p-8">
          <ProxyForm initial={initial.proxy} />
        </Tile>
      </Board>
    </>
  )
}

/* ------------------------------------------------------------------ accounts */

function Accounts({ accounts, onChange }: { accounts: AccountInfo[]; onChange: (a: AccountInfo[]) => void }) {
  const [editing, setEditing] = React.useState<AccountInfo | null>(null)
  const [results, setResults] = React.useState<Record<number, TestResult | null>>({})
  const [testing, setTesting] = React.useState<number | null>(null)

  async function test(account: AccountInfo) {
    setTesting(account.id)
    setResults((r) => ({ ...r, [account.id]: null }))
    const result = await runTest({ accountId: account.id })
    setResults((r) => ({ ...r, [account.id]: result }))
    setTesting(null)
  }

  return (
    <section>
      <h2 className="display text-3xl">Leaseweb accounts</h2>
      <p className="prose-serif mt-2 text-base text-muted-foreground">
        Leaseweb gives a separate API key for each of its companies, for example one for servers in the Netherlands and
        one for Germany. Add every key; their servers are listed together. Create keys in the Customer Portal under API
        keys.
      </p>

      {accounts.length ? (
        <ul className="mt-6 grid gap-2">
          {accounts.map((a) => (
            <li key={a.id} className="bg-background/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-medium">{a.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {a.unreadable ? (
                      <span className="text-destructive">The key cannot be decrypted. Enter it again.</span>
                    ) : (
                      <>
                        Key {a.keyHint} · added {formatDate(a.created_at)}
                      </>
                    )}
                    {a.assignments ? ` · ${a.assignments} assignment${a.assignments === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button size="sm" variant="secondary" onClick={() => test(a)} disabled={testing === a.id}>
                    {testing === a.id ? <Spinner /> : <PlugsConnectedIcon />} Test
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                    Edit
                  </Button>
                  <ConfirmAction
                    title={`Remove ${a.name}?`}
                    description={
                      a.assignments
                        ? `Its servers disappear from the panel and ${a.assignments} assignment${a.assignments === 1 ? " is" : "s are"} removed. The servers themselves are not touched.`
                        : "Its servers disappear from the panel. The servers themselves are not touched."
                    }
                    confirmLabel="Remove account"
                    destructive
                    onConfirm={async () => {
                      const res = await api<{ accounts: AccountInfo[] }>(`/api/admin/accounts/${a.id}`, { method: "DELETE" })
                      onChange(res.accounts)
                      toast.success(`${a.name} removed`)
                    }}
                  >
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                      Remove
                    </Button>
                  </ConfirmAction>
                </div>
              </div>
              <TestNote result={results[a.id] ?? null} className="mt-3" />
            </li>
          ))}
        </ul>
      ) : null}

      <AddAccountForm first={accounts.length === 0} onAdded={onChange} />
      <EditAccountDialog account={editing} onClose={() => setEditing(null)} onSaved={onChange} />
    </section>
  )
}

function AddAccountForm({ first, onAdded }: { first: boolean; onAdded: (a: AccountInfo[]) => void }) {
  const [name, setName] = React.useState(first ? "Netherlands" : "")
  const [apiKey, setApiKey] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [result, setResult] = React.useState<TestResult | null>(null)
  const [error, setError] = React.useState<unknown>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ accounts: AccountInfo[] }>("/api/admin/accounts", { method: "POST", body: { name, apiKey } })
      onAdded(res.accounts)
      toast.success(`${name} added`)
      setName("")
      setApiKey("")
      setResult(null)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form method="post" onSubmit={submit} className="mt-6 bg-background/70 p-4">
      <p className="text-base font-medium">{first ? "Add your first API key" : "Add another API key"}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr]">
        <Field>
          <FieldLabel htmlFor="acc-name">Name</FieldLabel>
          <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Germany" maxLength={60} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="acc-key">API key</FieldLabel>
          <Input
            id="acc-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste the key"
            required
          />
        </Field>
      </div>
      <TestNote result={result} className="mt-3" />
      <ErrorNote error={error} className="mt-3" />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !name.trim() || !apiKey.trim()}>
          {busy ? <Spinner /> : <PlusIcon />} Add account
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={testing || !apiKey.trim()}
          onClick={async () => {
            setTesting(true)
            setResult(await runTest({ apiKey }))
            setTesting(false)
          }}
        >
          {testing ? <Spinner /> : <PlugsConnectedIcon />} Test key
        </Button>
      </div>
    </form>
  )
}

function EditAccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: AccountInfo | null
  onClose: () => void
  onSaved: (a: AccountInfo[]) => void
}) {
  return (
    <Dialog open={!!account} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {account ? <EditAccountForm key={account.id} account={account} onClose={onClose} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function EditAccountForm({
  account,
  onClose,
  onSaved,
}: {
  account: AccountInfo
  onClose: () => void
  onSaved: (a: AccountInfo[]) => void
}) {
  const [name, setName] = React.useState(account.name)
  const [apiKey, setApiKey] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ accounts: AccountInfo[] }>(`/api/admin/accounts/${account.id}`, {
        method: "PATCH",
        body: { name, ...(apiKey.trim() ? { apiKey } : {}) },
      })
      onSaved(res.accounts)
      toast.success("Account saved")
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form method="post" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle className="display text-2xl">{account.name}</DialogTitle>
        <DialogDescription className="prose-serif text-[15px]">
          Rename the account or replace its API key. Assignments stay as they are.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="my-6">
        <Field>
          <FieldLabel htmlFor="ea-name">Name</FieldLabel>
          <Input id="ea-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="ea-key">New API key</FieldLabel>
          <Input
            id="ea-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={account.keyHint ? `Leave empty to keep ${account.keyHint}` : "Paste the key"}
          />
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

function BaseUrlForm({ initial }: { initial: string }) {
  const [baseUrl, setBaseUrl] = React.useState(initial)
  const [busy, setBusy] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api("/api/admin/settings", { method: "PUT", body: { leaseweb: { baseUrl: baseUrl.trim() || DEFAULT_BASE_URL } } })
      toast.success("API address saved")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="mt-8">
      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">API address</summary>
      <form method="post" onSubmit={submit} className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
        <Field className="flex-1">
          <FieldLabel htmlFor="base-url">Address used for every account</FieldLabel>
          <Input id="base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="bg-background" />
          <FieldDescription>Leave as {DEFAULT_BASE_URL} unless Leaseweb told you otherwise.</FieldDescription>
        </Field>
        <Button type="submit" variant="secondary" disabled={busy} className="sm:mb-6">
          {busy ? <Spinner /> : null} Save
        </Button>
      </form>
    </details>
  )
}

/* ------------------------------------------------------------------ proxy */

function ProxyForm({ initial }: { initial: PublicSettings["proxy"] }) {
  const [enabled, setEnabled] = React.useState(initial.enabled)
  const [protocol, setProtocol] = React.useState<string>(initial.protocol)
  const [host, setHost] = React.useState(initial.host)
  const [port, setPort] = React.useState(initial.port ? String(initial.port) : "")
  const [username, setUsername] = React.useState(initial.username)
  const [password, setPassword] = React.useState("")
  const [hasPassword, setHasPassword] = React.useState(initial.hasPassword)
  const [clearPassword, setClearPassword] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [result, setResult] = React.useState<TestResult | null>(null)

  const proxyBody = () => ({
    enabled,
    protocol,
    host: host.trim(),
    port: port ? Number(port) : null,
    username,
    ...(clearPassword ? { password: "" } : password ? { password } : {}),
  })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const next = await api<PublicSettings>("/api/admin/settings", { method: "PUT", body: { proxy: proxyBody() } })
      setHasPassword(next.proxy.hasPassword)
      setPassword("")
      setClearPassword(false)
      toast.success(enabled ? "Proxy saved. All Leaseweb traffic now goes through it." : "Proxy saved and turned off")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form method="post" onSubmit={save}>
      <div className="flex items-start justify-between gap-4">
        <h2 className="display text-3xl">Outbound proxy</h2>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Use a proxy" />
      </div>
      <p className="prose-serif mt-2 text-base text-muted-foreground">
        When this is on, every request to Leaseweb, for every account, goes through the proxy and only through it. If
        the proxy is down, requests fail instead of going direct.
      </p>
      <FieldGroup className={cn("mt-6", !enabled && "opacity-60")}>
        <Field>
          <FieldLabel>Protocol</FieldLabel>
          <Select
            value={protocol}
            onValueChange={(v) => {
              setProtocol(v)
              if (!port) setPort(String(PROTOCOLS.find((x) => x.value === v)?.port ?? ""))
            }}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROTOCOLS.map((x) => (
                <SelectItem key={x.value} value={x.value}>
                  {x.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field>
            <FieldLabel htmlFor="proxy-host">Host</FieldLabel>
            <Input id="proxy-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="proxy.example.com" className="bg-background" />
          </Field>
          <Field>
            <FieldLabel htmlFor="proxy-port">Port</FieldLabel>
            <Input
              id="proxy-port"
              inputMode="numeric"
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="bg-background tabular"
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="proxy-user">Username</FieldLabel>
            <Input id="proxy-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Optional" autoComplete="off" className="bg-background" />
          </Field>
          <Field>
            <FieldLabel htmlFor="proxy-pass">Password</FieldLabel>
            <Input
              id="proxy-pass"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setClearPassword(false)
              }}
              placeholder={hasPassword ? "Saved. Leave empty to keep." : "Optional"}
              autoComplete="new-password"
              className="bg-background"
            />
          </Field>
        </div>
        {hasPassword ? (
          <Field orientation="horizontal">
            <Switch id="proxy-clear" checked={clearPassword} onCheckedChange={setClearPassword} />
            <FieldLabel htmlFor="proxy-clear">Remove the saved password</FieldLabel>
          </Field>
        ) : null}
        <TestNote result={result} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner /> : null} Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={testing}
            onClick={async () => {
              setTesting(true)
              setResult(null)
              setResult(await runTest({ proxy: proxyBody() }))
              setTesting(false)
            }}
          >
            {testing ? <Spinner /> : <PlugsConnectedIcon />} {enabled ? "Test through proxy" : "Test direct"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
