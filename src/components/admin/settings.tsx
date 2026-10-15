"use client"

import * as React from "react"
import { CheckCircleIcon, PlugsConnectedIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Board, PageHeader, Tile } from "@/components/board"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { api, errorMessage } from "@/lib/client"
import { cn } from "@/lib/utils"
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

function TestNote({ result }: { result: TestResult | null }) {
  if (!result) return null
  const good = result.ok
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 p-3 text-sm",
        good ? "bg-success/10 text-success" : result.reachable ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
      )}
    >
      {good ? <CheckCircleIcon className="mt-0.5 size-4 shrink-0" /> : <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />}
      <span>
        {result.message} <span className="opacity-70 tabular">({result.ms} ms)</span>
      </span>
    </div>
  )
}

export function SettingsForms({ initial }: { initial: PublicSettings }) {
  const [settings, setSettings] = React.useState(initial)

  // Leaseweb API
  const [apiKey, setApiKey] = React.useState("")
  const [baseUrl, setBaseUrl] = React.useState(initial.leaseweb.baseUrl)
  const [savingApi, setSavingApi] = React.useState(false)
  const [testingApi, setTestingApi] = React.useState(false)
  const [apiResult, setApiResult] = React.useState<TestResult | null>(null)

  // Proxy
  const p = initial.proxy
  const [enabled, setEnabled] = React.useState(p.enabled)
  const [protocol, setProtocol] = React.useState<string>(p.protocol)
  const [host, setHost] = React.useState(p.host)
  const [port, setPort] = React.useState(p.port ? String(p.port) : "")
  const [username, setUsername] = React.useState(p.username)
  const [password, setPassword] = React.useState("")
  const [clearPassword, setClearPassword] = React.useState(false)
  const [savingProxy, setSavingProxy] = React.useState(false)
  const [testingProxy, setTestingProxy] = React.useState(false)
  const [proxyResult, setProxyResult] = React.useState<TestResult | null>(null)

  const leasewebBody = (keyOverride?: string) => ({
    ...(keyOverride !== undefined ? { apiKey: keyOverride } : apiKey ? { apiKey } : {}),
    baseUrl: baseUrl.trim() || DEFAULT_BASE_URL,
  })

  const proxyBody = () => ({
    enabled,
    protocol,
    host: host.trim(),
    port: port ? Number(port) : null,
    username,
    ...(clearPassword ? { password: "" } : password ? { password } : {}),
  })

  async function saveApi(e: React.FormEvent) {
    e.preventDefault()
    setSavingApi(true)
    try {
      const next = await api<PublicSettings>("/api/admin/settings", { method: "PUT", body: { leaseweb: leasewebBody() } })
      setSettings(next)
      setApiKey("")
      toast.success("Leaseweb API settings saved")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSavingApi(false)
    }
  }

  async function removeKey() {
    setSavingApi(true)
    try {
      const next = await api<PublicSettings>("/api/admin/settings", { method: "PUT", body: { leaseweb: leasewebBody("") } })
      setSettings(next)
      setApiKey("")
      toast.success("API key removed")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSavingApi(false)
    }
  }

  async function test(kind: "api" | "proxy") {
    const setBusy = kind === "api" ? setTestingApi : setTestingProxy
    const setResult = kind === "api" ? setApiResult : setProxyResult
    setBusy(true)
    setResult(null)
    try {
      setResult(
        await api<TestResult>("/api/admin/settings/test", {
          method: "POST",
          body: { leaseweb: leasewebBody(), proxy: proxyBody() },
        })
      )
    } catch (err) {
      setResult({ ok: false, message: errorMessage(err), ms: 0, viaProxy: enabled })
    } finally {
      setBusy(false)
    }
  }

  async function saveProxy(e: React.FormEvent) {
    e.preventDefault()
    setSavingProxy(true)
    try {
      const next = await api<PublicSettings>("/api/admin/settings", { method: "PUT", body: { proxy: proxyBody() } })
      setSettings(next)
      setPassword("")
      setClearPassword(false)
      toast.success(enabled ? "Proxy saved. All Leaseweb traffic now goes through it." : "Proxy saved and turned off")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSavingProxy(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="How Leaseweb Dock talks to the Leaseweb API." />
      <Board>
        <Tile className="col-span-12 lg:col-span-6 lg:p-8">
          <form method="post" onSubmit={saveApi}>
            <h2 className="display text-3xl">Leaseweb API</h2>
            <p className="prose-serif mt-2 text-base text-muted-foreground">
              Create a key in the Leaseweb Customer Portal under API keys. It is stored encrypted and never shown again.
            </p>
            <FieldGroup className="mt-6">
              <Field>
                <FieldLabel htmlFor="api-key">API key</FieldLabel>
                <Input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={settings.leaseweb.configured ? `Saved (${settings.leaseweb.apiKeyHint}). Leave empty to keep it.` : "Paste the key"}
                  className="h-10 bg-background"
                />
                {settings.leaseweb.unreadable ? (
                  <FieldDescription className="text-destructive">
                    The saved key cannot be decrypted (APP_SECRET changed?). Paste it again.
                  </FieldDescription>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="base-url">API address</FieldLabel>
                <Input id="base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="h-10 bg-background" />
                <FieldDescription>Leave as {DEFAULT_BASE_URL} unless Leaseweb told you otherwise.</FieldDescription>
              </Field>
              <TestNote result={apiResult} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={savingApi}>
                  {savingApi ? <Spinner /> : null} Save
                </Button>
                <Button type="button" variant="secondary" onClick={() => test("api")} disabled={testingApi}>
                  {testingApi ? <Spinner /> : <PlugsConnectedIcon />} Test connection
                </Button>
                {settings.leaseweb.configured ? (
                  <Button type="button" variant="ghost" onClick={removeKey} disabled={savingApi}>
                    Remove key
                  </Button>
                ) : null}
              </div>
            </FieldGroup>
          </form>
        </Tile>

        <Tile tone="tile" className="col-span-12 lg:col-span-6 lg:p-8">
          <form method="post" onSubmit={saveProxy}>
            <div className="flex items-start justify-between gap-4">
              <h2 className="display text-3xl">Outbound proxy</h2>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Use a proxy" />
            </div>
            <p className="prose-serif mt-2 text-base text-muted-foreground">
              When this is on, every request to Leaseweb goes through the proxy and only through it. If the proxy is
              down, requests fail instead of going direct.
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
                    placeholder={settings.proxy.hasPassword ? "Saved. Leave empty to keep." : "Optional"}
                    autoComplete="new-password"
                    className="bg-background"
                  />
                </Field>
              </div>
              {settings.proxy.hasPassword ? (
                <Field orientation="horizontal">
                  <Switch id="proxy-clear" checked={clearPassword} onCheckedChange={setClearPassword} />
                  <FieldLabel htmlFor="proxy-clear">Remove the saved password</FieldLabel>
                </Field>
              ) : null}
              <TestNote result={proxyResult} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={savingProxy}>
                  {savingProxy ? <Spinner /> : null} Save
                </Button>
                <Button type="button" variant="secondary" onClick={() => test("proxy")} disabled={testingProxy}>
                  {testingProxy ? <Spinner /> : <PlugsConnectedIcon />} {enabled ? "Test through proxy" : "Test direct"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </Tile>
      </Board>
    </>
  )
}
