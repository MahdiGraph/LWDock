"use client"

import * as React from "react"
import { Area, AreaChart, XAxis, YAxis } from "recharts"
import { Tile } from "@/components/board"
import { ErrorNote, Loading } from "@/components/common"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLw } from "@/hooks/use-api"
import { formatBits, formatBytes } from "@/lib/format"
import type { ServerProps } from "./types"

type Series = { unit?: string; values?: { timestamp: string; value: number }[] }
type MetricsResponse = { metrics?: Record<string, Series> }
type Row = { t: string } & Record<string, number | string>

const DAY = 24 * 3600 * 1000

function isoNoMs(ms: number) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")
}
function dateOnly(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Folds every series of a metrics response into rows keyed by timestamp. */
function toRows(metrics: Record<string, Series> | undefined, names: Record<string, string>): Row[] {
  const rows = new Map<string, Row>()
  for (const [key, series] of Object.entries(metrics ?? {})) {
    const name = names[key] ?? names[key.toLowerCase()]
    if (!name) continue
    for (const v of series?.values ?? []) {
      const row = rows.get(v.timestamp) ?? ({ t: v.timestamp } as Row)
      row[name] = Number(v.value)
      rows.set(v.timestamp, row)
    }
  }
  return [...rows.values()].sort((a, b) => a.t.localeCompare(b.t))
}

const trafficConfig = {
  down: { label: "In", color: "var(--chart-2)" },
  up: { label: "Out", color: "var(--chart-1)" },
} satisfies ChartConfig

const cpuConfig = { cpu: { label: "CPU", color: "var(--chart-1)" } } satisfies ChartConfig

function Chart({
  rows,
  config,
  format,
  long,
}: {
  rows: Row[]
  config: ChartConfig
  format: (v: number) => string
  long: boolean
}) {
  const tick = (t: string) => {
    const d = new Date(t)
    return long
      ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
      : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  }
  if (!rows.length) return <p className="prose-serif py-10 text-base text-muted-foreground">No data for this period.</p>
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <AreaChart data={rows} margin={{ left: 4, right: 4, top: 8 }}>
        <XAxis dataKey="t" tickFormatter={tick} tickLine={false} axisLine={false} minTickGap={40} tickMargin={8} />
        <YAxis tickFormatter={(v) => format(Number(v))} width={78} tickLine={false} axisLine={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const t = payload?.[0]?.payload?.t
                return t ? new Date(t).toLocaleString() : ""
              }}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-6">
                  <span className="text-muted-foreground">{config[String(name)]?.label ?? String(name)}</span>
                  <span className="font-medium tabular">{format(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        {Object.keys(config).map((key) => (
          <Area
            key={key}
            dataKey={key}
            type="monotone"
            stroke={`var(--color-${key})`}
            fill={`var(--color-${key})`}
            fillOpacity={0.18}
            strokeWidth={2}
            isAnimationActive={false}
          />
        ))}
        {Object.keys(config).length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
      </AreaChart>
    </ChartContainer>
  )
}

function RangeSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40 bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Panel({
  title,
  total,
  controls,
  children,
}: {
  title: string
  total?: React.ReactNode
  controls: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Tile className="lg:p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="display text-3xl">{title}</h2>
          {total ? <p className="mt-2 text-sm text-muted-foreground">{total}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">{controls}</div>
      </div>
      {children}
    </Tile>
  )
}

const BW_RANGES: Record<string, { ms: number; granularity: string }> = {
  "24h": { ms: DAY, granularity: "5MIN" },
  "7d": { ms: 7 * DAY, granularity: "HOUR" },
  "30d": { ms: 30 * DAY, granularity: "DAY" },
}

function DedicatedBandwidth({ account, kind, id }: ServerProps) {
  const [range, setRange] = React.useState("24h")
  const [aggregation, setAggregation] = React.useState("AVG")
  // Rounded to the minute so the request (and its cache key) is stable between renders.
  const [now] = React.useState(() => Math.floor(Date.now() / 60_000) * 60_000)
  const r = BW_RANGES[range]
  const data = useLw<MetricsResponse>(account, kind, id, "metrics/bandwidth", {
    from: isoNoMs(now - r.ms),
    to: isoNoMs(now),
    granularity: r.granularity,
    aggregation,
  })
  const rows = toRows(data.data?.metrics, { UP_PUBLIC: "up", DOWN_PUBLIC: "down" })
  return (
    <Panel
      title="Bandwidth"
      controls={
        <>
          <RangeSelect value={range} onChange={setRange} options={[["24h", "Last 24 hours"], ["7d", "Last 7 days"], ["30d", "Last 30 days"]]} />
          <RangeSelect value={aggregation} onChange={setAggregation} options={[["AVG", "Average"], ["95TH", "95th percentile"]]} />
        </>
      }
    >
      <ErrorNote error={data.error} />
      {data.isLoading && !data.data ? <Loading /> : <Chart rows={rows} config={trafficConfig} format={formatBits} long={range !== "24h"} />}
    </Panel>
  )
}

function TrafficTotal({ rows }: { rows: Row[] }) {
  const sum = (k: string) => rows.reduce((acc, r) => acc + (Number(r[k]) || 0), 0)
  if (!rows.length) return null
  return (
    <>
      In {formatBytes(sum("down"))} · Out {formatBytes(sum("up"))}
    </>
  )
}

function DedicatedTraffic({ account, kind, id }: ServerProps) {
  const [range, setRange] = React.useState("30d")
  const [now] = React.useState(() => Math.floor(Date.now() / 3_600_000) * 3_600_000)
  const months = range === "12m"
  const data = useLw<MetricsResponse>(account, kind, id, "metrics/datatraffic", {
    from: isoNoMs(now - (months ? 365 : 30) * DAY),
    to: isoNoMs(now),
    granularity: months ? "MONTH" : "DAY",
    aggregation: "SUM",
  })
  const rows = toRows(data.data?.metrics, { UP_PUBLIC: "up", DOWN_PUBLIC: "down" })
  return (
    <Panel
      title="Data traffic"
      total={<TrafficTotal rows={rows} />}
      controls={<RangeSelect value={range} onChange={setRange} options={[["30d", "Last 30 days"], ["12m", "Last 12 months"]]} />}
    >
      <ErrorNote error={data.error} />
      {data.isLoading && !data.data ? <Loading /> : <Chart rows={rows} config={trafficConfig} format={formatBytes} long />}
    </Panel>
  )
}

function CloudTraffic({ account, kind, id }: ServerProps) {
  const [range, setRange] = React.useState("30")
  const [now] = React.useState(() => Date.now())
  const data = useLw<MetricsResponse>(account, kind, id, "metrics/datatraffic", {
    from: dateOnly(now - Number(range) * DAY),
    to: dateOnly(now + DAY),
    granularity: "DAY",
    aggregation: "SUM",
  })
  const rows = toRows(data.data?.metrics, { upPublic: "up", downPublic: "down", UP_PUBLIC: "up", DOWN_PUBLIC: "down" })
  return (
    <Panel
      title="Data traffic"
      total={<TrafficTotal rows={rows} />}
      controls={<RangeSelect value={range} onChange={setRange} options={[["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"]]} />}
    >
      <ErrorNote error={data.error} />
      {data.isLoading && !data.data ? <Loading /> : <Chart rows={rows} config={trafficConfig} format={formatBytes} long />}
    </Panel>
  )
}

const CPU_RANGES: Record<string, { days: number; granularity: string }> = {
  "1": { days: 1, granularity: "5m" },
  "7": { days: 7, granularity: "60m" },
  "30": { days: 30, granularity: "DAY" },
}

function CloudCpu({ account, kind, id }: ServerProps) {
  const [range, setRange] = React.useState("1")
  const [now] = React.useState(() => Date.now())
  const r = CPU_RANGES[range]
  const data = useLw<MetricsResponse>(account, kind, id, "metrics/cpu", {
    from: dateOnly(now - r.days * DAY),
    to: dateOnly(now + DAY),
    granularity: r.granularity,
  })
  const rows = toRows(data.data?.metrics, { cpu: "cpu", cpuMetrics: "cpu", CPU: "cpu" })
  return (
    <Panel
      title="CPU"
      controls={<RangeSelect value={range} onChange={setRange} options={[["1", "Last day"], ["7", "Last 7 days"], ["30", "Last 30 days"]]} />}
    >
      <ErrorNote error={data.error} />
      {data.isLoading && !data.data ? (
        <Loading />
      ) : (
        <Chart rows={rows} config={cpuConfig} format={(v) => `${Number(v).toFixed(v < 10 ? 1 : 0)}%`} long={range !== "1"} />
      )}
    </Panel>
  )
}

export function Graphs(props: ServerProps) {
  if (props.kind === "dedicated") {
    return (
      <div className="grid gap-2">
        <DedicatedBandwidth {...props} />
        <DedicatedTraffic {...props} />
      </div>
    )
  }
  return (
    <div className="grid gap-2">
      {props.kind === "instance" ? <CloudCpu {...props} /> : null}
      <CloudTraffic {...props} />
    </div>
  )
}
