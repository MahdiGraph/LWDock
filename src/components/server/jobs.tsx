"use client"

import { ArrowClockwiseIcon } from "@phosphor-icons/react"
import { Tile } from "@/components/board"
import { ConfirmAction, ErrorNote, Loading, StateMark, useAction } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useLw } from "@/hooks/use-api"
import { lwCall } from "@/lib/client"
import { formatDateTime, humanize, timeAgo } from "@/lib/format"
import type { ServerProps } from "./types"

type Task = { uuid?: string; description?: string; status?: string; errorMessage?: string }
type Job = {
  uuid: string
  type?: string
  status?: string
  isRunning?: boolean
  createdAt?: string
  updatedAt?: string
  progress?: { percentage?: number; total?: number; finished?: number }
  tasks?: Task[]
  currentTask?: { task?: Task }
}

const JOB_NAMES: Record<string, string> = {
  install: "Operating system install",
  rescueMode: "Rescue mode",
  hardwareScan: "Hardware scan",
  ipmiReset: "IPMI reset",
}

export function Jobs({ account, kind, id }: ServerProps) {
  const jobs = useLw<{ jobs: Job[] }>(account, kind, id, "jobs", { limit: 20 }, {
    refreshInterval: (d) => (d?.jobs?.some((j) => j.isRunning) ? 5000 : 0),
  })
  const { busy, run } = useAction()
  const list = [...(jobs.data?.jobs ?? [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const active = list.find((j) => j.isRunning)

  const call = (key: string, sub: string, message: string) =>
    run(key, async () => {
      await lwCall(account, kind, id, "POST", sub)
      await jobs.mutate()
    }, message)

  if (jobs.isLoading && !jobs.data) return <Loading />

  return (
    <div className="grid gap-2">
      <ErrorNote error={jobs.error} />
      {active ? (
        <Tile tone="primary" className="lg:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-sm opacity-80">Running now · started {timeAgo(active.createdAt)}</p>
              <p className="display mt-2 text-3xl md:text-4xl">{JOB_NAMES[active.type ?? ""] ?? humanize(active.type)}</p>
              <p className="mt-2 text-sm opacity-90">
                {active.currentTask?.task?.description ?? active.tasks?.find((t) => t.status === "INPROGRESS")?.description ?? "Working…"}
              </p>
            </div>
            <p className="display text-6xl tabular">{active.progress?.percentage ?? 0}%</p>
          </div>
          <div className="mt-6 h-3 bg-primary-foreground/20">
            <div className="h-3 bg-primary-foreground transition-[width]" style={{ width: `${active.progress?.percentage ?? 0}%` }} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <ConfirmAction
              title="Cancel the running job?"
              description="Leaseweb stops the job. The server may be left half-installed."
              confirmLabel="Cancel job"
              destructive
              onConfirm={() => call("cancel", "cancelActiveJob", "Job cancelled")}
            >
              <Button variant="secondary" disabled={!!busy}>
                Cancel job
              </Button>
            </ConfirmAction>
            <ConfirmAction
              title="Expire the running job?"
              description="Marks the job as expired without touching the server. Use it when a job is stuck."
              confirmLabel="Expire job"
              onConfirm={() => call("expire", "expireActiveJob", "Job expired")}
            >
              <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" disabled={!!busy}>
                Expire job
              </Button>
            </ConfirmAction>
          </div>
        </Tile>
      ) : null}

      {list.length === 0 ? (
        <Tile>
          <p className="prose-serif text-base text-muted-foreground">
            No jobs yet. Installs, rescue mode, hardware scans and IPMI resets show up here.
          </p>
        </Tile>
      ) : (
        <ul className="grid gap-2">
          {list.map((job) => (
            <li key={job.uuid} className="bg-card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-medium">{JOB_NAMES[job.type ?? ""] ?? humanize(job.type)}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {formatDateTime(job.createdAt)} · updated {timeAgo(job.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32">
                    <Progress value={job.progress?.percentage ?? 0} className="h-2" />
                  </div>
                  <StateMark state={job.isRunning ? "INPROGRESS" : job.status} label={humanize(job.status)} />
                  {!job.isRunning && ["FAILED", "CANCELED", "EXPIRED"].includes(String(job.status)) ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!!busy}
                      onClick={() => call(job.uuid, `jobs/${job.uuid}/retry`, "Job restarted")}
                    >
                      <ArrowClockwiseIcon /> Retry
                    </Button>
                  ) : null}
                </div>
              </div>
              {job.tasks?.length ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    {job.tasks.length} steps
                  </summary>
                  <ol className="mt-3 grid gap-1">
                    {job.tasks.map((t, i) => (
                      <li key={t.uuid ?? i} className="grid grid-cols-[1fr_auto] gap-4 bg-muted px-3 py-2 text-sm">
                        <span className="min-w-0">
                          {t.description ?? "Step"}
                          {t.errorMessage ? <span className="block text-[13px] text-destructive">{t.errorMessage}</span> : null}
                        </span>
                        <StateMark state={t.status} />
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
