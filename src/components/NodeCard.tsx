import { useMemo } from 'react'
import { memo } from 'react'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import { Flag } from './Flag'
import { bytes, uptime } from '../utils/format'
import { cpuLabel, deriveUsage, displayName, distroLogo, osLabel, virtLabel } from '../utils/derive'
import { ispColor, shortCron } from '../utils/tcpping'
import type { Node } from '../types'

function barColor(v: number) {
  if (v >= 90) return '#ef4444'
  if (v >= 50) return '#f97316'
  return 'hsl(var(--foreground) / 0.4)'
}

function UsageBar({ value, label, detail }: { value: number | undefined; label: string; detail: string }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {label}
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {detail}
        </span>
      </div>
      <div className="h-0.5" style={{ background: 'hsl(var(--secondary))' }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor(pct) }}
        />
      </div>
    </div>
  )
}

function MiniChart({
  data,
  dataKeys,
  colors,
  legend,
  formatter,
}: {
  data: Record<string, string | number>[]
  dataKeys: string[]
  colors: string[]
  legend: { key: string; value: string }[]
  formatter?: (value: number, name: string) => [string, string]
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3 mb-1">
        {legend.map((item, i) => (
          <span key={item.key} className="text-[10px] flex items-center gap-1"
            style={{ color: 'hsl(var(--muted-foreground))' }}>
            <span className="w-2 h-0.5" style={{ backgroundColor: colors[i] }} />
            {item.value}
          </span>
        ))}
      </div>
      <div className="h-10 w-full overflow-visible">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              {dataKeys.map((key, i) => (
                <linearGradient key={key} id={`gradient-${key}-${data[0]?.time}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[i]} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={colors[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '4px',
                fontSize: '10px',
                padding: '4px 8px',
                color: 'hsl(var(--card-foreground))',
              }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
              itemStyle={{ color: 'hsl(var(--card-foreground))', fontSize: '10px' }}
              wrapperStyle={{ zIndex: 9999 }}
              allowEscapeViewBox={{ x: true, y: true }}
              formatter={formatter}
            />
            {dataKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i]}
                strokeWidth={1}
                fill={`url(#gradient-${key}-${data[0]?.time})`}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export const NodeCard = memo(function NodeCard({ node }: { node: Node }) {
  const u = deriveUsage(node)
  const os = osLabel(node)
  const cpu = cpuLabel(node)
  const logo = distroLogo(node)
  const virt = virtLabel(node)
  const memDetail = u.memTotal ? `${bytes(u.memUsed)} / ${bytes(u.memTotal)}` : '—'
  const diskDetail = u.diskTotal ? `${bytes(u.diskUsed)} / ${bytes(u.diskTotal)}` : '—'

  const networkData = useMemo(
    () => node.history.map(h => ({
      time: new Date(h.t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      in: Math.round((h.netIn ?? 0) / 1024),
      out: Math.round((h.netOut ?? 0) / 1024),
    })),
    [node.history],
  )

  const cronNames = useMemo(
    () => [...new Set(node.tcpPings.map(p => p.cron))].sort(),
    [node.tcpPings],
  )

  const pingData = useMemo(() => {
    if (!cronNames.length) return []
    const BUCKET = 30_000
    const snap = (t: number) => Math.round(t / BUCKET) * BUCKET
    const acc = new Map<number, Map<string, number[]>>()
    for (const p of node.tcpPings) {
      if (p.latency == null) continue
      const bt = snap(p.t)
      if (!acc.has(bt)) acc.set(bt, new Map())
      const m = acc.get(bt)!
      const arr = m.get(p.cron) ?? []
      arr.push(p.latency)
      m.set(p.cron, arr)
    }
    const rows = [...acc.entries()]
      .sort(([a], [b]) => a - b)
      .map(([t, m]) => {
        const row: Record<string, string | number> = {
          time: new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        }
        for (const cron of cronNames) {
          const vals = m.get(cron)
          if (vals?.length) row[cron] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
        }
        return row
      })

    // 3 点移动平均，滤掉毛刺
    return rows.map((row, i) => {
      const smoothed: Record<string, string | number> = { time: row.time }
      for (const cron of cronNames) {
        const prev = i > 0 ? (rows[i - 1][cron] as number | undefined) : undefined
        const cur  = row[cron] as number | undefined
        const next = i < rows.length - 1 ? (rows[i + 1][cron] as number | undefined) : undefined
        const pts  = [prev, cur, next].filter((v): v is number => v != null)
        if (pts.length) smoothed[cron] = Math.round(pts.reduce((s, v) => s + v, 0) / pts.length)
      }
      return smoothed
    })
  }, [node.tcpPings, cronNames])

  const hasNetwork = networkData.length >= 2
  const hasPing = pingData.length >= 2 && cronNames.length > 0

  const lastPing = pingData[pingData.length - 1]

  return (
    <a href={`#${encodeURIComponent(node.uuid)}`} className="block group relative border hover:border-border transition-colors cursor-pointer"
      style={{
        borderColor: 'hsl(var(--border) / 0.5)',
        background: 'hsl(var(--card) / 0.7)',
      }}>

      {/* 顶部状态线 */}
      <div className={`h-0.5 ${node.online ? 'bg-emerald-500' : 'bg-red-500'}`} />

      <div className="p-4">
        {/* 头部：名称 + OS/virt + uptime */}
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-4">
            {logo && (
              <img src={logo} alt="" className="w-3.5 h-3.5 shrink-0 object-contain" loading="lazy" />
            )}
            {node.meta?.region && <Flag code={node.meta.region} />}
            <span className="font-medium text-sm shrink-0"
              style={{ color: 'hsl(var(--nx-text-primary))' }}
              title={displayName(node)}>
              {displayName(node)}
            </span>
            {(os || virt) && (
              <span className="text-[10px] font-mono truncate"
                style={{ color: 'hsl(var(--muted-foreground))' }}>
                {[os, virt].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-light font-mono leading-none"
              style={{ color: 'hsl(var(--nx-text-primary))' }}>
              {node.online ? (uptime(u.uptime) || '—') : '离线'}
            </div>
            <div className="text-[9px] uppercase tracking-wider mt-0.5"
              style={{ color: 'hsl(var(--muted-foreground))' }}>
              uptime
            </div>
          </div>
        </div>

        {/* CPU 型号 */}
        {cpu && (
          <div className="text-[10px] font-mono truncate mb-3"
            style={{ color: 'hsl(var(--muted-foreground) / 0.7)' }}>
            {cpu}
          </div>
        )}

        {/* 资源进度条 */}
        <div className="space-y-2 mb-4">
          <UsageBar
            value={u.cpu}
            label="CPU"
            detail={u.cpu != null ? `${u.cpu.toFixed(0)}%` : '—'}
          />
          <UsageBar value={u.mem} label="Memory" detail={memDetail} />
          <UsageBar value={u.disk} label="Disk" detail={diskDetail} />
        </div>

        {/* 图表：网络 + Ping 横排 */}
        {(hasNetwork || hasPing) && (
          <div className="flex gap-4 pt-3 border-t"
            style={{ borderColor: 'hsl(var(--border) / 0.5)' }}
            onClick={e => e.preventDefault()}>
            {hasNetwork && (
              <MiniChart
                data={networkData}
                dataKeys={['in', 'out']}
                colors={['#10b981', '#3b82f6']}
                legend={[
                  { key: 'in', value: `↓${bytes(u.netIn ?? 0)}/s` },
                  { key: 'out', value: `↑${bytes(u.netOut ?? 0)}/s` },
                ]}
                formatter={(v, name) => [
                  `${bytes(v * 1024)}/s`,
                  name === 'in' ? '↓ 下行' : '↑ 上行',
                ]}
              />
            )}
            {hasPing && (
              <MiniChart
                data={pingData}
                dataKeys={cronNames}
                colors={cronNames.map((c, i) => ispColor(c, i))}
                legend={cronNames.map((c, i) => ({
                  key: c,
                  value: lastPing?.[c] != null
                    ? `${shortCron(c)} ${(lastPing[c] as number)}ms`
                    : shortCron(c),
                }))}
                formatter={(v, name) => [`${v} ms`, shortCron(name)]}
              />
            )}
          </div>
        )}
      </div>

      {/* hover 扫描线 */}
      {node.online && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute inset-x-0 h-8 bg-gradient-to-b from-primary/5 to-transparent animate-scan" />
        </div>
      )}
    </a>
  )
}, (prev, next) =>
  prev.node.uuid === next.node.uuid &&
  prev.node.online === next.node.online &&
  prev.node.dynamic?.timestamp === next.node.dynamic?.timestamp &&
  prev.node.history === next.node.history &&
  prev.node.tcpPings === next.node.tcpPings,
)
