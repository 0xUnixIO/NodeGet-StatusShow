import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Map as MapIcon } from 'lucide-react'
import { bytes } from '../utils/format'
import type { Node } from '../types'

const UP = 'hsl(142 71% 45%)'
const DOWN = 'hsl(0 72% 56%)'

function Cell({
  label,
  children,
  accent,
  grid = false,
}: {
  label: string
  children: React.ReactNode
  accent?: string
  grid?: boolean
}) {
  return (
    <div
      className={grid ? 'px-3 py-2 border-b border-r' : 'px-2.5 sm:px-3 py-1.5 border-r min-w-[88px] sm:min-w-[110px] shrink-0'}
      style={{ borderColor: 'hsl(var(--border) / 0.4)' }}
    >
      <div
        className="text-[9px] font-bold uppercase tracking-[0.22em] mb-0.5"
        style={{ color: 'hsl(var(--nx-text-muted))' }}
      >
        {label}
      </div>
      <div
        className="text-[13px] font-bold tabular-nums leading-tight font-mono"
        style={{ color: accent ?? 'hsl(var(--nx-text-primary))' }}
      >
        {children}
      </div>
    </div>
  )
}

export function MarketStrip({
  nodes,
  onViewMap,
  embedded = false,
  showWorldMap = true,
}: {
  nodes: Node[]
  onViewMap?: () => void
  embedded?: boolean
  showWorldMap?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const stats = useMemo(() => {
    const total = nodes.length
    const online = nodes.filter(n => n.online).length
    const offline = total - online

    const netUp = nodes.reduce((s, n) => s + (n.dynamic?.transmit_speed ?? 0), 0)
    const netDown = nodes.reduce((s, n) => s + (n.dynamic?.receive_speed ?? 0), 0)
    const totalUp = nodes.reduce((s, n) => s + (n.dynamic?.total_transmitted ?? 0), 0)
    const totalDown = nodes.reduce((s, n) => s + (n.dynamic?.total_received ?? 0), 0)

    const onlineNodes = nodes.filter(n => n.online && n.dynamic)
    let cpuSum = 0
    let cpuCnt = 0
    let memUsed = 0
    let memTotal = 0
    const cpuVals: number[] = []
    for (const n of onlineNodes) {
      if (n.dynamic?.cpu_usage != null) {
        cpuSum += n.dynamic.cpu_usage
        cpuCnt++
        cpuVals.push(n.dynamic.cpu_usage)
      }
      memUsed += n.dynamic?.used_memory ?? 0
      memTotal += n.dynamic?.total_memory ?? 0
    }
    const avgCpu = cpuCnt ? cpuSum / cpuCnt : null
    const avgMem = memTotal ? (memUsed / memTotal) * 100 : null

    let vix: number | null = null
    if (cpuVals.length >= 2 && avgCpu != null) {
      const variance = cpuVals.reduce((s, v) => s + (v - avgCpu) ** 2, 0) / cpuVals.length
      vix = Math.sqrt(variance)
    }

    return { total, online, offline, netUp, netDown, totalUp, totalDown, avgCpu, avgMem, vix }
  }, [nodes])

  const cpuColor =
    stats.avgCpu == null ? undefined : stats.avgCpu >= 70 ? 'hsl(20 90% 60%)' : undefined
  const memColor =
    stats.avgMem == null ? undefined : stats.avgMem >= 80 ? 'hsl(20 90% 60%)' : undefined
  const vixColor =
    stats.vix == null ? undefined : stats.vix >= 25 ? DOWN : stats.vix >= 12 ? 'hsl(45 90% 55%)' : UP

  // 桌面端：横排
  const desktopStrip = (
    <div className="flex items-stretch overflow-x-auto scrollbar-none">
      <Cell label="Breadth">
        <span style={{ color: UP }}>{stats.online}</span>
        <span className="text-[11px] font-normal" style={{ color: 'hsl(var(--nx-text-dim))' }}>
          {' '}/ {stats.total}
        </span>
      </Cell>
      <Cell label="Down" accent={stats.offline > 0 ? DOWN : undefined}>▼ {stats.offline}</Cell>
      <Cell label="Index · CPU" accent={cpuColor}>
        {stats.avgCpu != null ? `${stats.avgCpu.toFixed(1)}%` : '—'}
      </Cell>
      <Cell label="Index · MEM" accent={memColor}>
        {stats.avgMem != null ? `${stats.avgMem.toFixed(1)}%` : '—'}
      </Cell>
      <Cell label="^VIX" accent={vixColor}>
        {stats.vix != null ? stats.vix.toFixed(1) : '—'}
      </Cell>
      <Cell label="Vol · TX" accent={DOWN}>
        <span className="inline-flex items-center gap-1"><ArrowUp className="h-3 w-3" />{bytes(stats.netUp)}/s</span>
      </Cell>
      <Cell label="Vol · RX" accent={UP}>
        <span className="inline-flex items-center gap-1"><ArrowDown className="h-3 w-3" />{bytes(stats.netDown)}/s</span>
      </Cell>
      <Cell label="Agg · TX">{bytes(stats.totalUp)}</Cell>
      <Cell label="Agg · RX">{bytes(stats.totalDown)}</Cell>
      {showWorldMap && onViewMap && (
        <button
          type="button"
          onClick={onViewMap}
          className="px-4 ml-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold transition-colors hover:bg-[hsl(var(--secondary))]"
          style={{ color: 'hsl(var(--nx-text-secondary))' }}
        >
          <MapIcon className="h-3.5 w-3.5" />
          World Map
        </button>
      )}
    </div>
  )

  // 手机端展开：只显示摘要行没有的指标（Down、VIX、MEM、Agg TX/RX）
  const mobileGrid = (
    <div className="grid grid-cols-3" style={{ borderTop: '1px solid hsl(var(--border) / 0.4)' }}>
      <Cell grid label="Down" accent={stats.offline > 0 ? DOWN : undefined}>▼ {stats.offline}</Cell>
      <Cell grid label="^VIX" accent={vixColor}>
        {stats.vix != null ? stats.vix.toFixed(1) : '—'}
      </Cell>
      <Cell grid label="Index · MEM" accent={memColor}>
        {stats.avgMem != null ? `${stats.avgMem.toFixed(1)}%` : '—'}
      </Cell>
      <Cell grid label="Agg · TX">{bytes(stats.totalUp)}</Cell>
      <Cell grid label="Agg · RX">{bytes(stats.totalDown)}</Cell>
    </div>
  )

  return (
    <div
      style={
        embedded
          ? undefined
          : {
              background: 'hsl(var(--card) / 0.65)',
              border: '1px solid hsl(var(--border) / 0.5)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }
      }
    >
      {/* 桌面端：完整横排 */}
      <div className="hidden sm:block">{desktopStrip}</div>

      {/* 手机端：精简一行 + 点击展开为网格 */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 font-mono"
        >
          <div className="flex items-center gap-3 text-[11px] tabular-nums">
            <span>
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 mb-px" style={{ background: UP }} />
              <span style={{ color: UP }}>{stats.online}</span>
              <span style={{ color: 'hsl(var(--nx-text-dim))' }}>/{stats.total}</span>
            </span>
            <span style={{ color: cpuColor ?? 'hsl(var(--nx-text-primary))' }}>
              CPU {stats.avgCpu != null ? `${stats.avgCpu.toFixed(1)}%` : '—'}
            </span>
            <span className="font-mono" style={{ color: 'hsl(var(--nx-text-secondary))' }}>
              <span style={{ color: DOWN }}>↑</span>{bytes(stats.netUp)}/s{' '}
              <span style={{ color: UP }}>↓</span>{bytes(stats.netDown)}/s
            </span>
          </div>
          <span style={{ color: 'hsl(var(--nx-text-muted))' }}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </button>

        {expanded && mobileGrid}
      </div>
    </div>
  )
}
