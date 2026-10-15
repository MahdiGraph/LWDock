"use client"

import * as React from "react"
import { CheckIcon, CopyIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { errorMessage } from "@/lib/client"
import { humanize } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Wraps a trigger with a confirmation dialog; keeps the dialog open while the action runs. */
export function ConfirmAction({
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  children,
  extra,
}: {
  title: string
  description: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => Promise<unknown> | unknown
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  return (
    <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="prose-serif text-[15px]">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {extra}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90")}
            onClick={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                await onConfirm()
                setOpen(false)
              } catch (err) {
                toast.error(errorMessage(err))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={className}
          aria-label={label}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setDone(true)
              setTimeout(() => setDone(false), 1500)
            } catch {
              toast.error("Copy failed. Select the text and copy it by hand.")
            }
          }}
        >
          {done ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{done ? "Copied" : label}</TooltipContent>
    </Tooltip>
  )
}

const GOOD = ["RUNNING", "ON", "OPEN", "FINISHED", "ACTIVE", "READY", "UP", "ENABLED", "COMPLETED", "DELIVERED"]
const BUSY = ["STARTING", "STOPPING", "CREATING", "PENDING", "WAITING", "INPROGRESS", "IN_PROGRESS", "DESTROYING", "REBOOTING"]
const BAD = ["FAILED", "CANCELED", "CANCELLED", "EXPIRED", "DESTROYED", "ERROR", "DOWN", "NULLROUTED"]

export function stateTone(state: string | null | undefined): "good" | "busy" | "bad" | "idle" {
  const s = (state ?? "").toUpperCase().replace(/\s+/g, "_")
  if (GOOD.includes(s)) return "good"
  if (BUSY.includes(s)) return "busy"
  if (BAD.includes(s)) return "bad"
  return "idle"
}

/** A state word next to a filled square marker. */
export function StateMark({ state, className, label }: { state: string | null | undefined; className?: string; label?: string }) {
  const tone = stateTone(state)
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0",
          tone === "good" && "bg-success",
          tone === "busy" && "bg-warning",
          tone === "bad" && "bg-destructive",
          tone === "idle" && "bg-muted-foreground/50"
        )}
      />
      {label ?? humanize(state)}
    </span>
  )
}

export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null
  return (
    <div className={cn("flex items-start gap-2 bg-destructive/10 p-3 text-sm text-destructive", className)} role="alert">
      <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
      <span>{errorMessage(error)}</span>
    </div>
  )
}

export function Loading({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 py-6 text-sm text-muted-foreground", className)}>
      <Spinner /> {label}
    </div>
  )
}

/** Runs an async action with a busy flag and toasts. */
export function useAction() {
  const [busy, setBusy] = React.useState<string | null>(null)
  const run = React.useCallback(async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key)
    try {
      const result = await fn()
      if (success) toast.success(success)
      return result
    } catch (e) {
      toast.error(errorMessage(e))
      return undefined
    } finally {
      setBusy(null)
    }
  }, [])
  return { busy, run }
}
