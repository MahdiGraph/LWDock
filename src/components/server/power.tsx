"use client"

import { ArrowClockwiseIcon, MonitorIcon, PlayIcon, PowerIcon, StopIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Tile, TileLabel } from "@/components/board"
import { ConfirmAction, StateMark, useAction } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useLw } from "@/hooks/use-api"
import { api, errorMessage, lwCall, lwUrl } from "@/lib/client"
import { get, TRANSITIONAL, type Dict, type ServerProps } from "./types"

type PowerInfo = { ipmi?: { status?: string }; pdu?: { status?: string } }

export function PowerTile(props: ServerProps & { raw: Dict; onChanged: () => void; className?: string }) {
  return props.kind === "dedicated" ? <DedicatedPower {...props} /> : <CloudPower {...props} />
}

function DedicatedPower({ kind, id, raw, className }: ServerProps & { raw: Dict; className?: string }) {
  const power = useLw<PowerInfo>(kind, id, "powerInfo", undefined, { refreshInterval: 30_000 })
  const { busy, run } = useAction()
  const state = power.data?.ipmi?.status ?? power.data?.pdu?.status ?? null
  const canCycle = get<boolean>(raw, "featureAvailability.powerCycle") !== false

  const act = (sub: string, message: string) =>
    run(
      sub,
      async () => {
        await lwCall(kind, id, "POST", sub)
        setTimeout(() => power.mutate(), 8000)
      },
      message
    )

  return (
    <Tile className={`flex flex-col justify-between gap-6 ${className ?? ""}`}>
      <TileLabel>Power</TileLabel>
      <div>
        {power.isLoading && !power.data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Checking…
          </p>
        ) : power.error ? (
          <p className="text-sm text-muted-foreground">Unknown ({power.error.message})</p>
        ) : (
          <StateMark state={state} className="display text-3xl [&>span:first-child]:size-3.5" />
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <ConfirmAction
            title="Reboot the server?"
            description="This cuts the power and turns it back on (a hard reboot). Unsaved work on the server is lost."
            confirmLabel="Reboot"
            onConfirm={() => act("powerCycle", "Reboot sent")}
          >
            <Button disabled={!canCycle || !!busy}>
              {busy === "powerCycle" ? <Spinner /> : <ArrowClockwiseIcon />} Reboot
            </Button>
          </ConfirmAction>
          {state?.toLowerCase() === "off" ? (
            <Button variant="secondary" disabled={!!busy} onClick={() => act("powerOn", "Power on sent")}>
              {busy === "powerOn" ? <Spinner /> : <PlayIcon />} Power on
            </Button>
          ) : (
            <ConfirmAction
              title="Power off the server?"
              description="The server stays off until someone powers it on again."
              confirmLabel="Power off"
              destructive
              onConfirm={() => act("powerOff", "Power off sent")}
            >
              <Button variant="secondary" disabled={!!busy}>
                {busy === "powerOff" ? <Spinner /> : <PowerIcon />} Power off
              </Button>
            </ConfirmAction>
          )}
        </div>
      </div>
    </Tile>
  )
}

function CloudPower({ kind, id, raw, onChanged, className }: ServerProps & { raw: Dict; onChanged: () => void; className?: string }) {
  const { busy, run } = useAction()
  const state = String(raw.state ?? "UNKNOWN")
  const running = state === "RUNNING"
  const moving = TRANSITIONAL.includes(state)

  const act = (sub: string, message: string) =>
    run(
      sub,
      async () => {
        await lwCall(kind, id, "POST", sub)
        onChanged()
      },
      message
    )

  async function openConsole() {
    // Open the tab inside the click so pop-up blockers allow it, then point it at the console.
    const win = window.open("about:blank", "_blank")
    try {
      const res = await api<{ url?: string }>(lwUrl(kind, id, "console"))
      if (!res.url) throw new Error("Leaseweb returned no console address.")
      if (win) {
        win.opener = null
        win.location.href = res.url
      } else {
        window.location.href = res.url
      }
    } catch (e) {
      win?.close()
      toast.error(errorMessage(e))
    }
  }

  return (
    <Tile className={`flex flex-col justify-between gap-6 ${className ?? ""}`}>
      <TileLabel>State</TileLabel>
      <div>
        <StateMark state={state} className="display text-3xl [&>span:first-child]:size-3.5" />
        <div className="mt-5 flex flex-wrap gap-2">
          {running ? (
            <ConfirmAction
              title="Reboot?"
              description="The machine restarts. Unsaved work on it is lost."
              confirmLabel="Reboot"
              onConfirm={() => act("reboot", "Reboot sent")}
            >
              <Button disabled={!!busy || moving}>
                {busy === "reboot" ? <Spinner /> : <ArrowClockwiseIcon />} Reboot
              </Button>
            </ConfirmAction>
          ) : (
            <Button disabled={!!busy || moving} onClick={() => act("start", "Start sent")}>
              {busy === "start" ? <Spinner /> : <PlayIcon />} Start
            </Button>
          )}
          {running ? (
            <ConfirmAction
              title="Stop?"
              description="The machine shuts down and stays off until you start it."
              confirmLabel="Stop"
              destructive
              onConfirm={() => act("stop", "Stop sent")}
            >
              <Button variant="secondary" disabled={!!busy || moving}>
                {busy === "stop" ? <Spinner /> : <StopIcon />} Stop
              </Button>
            </ConfirmAction>
          ) : null}
          <Button variant="secondary" onClick={openConsole}>
            <MonitorIcon /> Console
          </Button>
        </div>
      </div>
    </Tile>
  )
}
