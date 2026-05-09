import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Flag } from './Flag'
import { deriveUsage, displayName } from '../utils/derive'
import { bytes } from '../utils/format'
import type { Node } from '../types'

// 涨跌色：上升绿、下降红（交易所习惯）
const UP = 'hsl(142 71% 45%)'
const DOWN = 'hsl(0 72% 56%)'
const FLAT = 'hsl(var(--nx-text-dim))'

function arrow(d: number | null) {
  if (d == null || Math.abs(d) < 0.05) return { sym: '–', color: FLAT }
  return d > 0 ? { sym: '▲', color: UP } : { sym: '▼', color: DOWN }
}

function fmtPct(v: number | null | undefined, digits = 1) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${v.toFixed(digits)}%`
}

function fmtDelta(v: number | null) {
  if (v == null || Number.isNaN(v)) return ''
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}`
}

/** 取 history 中 N 分钟前的值与最新值的差（以百分点） */
function deltaCpu(node: Node, minutes = 5): number | null {
  const h = node.history
  if (!h || h.length < 2) return null
  const now = h[h.length - 1]
  const tCutoff = now.t - minutes * 60_000
  // 找到最接近 cutoff 的早期样本
  let prev = h[0]
  for (const s of h) {
    if (s.t <= tCutoff) prev = s
    else break
  }
  if (prev.cpu == null || now.cpu == null) return null
  return now.cpu - prev.cpu
}

function deltaMem(node: Node, minutes = 5): number | null {
  const h = node.history
  if (!h || h.length < 2) return null
  const now = h[h.length - 1]
  const tCutoff = now.t - minutes * 60_000
  let prev = h[0]
  for (const s of h) {
    if (s.t <= tCutoff) prev = s
    else break
  }
  if (prev.mem == null || now.mem == null) return null
  return now.mem - prev.mem
}

/** 把 history 简化为定长归一化序列，用于 sparkline 路径 */
function sparkPath(values: number[], w: number, h: number): string {
  if (values.length < 2) return ''
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === max) {
    max = min + 1
  }
  const step = w / (values.length - 1)
  return values
    .map((v, i) => {
      const x = i * step
      const y = h - ((v - min) / (max - min)) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function Sparkline({ values, color, w = 64, h = 18 }: { values: number[]; color: string; w?: number; h?: number }) {
  const d = sparkPath(values, w, h)
  if (!d) return <div style={{ width: w, height: h }} />
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ======= 顶部 Ticker（横向跑马灯） =======

function TickerItem({ item, onSelect }: { item: { uuid: string; name: string; region?: string; cpu?: number; mem?: number; netIn?: number; netOut?: number; delta: number | null }; onSelect?: (uuid: string) => void }) {
  const a = arrow(item.delta)
  const prevCpu = useRef<number | undefined>(item.cpu)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (item.cpu == null) return
    const p = prevCpu.current
    if (p != null && Math.abs(item.cpu - p) >= 0.3) {
      setFlash(item.cpu > p ? 'up' : 'down')
      const t = setTimeout(() => setFlash(null), 600)
      prevCpu.current = item.cpu
      return () => clearTimeout(t)
    }
    prevCpu.current = item.cpu
  }, [item.cpu])

  const flashColor = flash === 'up' ? UP : flash === 'down' ? DOWN : null

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.uuid)}
      className="flex items-center gap-2 px-4 py-1 shrink-0 border-r font-mono transition-colors cursor-pointer appearance-none m-0 font-[inherit] text-inherit"
      style={{
        borderColor: 'hsl(var(--border) / 0.4)',
        background: flashColor ? `${flashColor}26` : 'transparent',
      }}
    >
      {item.region && <Flag code={item.region} />}
      <span className="text-[12px] font-bold tracking-wide uppercase" style={{ color: 'hsl(var(--nx-text-primary))' }}>
        {item.name}
      </span>
      <span
        className="tabular-nums text-[13px] font-bold px-1.5 py-0.5 rounded transition-colors"
        style={{
          color: flashColor ?? a.color,
          background: flashColor ? `${flashColor}33` : (a.color === FLAT ? 'transparent' : `${a.color}1a`),
          minWidth: 56,
          textAlign: 'center',
        }}
      >
        {fmtPct(item.cpu)}
      </span>
      <span className="tabular-nums text-[11px]" style={{ color: a.color }}>
        {a.sym} {fmtDelta(item.delta)}
      </span>
      <span className="tabular-nums text-[10px]" style={{ color: 'hsl(var(--nx-text-dim))' }}>
        MEM {fmtPct(item.mem, 0)}
      </span>
    </button>
  )
}

export const TradingTicker = memo(function TradingTicker({ nodes, embedded = false, onSelect }: { nodes: Node[]; embedded?: boolean; onSelect?: (uuid: string) => void }) {
  const items = useMemo(() => {
    return nodes
      .filter(n => n.online && n.dynamic)
      .map(n => {
        const u = deriveUsage(n)
        const dCpu = deltaCpu(n)
        return {
          uuid: n.uuid,
          name: displayName(n),
          region: n.meta?.region,
          cpu: u.cpu,
          mem: u.mem,
          netIn: u.netIn,
          netOut: u.netOut,
          delta: dCpu,
        }
      })
  }, [nodes])

  if (!items.length) return null

  // 重复一遍以无缝循环
  const loop = [...items, ...items]
  const duration = Math.max(30, items.length * 4.5)

  return (
    <div
      className="relative overflow-hidden flex-1 min-w-0"
      style={
        embedded
          ? { background: 'transparent' }
          : {
              background: 'linear-gradient(180deg, hsl(var(--card) / 0.7), hsl(var(--card) / 0.65))',
              borderTop: '1px solid hsl(var(--border) / 0.7)',
              borderBottom: '1px solid hsl(var(--border) / 0.7)',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.25)',
            }
      }
    >
      {/* 左右淡出蒙版，让滚动更具仪式感 */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-12 z-10"
        style={{ background: 'linear-gradient(to right, hsl(var(--card)), transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-12 z-10"
        style={{ background: 'linear-gradient(to left, hsl(var(--card)), transparent)' }}
      />

      <div
        className="flex whitespace-nowrap will-change-transform"
        style={{ animation: `ticker-scroll ${duration}s linear infinite` }}
      >
        {loop.map((it, idx) => (
          <TickerItem key={`${it.uuid}-${idx}`} item={it} onSelect={onSelect} />
        ))}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
})

// ======= WatchList（节点行表） =======

function cpuHeatBg(cpu: number | undefined, online: boolean): string {
  if (!online || cpu == null) return 'transparent'
  if (cpu >= 90) return 'rgba(239, 68, 68, 0.18)'
  if (cpu >= 70) return 'rgba(249, 115, 22, 0.16)'
  if (cpu >= 50) return 'rgba(234, 179, 8, 0.12)'
  return 'transparent'
}

function loadColor(cpu: number | undefined, online: boolean): string {
  if (!online) return 'hsl(var(--nx-text-dim))'
  if (cpu == null) return 'hsl(var(--nx-text-secondary))'
  if (cpu >= 90) return 'hsl(0 80% 60%)'
  if (cpu >= 70) return 'hsl(20 90% 60%)'
  if (cpu >= 50) return 'hsl(45 90% 55%)'
  return 'hsl(142 60% 55%)'
}

function diskColor(pct: number | undefined, online: boolean): string {
  if (!online || pct == null) return 'hsl(var(--nx-text-dim))'
  if (pct >= 90) return 'hsl(0 80% 65%)'
  if (pct >= 75) return 'hsl(20 90% 60%)'
  if (pct >= 50) return 'hsl(45 90% 60%)'
  return 'hsl(var(--nx-text-secondary))'
}

function netSpeedColor(bps: number): string {
  // 阶梯：<10KB 灰、<100KB 浅、>=100KB 蓝、>=1MB 黄、>=5MB 红
  if (bps >= 5 * 1024 * 1024) return 'hsl(0 80% 65%)'
  if (bps >= 1024 * 1024) return 'hsl(45 95% 60%)'
  if (bps >= 100 * 1024) return 'hsl(195 85% 60%)'
  if (bps >= 10 * 1024) return 'hsl(var(--nx-text-secondary))'
  return 'hsl(var(--nx-text-dim))'
}

const Row = memo(function Row({ node, selected, dim, onSelect }: { node: Node; selected: boolean; dim?: boolean; onSelect?: (uuid: string) => void }) {
  const u = deriveUsage(node)
  const dCpu = deltaCpu(node)
  const dMem = deltaMem(node)
  const aCpu = arrow(dCpu)
  const aMem = arrow(dMem)

  const cpuSpark = useMemo(
    () => node.history.map(h => h.cpu).filter((v): v is number => v != null).slice(-40),
    [node.history],
  )

  // 闪烁：当 CPU 跳动 ≥ 0.3% 时，整行短暂高亮
  const prevCpuRef = useRef<number | null>(null)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  useEffect(() => {
    const prev = prevCpuRef.current
    prevCpuRef.current = u.cpu ?? null
    if (prev == null || u.cpu == null) return
    const diff = u.cpu - prev
    if (Math.abs(diff) >= 0.3) {
      setFlash(diff > 0 ? 'up' : 'down')
      const t = setTimeout(() => setFlash(null), 600)
      return () => clearTimeout(t)
    }
  }, [u.cpu])

  const baseBg = selected ? 'hsl(var(--secondary) / 0.7)' : cpuHeatBg(u.cpu, node.online)
  const flashBg =
    flash === 'up'
      ? 'rgba(239, 68, 68, 0.28)'
      : flash === 'down'
        ? 'rgba(34, 197, 94, 0.22)'
        : null

  return (
    <button
      type="button"
      onClick={() => onSelect?.(node.uuid)}
      className="grid items-center gap-3 pl-0 pt-0 pb-0 pr-3 text-[11px] font-mono group relative text-left cursor-pointer w-full appearance-none bg-transparent border-0 m-0 font-[inherit] text-inherit"
      style={{
        gridTemplateColumns: '10px minmax(80px, 1.2fr) 52px 52px 60px 48px 52px 40px 68px 68px',
        background: flashBg ?? baseBg,
        borderBottom: '1px solid hsl(var(--border) / 0.25)',
        color: 'hsl(var(--nx-text-primary))',
        height: 32,
        opacity: dim ? 0.32 : 1,
        filter: dim ? 'grayscale(0.6)' : undefined,
        transition: 'background-color 250ms ease, opacity 200ms ease, filter 200ms ease',
      }}
    >
      {/* 状态点 */}
      <span className="flex items-center justify-center">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{
            background: node.online ? UP : DOWN,
            opacity: node.online ? 1 : 0.6,
            boxShadow: node.online ? `0 0 6px ${UP}` : 'none',
          }}
        />
      </span>
      {/* 名称 + 地区 */}
      <div className="flex items-center gap-1.5 min-w-0">
        {node.meta?.region && <Flag code={node.meta.region} />}
        <span className="truncate text-[12px] font-semibold tracking-wide" style={{ color: 'hsl(var(--nx-text-primary))' }}>
          {displayName(node)}
        </span>
      </div>
      {/* CPU 大数 */}
      <span className="tabular-nums text-right text-[12px] font-bold" style={{ color: loadColor(u.cpu, node.online) }}>
        {fmtPct(u.cpu)}
      </span>
      {/* CPU Δ */}
      <span className="tabular-nums text-right" style={{ color: aCpu.color }}>
        {dCpu == null ? '—' : `${aCpu.sym}${fmtDelta(dCpu)}`}
      </span>
      {/* Sparkline */}
      <span className="flex justify-end">
        <Sparkline values={cpuSpark} color={aCpu.color === FLAT ? 'hsl(var(--nx-text-secondary))' : aCpu.color} w={56} h={16} />
      </span>
      {/* MEM */}
      <span className="tabular-nums text-right" style={{ color: node.online ? 'hsl(var(--nx-text-primary))' : 'hsl(var(--nx-text-dim))' }}>
        {fmtPct(u.mem)}
      </span>
      {/* MEM Δ */}
      <span className="tabular-nums text-right" style={{ color: aMem.color }}>
        {dMem == null ? '—' : `${aMem.sym}${fmtDelta(dMem)}`}
      </span>
      {/* DISK */}
      <span className="tabular-nums text-right" style={{ color: diskColor(u.disk, node.online) }}>
        {fmtPct(u.disk, 0)}
      </span>
      {/* NET ↑ ↓ */}
      <span className="tabular-nums text-right text-[11px]" style={{ color: netSpeedColor(u.netOut ?? 0) }}>
        ↑{bytes(u.netOut ?? 0)}/s
      </span>
      <span className="tabular-nums text-right text-[11px]" style={{ color: netSpeedColor(u.netIn ?? 0) }}>
        ↓{bytes(u.netIn ?? 0)}/s
      </span>
    </button>
  )
})

export function WatchList({ nodes, selected, activeTag, activeRegion, onSelect }: { nodes: Node[]; selected: string | null; activeTag?: string | null; activeRegion?: string | null; onSelect?: (uuid: string) => void }) {
  if (!nodes.length) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">暂无节点</div>
    )
  }
  const isMatch = (n: Node) => {
    if (activeTag && !n.meta?.tags?.includes(activeTag)) return false
    if (activeRegion && n.meta?.region?.trim().toUpperCase() !== activeRegion) return false
    return true
  }
  const matchCount = (activeTag || activeRegion) ? nodes.filter(isMatch).length : nodes.length
  // 匹配的排前
  const sorted = (activeTag || activeRegion)
    ? [...nodes].sort((a, b) => (isMatch(b) ? 1 : 0) - (isMatch(a) ? 1 : 0))
    : nodes
  return (
    <div
      className="overflow-hidden"
      style={{
        background: 'hsl(var(--card) / 0.65)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em]"
        style={{
          background: 'hsl(var(--card) / 0.7)',
          borderBottom: '1px solid hsl(var(--border) / 0.5)',
          color: 'hsl(var(--nx-text-secondary))',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] tracking-[0.2em]"
            style={{ background: 'hsl(0 80% 55%)', color: '#fff' }}
          >
            <span className="inline-block w-1 h-1 rounded-full bg-white" style={{ animation: 'live-pulse-wl 1.4s ease-in-out infinite' }} />
            REC
          </span>
          <span>Watchlist · Real-Time</span>
        </div>
        <span className="tabular-nums opacity-60">
          {(activeTag || activeRegion) ? `${matchCount} / ${nodes.length} symbols` : `${nodes.length} symbols`}
        </span>
      </div>
      {/* Header */}
      <div
        className="grid items-center gap-3 pr-3 py-1.5 text-[10px] uppercase tracking-[0.22em] font-semibold"
        style={{
          gridTemplateColumns: '10px minmax(80px, 1.2fr) 52px 52px 60px 48px 52px 40px 68px 68px',
          background: 'hsl(var(--secondary) / 0.8)',
          borderBottom: '1px solid hsl(var(--border) / 0.6)',
          color: 'hsl(var(--nx-text-muted))',
        }}
      >
        <span />
        <span>Symbol</span>
        <span className="text-right">CPU</span>
        <span className="text-right">Δ 5m</span>
        <span className="text-right">Trend</span>
        <span className="text-right">MEM</span>
        <span className="text-right">Δ 5m</span>
        <span className="text-right">Disk</span>
        <span className="text-right">Net ↑</span>
        <span className="text-right">Net ↓</span>
      </div>
      {sorted.map(n => (
        <Row key={n.uuid} node={n} selected={selected === n.uuid} dim={!isMatch(n)} onSelect={onSelect} />
      ))}
      <style>{`
        @keyframes live-pulse-wl {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
