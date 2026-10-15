"use client"

import * as React from "react"
import { toast } from "sonner"
import { Board, Tile } from "@/components/board"
import { ConfirmAction, ErrorNote, Loading } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useCatalog } from "@/hooks/use-api"
import { lwCall } from "@/lib/client"
import { toBase64 } from "@/lib/format"
import type { ServerProps } from "./types"

type Named = { id: string; name: string }

function Aside({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Tile tone="tile" className="col-span-12 lg:col-span-4">
      <h3 className="display text-xl">{title}</h3>
      <div className="prose-serif mt-3 grid gap-3 text-[15px] text-muted-foreground">{children}</div>
    </Tile>
  )
}

/** Shared optional fields: SSH keys, password and a first-boot script. */
function ExtraFields({
  sshKeys,
  setSshKeys,
  password,
  setPassword,
  script,
  setScript,
  powerCycle,
  setPowerCycle,
  passwordHint,
}: {
  sshKeys: string
  setSshKeys: (v: string) => void
  password: string
  setPassword: (v: string) => void
  script: string
  setScript: (v: string) => void
  powerCycle: boolean
  setPowerCycle: (v: boolean) => void
  passwordHint: string
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="ssh-keys">SSH public keys</FieldLabel>
        <Textarea
          id="ssh-keys"
          value={sshKeys}
          onChange={(e) => setSshKeys(e.target.value)}
          placeholder="ssh-ed25519 AAAA… you@laptop"
          rows={3}
          className={/* taste-skill-ignore: SSH keys and scripts are code */ "bg-background font-mono text-[13px]"}
        />
        <FieldDescription>One key per line. Optional.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="root-password">Password</FieldLabel>
        <Input
          id="root-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave empty to have one generated"
          className="bg-background"
        />
        <FieldDescription>{passwordHint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="script">Script to run afterwards</FieldLabel>
        <Textarea
          id="script"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={"#!/bin/bash\napt-get update"}
          rows={4}
          className={/* taste-skill-ignore: SSH keys and scripts are code */ "bg-background font-mono text-[13px]"}
        />
        <FieldDescription>Optional bash script, run once when the system is ready.</FieldDescription>
      </Field>
      <Field orientation="horizontal">
        <Switch id="power-cycle" checked={powerCycle} onCheckedChange={setPowerCycle} />
        <FieldLabel htmlFor="power-cycle">Reboot the server automatically to start</FieldLabel>
      </Field>
    </>
  )
}

export function InstallOs({ kind, id, onStarted }: ServerProps & { onStarted: () => void }) {
  const os = useCatalog<{ operatingSystems: Named[] }>("bareMetals/v2/operatingSystems", { all: "operatingSystems" })
  const [osId, setOsId] = React.useState("")
  const panels = useCatalog<{ controlPanels: Named[] }>(
    osId ? `bareMetals/v2/operatingSystems/${encodeURIComponent(osId)}/controlPanels` : null,
    { all: "controlPanels" }
  )
  const [panel, setPanel] = React.useState("none")
  const [hostname, setHostname] = React.useState("")
  const [sshKeys, setSshKeys] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [script, setScript] = React.useState("")
  const [powerCycle, setPowerCycle] = React.useState(true)

  const osName = os.data?.operatingSystems.find((o) => o.id === osId)?.name ?? osId
  const list = [...(os.data?.operatingSystems ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  async function install() {
    const body: Record<string, unknown> = { operatingSystemId: osId, powerCycle }
    if (hostname.trim()) body.hostname = hostname.trim()
    if (panel !== "none") body.controlPanelId = panel
    if (sshKeys.trim()) body.sshKeys = sshKeys.trim()
    if (password) body.password = password
    if (script.trim()) body.postInstallScript = toBase64(script)
    await lwCall(kind, id, "POST", "install", body)
    toast.success("Installation started. Follow it under Jobs.")
    setPassword("")
    onStarted()
  }

  return (
    <Board>
      <Tile className="col-span-12 lg:col-span-8 lg:p-8">
        <h2 className="display text-3xl">Install an operating system</h2>
        <p className="prose-serif mt-2 max-w-2xl text-base text-muted-foreground">
          Wipes every disk and installs a fresh system with the default partitions.
        </p>
        <ErrorNote error={os.error} className="mt-4" />
        {os.isLoading ? (
          <Loading label="Loading operating systems…" />
        ) : (
          <FieldGroup className="mt-6 max-w-xl">
            <Field>
              <FieldLabel>Operating system</FieldLabel>
              <Select
                value={osId}
                onValueChange={(v) => {
                  setOsId(v)
                  setPanel("none")
                }}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {list.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {osId && (panels.data?.controlPanels.length ?? 0) > 0 ? (
              <Field>
                <FieldLabel>Control panel</FieldLabel>
                <Select value={panel} onValueChange={setPanel}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {panels.data!.controlPanels.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Some control panels need a license from Leaseweb.</FieldDescription>
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="hostname">Hostname</FieldLabel>
              <Input id="hostname" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="server1.example.com" className="bg-background" />
            </Field>
            <ExtraFields
              {...{ sshKeys, setSshKeys, password, setPassword, script, setScript, powerCycle, setPowerCycle }}
              passwordHint="The root (or Administrator) password. You find it under Credentials afterwards."
            />
            <div>
              <ConfirmAction
                title={`Erase and install ${osName}?`}
                description="Every disk in the server is wiped. There is no undo, and the server is offline until the job finishes."
                confirmLabel="Erase and install"
                destructive
                onConfirm={install}
              >
                <Button size="lg" disabled={!osId}>
                  Install
                </Button>
              </ConfirmAction>
            </div>
          </FieldGroup>
        )}
      </Tile>
      <Aside title="What happens">
        <p>Leaseweb boots the server into an installer, partitions the disks and installs the system. It usually takes 15 to 40 minutes.</p>
        <p>Progress is on the Jobs tab. When it finishes, the new password is under Credentials.</p>
        <p>Custom partitions and RAID layouts can be set in the Leaseweb portal.</p>
      </Aside>
    </Board>
  )
}

export function RescueMode({ kind, id, onStarted }: ServerProps & { onStarted: () => void }) {
  const images = useCatalog<{ rescueImages: Named[] }>("bareMetals/v2/rescueImages", { all: "rescueImages" })
  const [picked, setImageId] = React.useState("")
  const [sshKeys, setSshKeys] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [script, setScript] = React.useState("")
  const [powerCycle, setPowerCycle] = React.useState(true)

  // Default to GRML (Leaseweb's usual rescue system) until the user picks one.
  const list = images.data?.rescueImages ?? []
  const imageId = picked || (list.find((i) => /grml/i.test(i.id) || /grml/i.test(i.name)) ?? list[0])?.id || ""

  async function start() {
    const body: Record<string, unknown> = { rescueImageId: imageId, powerCycle }
    if (sshKeys.trim()) body.sshKeys = sshKeys.trim()
    if (password) body.password = password
    if (script.trim()) body.postInstallScript = toBase64(script)
    await lwCall(kind, id, "POST", "rescueMode", body)
    toast.success("Rescue mode is starting. Follow it under Jobs.")
    setPassword("")
    onStarted()
  }

  return (
    <Board>
      <Tile className="col-span-12 lg:col-span-8 lg:p-8">
        <h2 className="display text-3xl">Boot into rescue mode</h2>
        <p className="prose-serif mt-2 max-w-2xl text-base text-muted-foreground">
          Starts a small live system from the network so you can repair the installed one. Your disks are not touched.
        </p>
        <ErrorNote error={images.error} className="mt-4" />
        {images.isLoading ? (
          <Loading label="Loading rescue images…" />
        ) : (
          <FieldGroup className="mt-6 max-w-xl">
            <Field>
              <FieldLabel>Rescue image</FieldLabel>
              <Select value={imageId} onValueChange={setImageId}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <ExtraFields
              {...{ sshKeys, setSshKeys, password, setPassword, script, setScript, powerCycle, setPowerCycle }}
              passwordHint="The rescue system's root password. It shows up under Credentials as Rescue mode."
            />
            <div>
              <ConfirmAction
                title="Boot into rescue mode?"
                description="The server reboots into the rescue system. Anything running on it now stops."
                confirmLabel="Start rescue mode"
                onConfirm={start}
              >
                <Button size="lg" disabled={!imageId}>
                  Start rescue mode
                </Button>
              </ConfirmAction>
            </div>
          </FieldGroup>
        )}
      </Tile>
      <Aside title="Getting out again">
        <p>Rescue mode lasts until the next reboot. To return to your installed system, reboot the server from the Power tile.</p>
        <p>Log in over SSH as root to the server&apos;s main IP with the rescue password or your key.</p>
      </Aside>
    </Board>
  )
}
