import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Area, AreaChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Flag } from './Flag'
import { StatusDot } from './StatusDot'
import { UptimeBars } from './UptimeBars'
import { bytes, pct, relativeAge, uptime } from '../utils/format'
import { deriveUsage, displayName, distroLogo, osLabel, virtLabel } from '../utils/derive'
import { strokeColor } from '../utils/cn'
import { ispColor, shortCron } from '../utils/tcpping'
import type { HistorySample, Node, TcpPingRecord } from '../types'

const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  fontSize: 11,
}

interface Props {
  node: Node | null
  onClose: () => void
  showSource?: boolean
  fetchTcpHistory?: (uuid: string) => Promise<TcpPingRecord[]>
  fetchUptimeHistory?: (uuid: string) => Promise<HistorySample[]>
  inline?: boolean
}

export function NodeDetail({ node, onClose, showSource, fetchTcpHistory, fetchUptimeHistory, inline = false }: Props) {
  const [detailPings, setDetailPings] = useState<TcpPingRecord[] | null>(null)
  const [loadingPings, setLoadingPings] = useState(false)
  const [uptimeHistory, setUptimeHistory] = useState<HistorySample[]>([])

  useEffect(() => {
    if (!node || !fetchTcpHistory) { setDetailPings(null); setLoadingPings(false); return }
    setDetailPings(null)
    setLoadingPings(true)
    fetchTcpHistory(node.uuid)
      .then(r => { setDetailPings(r); setLoadingPings(false) })
      .catch(() => setLoadingPings(false))
  }, [node?.uuid, fetchTcpHistory])

  useEffect(() => {
    if (!node || !fetchUptimeHistory) { setUptimeHistory([]); return }
    setUptimeHistory([])
    fetchUptimeHistory(node.uuid)
      .then(r => setUptimeHistory(r))
      .catch(() => {})
  }, [node?.uuid, fetchUptimeHistory])

  useEffect(() => {
    if (!node || inline) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [node, onClose, inline])

  if (!node) return null

  const uptimeOnline = uptimeHistory.filter(s => s.online).length
  const uptimePct = uptimeHistory.length > 0 ? Math.round((uptimeOnline / uptimeHistory.length) * 100) : null
  const uptimePctColor =
    uptimePct === 100 ? 'hsl(142 76% 58%)' :
    uptimePct !== null && uptimePct < 80 ? 'hsl(351 83% 61%)' :
    'hsl(45 95% 60%)'

  const u = deriveUsage(node)
  const d = node.dynamic
  const s = node.static?.system
  const cpu = node.static?.cpu
  const tags = node.meta?.tags ?? []
  const virt = virtLabel(node)
  const logo = distroLogo(node)
  const swap =
    d?.total_swap && d.used_swap != null ? (d.used_swap / d.total_swap) * 100 : undefined
  const loadAvg =
    d?.load_one != null && d?.load_five != null && d?.load_fifteen != null
      ? `${d.load_one.toFixed(2)} / ${d.load_five.toFixed(2)} / ${d.load_fifteen.toFixed(2)}`
      : null
  const history = node.history || []

  return (
    <div
      className={
        inline
          ? 'h-full overflow-y-auto bg-background'
          : 'fixed inset-0 z-50 bg-background overflow-y-auto animate-in fade-in duration-150'
      }
    >
      <div className={inline ? 'sticky top-0 z-10 backdrop-blur bg-background/85 border-b' : 'sticky top-0 z-10 backdrop-blur bg-background/85 border-b'}>
        <div className={inline ? 'px-3 py-2 flex flex-wrap items-center gap-2' : 'max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2 sm:gap-3'}>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <StatusDot online={node.online} />
          {logo && (
            <img src={logo} alt="" className="w-5 h-5 shrink-0 object-contain" loading="lazy" />
          )}
          <span className="font-semibold truncate min-w-0">{displayName(node)}</span>
          <Flag code={node.meta?.region} className="shrink-0" />
          <div className="ml-auto flex flex-wrap gap-1.5 shrink-0">
            {node.meta?.region && <Badge variant="secondary">{node.meta.region}</Badge>}
            {showSource && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {node.source}
              </Badge>
            )}
            {virt && <Badge variant="secondary">{virt}</Badge>}
            {tags.map(t => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className={inline ? 'px-3 py-4 space-y-6' : 'max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8'}>
        <Section title="资源">
          <div className="flex flex-wrap justify-around gap-4 sm:gap-6">
            <Ring label="CPU" value={u.cpu} sub={loadAvg ?? undefined} />
            <Ring
              label="内存"
              value={u.mem}
              sub={u.memTotal ? `${bytes(u.memUsed)} / ${bytes(u.memTotal)}` : undefined}
            />
            <Ring
              label="磁盘"
              value={u.disk}
              sub={u.diskTotal ? `${bytes(u.diskUsed)} / ${bytes(u.diskTotal)}` : undefined}
            />
            {swap != null && (
              <Ring
                label="Swap"
                value={swap}
                sub={`${bytes(d?.used_swap)} / ${bytes(d?.total_swap)}`}
              />
            )}
          </div>
        </Section>

        <Section
          title="在线状态"
          action={
            uptimePct !== null ? (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-muted-foreground">24h</span>
                <span className="font-semibold tabular-nums" style={{ color: uptimePctColor }}>
                  {uptimePct}%
                </span>
              </div>
            ) : undefined
          }
        >
          <UptimeBars history={uptimeHistory} online={node.online} barHeight="h-2.5" hidePct className="px-1" />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-1">
            <span>24h 前</span>
            <span>现在</span>
          </div>
        </Section>

        {history.length > 1 && (
          <Section title={`近 ${history.length * 2} 秒趋势`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Spark
                data={history}
                dataKey="cpu"
                label="CPU %"
                stroke="#3b82f6"
                domain={[0, 100]}
                format={pct}
              />
              <Spark
                data={history}
                dataKey="mem"
                label="内存 %"
                stroke="#10b981"
                domain={[0, 100]}
                format={pct}
              />
              <Spark
                data={history}
                dataKey="netIn"
                label="下行 RX"
                stroke="hsl(142 71% 45%)"
                format={v => `${bytes(v)}/s`}
              />
              <Spark
                data={history}
                dataKey="netOut"
                label="上行 TX"
                stroke="hsl(0 72% 56%)"
                format={v => `${bytes(v)}/s`}
              />
            </div>
          </Section>
        )}

        {(loadingPings || (detailPings && detailPings.length > 0)) && (
          <TcpPingChart pings={detailPings ?? []} loading={loadingPings} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Section title="系统">
            <KV k="主机名" v={s?.system_host_name} />
            <KV k="操作系统" v={osLabel(node)} />
            <KV k="内核" v={s?.system_kernel || s?.system_kernel_version} />
            <KV k="CPU 架构" v={s?.arch || s?.cpu_arch} />
            <KV k="虚拟化" v={virt} />
            <KV k="CPU 型号" v={cpu?.brand || cpu?.per_core?.[0]?.brand} />
            <KV
              k="核心"
              v={
                cpu?.physical_cores != null
                  ? `${cpu.physical_cores} 物理 / ${cpu.logical_cores} 逻辑`
                  : cpu?.per_core?.length
                    ? `${cpu.per_core.length} 核`
                    : null
              }
            />
          </Section>

          <Section title="网络与负载">
            <KV k="累计接收" v={d?.total_received != null ? bytes(d.total_received) : null} />
            <KV k="累计发送" v={d?.total_transmitted != null ? bytes(d.total_transmitted) : null} />
            <KV k="磁盘读" v={d?.read_speed != null ? `${bytes(d.read_speed)}/s` : null} />
            <KV k="磁盘写" v={d?.write_speed != null ? `${bytes(d.write_speed)}/s` : null} />
            <KV k="进程数" v={d?.process_count} />
            <KV
              k="TCP / UDP"
              v={
                d?.tcp_connections != null || d?.udp_connections != null
                  ? `${d?.tcp_connections ?? '—'} / ${d?.udp_connections ?? '—'}`
                  : null
              }
            />
            <KV k="运行时长" v={uptime(d?.uptime)} />
            <KV k="数据更新" v={relativeAge(d?.timestamp)} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card
      className="p-4"
      style={{
        background: 'hsl(var(--card) / 0.6)',
        borderColor: 'hsl(var(--border) / 0.6)',
      }}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: 'hsl(var(--border) / 0.4)' }}>
        <div
          className="text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: 'hsl(var(--nx-text-muted))' }}
        >
          {title}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  if (v == null || v === '') return null
  return (
    <div className="flex justify-between gap-3 text-xs py-1 border-b last:border-b-0" style={{ borderColor: 'hsl(var(--border) / 0.25)' }}>
      <span
        className="uppercase tracking-[0.15em] text-[10px] font-semibold"
        style={{ color: 'hsl(var(--nx-text-muted))' }}
      >
        {k}
      </span>
      <span className="font-mono text-right truncate tabular-nums">{v}</span>
    </div>
  )
}

function Ring({ label, value, sub }: { label: string; value?: number; sub?: string }) {
  const r = 40
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value ?? 0))
  const hasValue = Number.isFinite(value)

  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      <div className="relative w-24 h-24 sm:w-28 sm:h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50" cy="50" r={r}
            fill="none" strokeWidth={8}
            className="stroke-secondary"
          />
          {hasValue && (
            <circle
              cx="50" cy="50" r={r}
              fill="none" strokeWidth={8}
              className={strokeColor(value)}
              strokeDasharray={c}
              strokeDashoffset={c - (c * v) / 100}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 400ms ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-base sm:text-lg font-bold font-mono tabular-nums">
          {pct(value)}
        </div>
      </div>
      <div
        className="text-[10px] font-bold uppercase tracking-[0.2em]"
        style={{ color: 'hsl(var(--nx-text-secondary))' }}
      >
        {label}
      </div>
      {sub && (
        <div className="text-[10px] font-mono tabular-nums text-muted-foreground truncate max-w-full" title={sub}>
          {sub}
        </div>
      )}
    </div>
  )
}

interface SparkProps {
  data: HistorySample[]
  dataKey: keyof HistorySample
  label: string
  stroke: string
  domain?: [number, number]
  format: (v: number) => string
}

function applyEwma(
  data: ReturnType<typeof buildLatencyData>,
  cronNames: string[],
  alpha: number,
): ReturnType<typeof buildLatencyData> {
  const last: Record<string, number | null> = Object.fromEntries(cronNames.map(c => [c, null]))
  return data.map(point => {
    const out: Record<string, unknown> = { t: point.t }
    for (const cron of cronNames) {
      const raw = point[cron] as number | null
      if (raw == null) {
        out[cron] = null
      } else if (last[cron] == null) {
        out[cron] = raw
        last[cron] = raw
      } else {
        const v = alpha * raw + (1 - alpha) * last[cron]!
        out[cron] = v
        last[cron] = v
      }
    }
    return out as ReturnType<typeof buildLatencyData>[number]
  })
}

function buildLatencyData(pings: TcpPingRecord[], cronNames: string[]) {
  const BUCKET = 30_000
  const snap = (t: number) => Math.round(t / BUCKET) * BUCKET
  // 每个桶内按 ISP 累积成功延迟，最终取均值
  const acc = new Map<number, Map<string, number[]>>()
  for (const p of pings) {
    if (p.latency == null) continue
    const t = snap(p.t)
    const m = acc.get(t) ?? new Map<string, number[]>()
    if (!acc.has(t)) acc.set(t, m)
    const arr = m.get(p.cron) ?? []
    arr.push(p.latency)
    m.set(p.cron, arr)
  }
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, m]) => ({
      t,
      ...Object.fromEntries(
        cronNames.map(c => {
          const vals = m.get(c)
          return [c, vals?.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null]
        })
      ),
    }))
}

function ispStats(pings: TcpPingRecord[], cron: string) {
  const records = pings.filter(p => p.cron === cron)
  const vals = records.filter(p => p.latency != null).map(p => p.latency as number)
  const lossRate = records.length > 0 ? ((records.length - vals.length) / records.length) * 100 : 0
  const avg = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  const jitter = vals.length >= 2
    ? vals.slice(1).reduce((s, v, i) => s + Math.abs(v - vals[i]!), 0) / (vals.length - 1)
    : null
  return { avg, jitter, lossRate }
}

function TcpPingChart({ pings, loading }: { pings: TcpPingRecord[]; loading?: boolean }) {
  const cronNames = useMemo(() => [...new Set(pings.map(p => p.cron))].sort(), [pings])
  const rawData = useMemo(() => buildLatencyData(pings, cronNames), [pings, cronNames])
  const [smooth, setSmooth] = useState(true)
  const data = useMemo(
    () => smooth ? applyEwma(rawData, cronNames, 0.2) : rawData,
    [smooth, rawData, cronNames],
  )
  const stats = useMemo(
    () => Object.fromEntries(cronNames.map(c => [c, ispStats(pings, c)])),
    [pings, cronNames],
  )
  return (
    <Section
      title={loading ? 'TCP Ping 延迟  加载中…' : 'TCP Ping 延迟'}
      action={
        <button
          onClick={() => setSmooth(v => !v)}
          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
            smooth
              ? 'bg-primary text-primary-foreground border-primary'
              : 'text-muted-foreground border-border hover:border-primary/50'
          }`}
        >
          平滑
        </button>
      }
    >
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="t"
              hide
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
            />
            <YAxis
              unit=" ms"
              width={52}
              stroke="#9ca3af"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              domain={(['auto', 'auto'] as const)}
              padding={{ top: 16, bottom: 16 }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={t => new Date(t as number).toLocaleTimeString()}
              formatter={(v: unknown, name: string) =>
                v == null ? ['超时', shortCron(name)] : [`${(v as number).toFixed(1)} ms`, shortCron(name)]
              }
            />
            <Legend
              formatter={(v: string) => shortCron(v)}
              wrapperStyle={{ fontSize: 12 }}
            />
            {cronNames.map((cron, i) => (
              <Line
                key={cron}
                type="monotone"
                dataKey={cron}
                name={cron}
                stroke={ispColor(cron, i)}
                strokeWidth={1.5}
                dot={false}
                connectNulls={true}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid gap-3 text-xs font-mono" style={{ gridTemplateColumns: `repeat(${cronNames.length}, 1fr)` }}>
        {cronNames.map((cron, i) => {
          const { avg, jitter, lossRate } = stats[cron]!
          return (
            <div key={cron} className="space-y-0.5">
              <div className="font-semibold mb-1" style={{ color: ispColor(cron, i) }}>{shortCron(cron)}</div>
              <div className="text-muted-foreground">均值 <span className="text-foreground">{avg != null ? `${avg.toFixed(1)} ms` : '—'}</span></div>
              <div className="text-muted-foreground">抖动 <span className="text-foreground">{jitter != null ? `${jitter.toFixed(1)} ms` : '—'}</span></div>
              <div className="text-muted-foreground">丢包 <span className={lossRate > 0 ? 'text-red-500' : 'text-foreground'}>{lossRate.toFixed(1)}%</span></div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function Spark({ data, dataKey, label, stroke, domain, format }: SparkProps) {
  const last = Number(data.at(-1)?.[dataKey] ?? 0)
  const id = `g-${dataKey}`
  return (
    <div
      className="p-2"
      style={{
        background: 'hsl(var(--card) / 0.5)',
        border: '1px solid hsl(var(--border) / 0.5)',
      }}
    >
      <div className="flex justify-between items-baseline mb-1">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{ color: 'hsl(var(--nx-text-muted))' }}
        >
          {label}
        </span>
        <span className="font-mono tabular-nums text-[11px] font-bold" style={{ color: stroke }}>
          {format(last)}
        </span>
      </div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={domain ?? ['auto', 'auto']} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={t => new Date(t).toLocaleTimeString()}
              formatter={(v: number) => [format(v), label]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={1.5}
              fill={`url(#${id})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
