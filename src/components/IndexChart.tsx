import { useEffect, useMemo, useRef, useState } from 'react'
import type { Node } from '../types'

const UP = 'hsl(142 71% 45%)'
const DOWN = 'hsl(0 72% 56%)'
const FLAT = 'hsl(var(--nx-text-muted))'

const SUB_MS = 5_000      // 每 5s 一个全网指数采样
const BUCKET_MS = 30_000  // 每根蜡烛 30s = 6 个采样
const MAX_BARS = 90       // 显示最近 45 分钟

type Candle = { t: number; o: number; h: number; l: number; c: number; n: number }

function fmtTime(t: number) {
  const d = new Date(t)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtBytes(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' GB/s'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + ' MB/s'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + ' KB/s'
  return v.toFixed(0) + ' B/s'
}

function fmtBytesShort(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'G'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'
  return v.toFixed(0)
}

export function IndexChart({ nodes }: { nodes: Node[] }) {
  // 1. 把所有节点的 history.netIn+netOut 按 5s 子桶聚合 → 全网总速率作为指数采样
  //    再按 BUCKET_MS 把 6 个子样本组成 OHLC 蜡烛
  const candles = useMemo<Candle[]>(() => {
    // sub bucket: 时间桶 → 桶内全网总速率累加（同一桶可能含多个 sample，取平均）
    type SB = { sum: number; cnt: number }
    const sub = new Map<number, SB>()
    for (const n of nodes) {
      for (const h of n.history) {
        if (!h.t) continue
        const v = (h.netIn || 0) + (h.netOut || 0)
        if (v <= 0) continue
        const k = Math.floor(h.t / SUB_MS) * SUB_MS
        let b = sub.get(k)
        if (!b) { b = { sum: 0, cnt: 0 }; sub.set(k, b) }
        b.sum += v
        b.cnt++
      }
    }
    // 每个子桶 → 全网总速率（这里 sum 已经是该 5s 内所有节点速率之和的累加，
    //   除以 cnt 得到每条采样的"全网总速率"近似值）
    // 注意：cnt 通常 ≈ 节点数（每节点该 5s 内 1 条 history），所以平均反映"那 5s 全网即时总速率"
    const samples = Array.from(sub.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, b]) => ({ t, v: b.sum, n: b.cnt }))
      // 用 sum：所有节点该桶速率求和 = 全网带宽

    // 把 sub samples 按蜡烛桶分组
    const cmap = new Map<number, { vs: number[]; n: number }>()
    for (const s of samples) {
      const k = Math.floor(s.t / BUCKET_MS) * BUCKET_MS
      let g = cmap.get(k)
      if (!g) { g = { vs: [], n: 0 }; cmap.set(k, g) }
      g.vs.push(s.v)
      g.n += s.n
    }
    const sorted = Array.from(cmap.entries()).sort((a, b) => a[0] - b[0])
    const list: Candle[] = []
    let prevClose: number | null = null
    for (const [t, g] of sorted) {
      const o = prevClose ?? g.vs[0]
      const c = g.vs[g.vs.length - 1]
      const h = Math.max(o, c, ...g.vs)
      const l = Math.min(o, c, ...g.vs)
      list.push({ t, o, h, l, c, n: g.n })
      prevClose = c
    }
    return list.slice(-MAX_BARS)
  }, [nodes])

  const last = candles.at(-1)
  const prev = candles.length >= 2 ? candles[candles.length - 2] : null
  const first = candles[0]
  const valNow = last?.c ?? null
  // 头部数字色：相对窗口起点的累计变化（决定红绿趋势）
  const trendChg = first && last ? last.c - first.o : null
  // Δ 显示：相对上一根 close（最近一根 K 线涨跌幅）
  const barChg = prev && last ? last.c - prev.c : null
  const barChgPct = prev && last && prev.c > 0 ? ((last.c - prev.c) / prev.c) * 100 : null
  const valChg = barChg

  // 网速：上涨 = 流量增加 = 涨（绿）；下跌 = 流量收缩 = 跌（红）（按"成交量/活跃度"语义）
  const headColor = trendChg == null ? FLAT : trendChg > 0 ? UP : trendChg < 0 ? DOWN : FLAT
  const barColor = barChg == null ? FLAT : barChg > 0 ? UP : barChg < 0 ? DOWN : FLAT

  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(800)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState(0)
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(es => {
      for (const e of es) setW(e.contentRect.width)
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const H = 96
  const padTop = 8
  const padBot = 12
  const padRight = 60
  const padLeft = 4
  const innerW = Math.max(0, w - padLeft - padRight)
  const priceH = H - padTop - padBot

  const { lo, hi } = useMemo(() => {
    if (!candles.length) return { lo: 1, hi: 1024 }
    let lo = Infinity, hi = -Infinity
    for (const c of candles) {
      if (c.l < lo) lo = c.l
      if (c.h > hi) hi = c.h
    }
    // 对数刻度：保证 lo 至少 1B/s 避免 log(0)
    lo = Math.max(1, lo)
    if (hi <= lo) hi = lo * 4
    // 上下各扩 ~15% 对数空间
    const logLo = Math.log10(lo)
    const logHi = Math.log10(hi)
    const padLog = Math.max(0.05, (logHi - logLo) * 0.15)
    return { lo: Math.pow(10, logLo - padLog), hi: Math.pow(10, logHi + padLog) }
  }, [candles])

            {/* EMA(9) 折线 - 已移除 */}

  const yOf = (v: number) => {
    const lv = Math.log10(Math.max(1, v))
    const lLo = Math.log10(lo)
    const lHi = Math.log10(hi)
    const t = (lv - lLo) / (lHi - lLo)
    return padTop + (1 - t) * priceH
  }
  const slotW = candles.length ? innerW / candles.length : 0
  const bodyW = Math.max(2, Math.min(8, slotW * 0.6))

  // 对数刻度的等距三档（几何中点）
  const ticks = useMemo(() => {
    const lLo = Math.log10(lo)
    const lHi = Math.log10(hi)
    return [hi, Math.pow(10, (lLo + lHi) / 2), lo]
  }, [lo, hi])

  return (
    <div
      style={{
        background: 'hsl(var(--card) / 0.7)',
        borderBottom: '1px solid hsl(var(--border) / 0.6)',
      }}
      className="flex"
    >
      {/* 左侧：指数标识 + 当前值 */}
      <div
        className="shrink-0 px-3 py-1.5 border-r flex flex-col justify-center min-w-[230px]"
        style={{ borderColor: 'hsl(var(--border) / 0.5)' }}
      >
        <div
          className="text-[9px] font-bold uppercase tracking-[0.22em] mb-0.5"
          style={{ color: 'hsl(var(--nx-text-muted))' }}
        >
          ^NETX · Global Throughput · 30s
        </div>
        <div className="flex items-baseline gap-2 font-mono tabular-nums">
          <span className="text-[14px] font-bold" style={{ color: headColor }}>
            {valNow != null ? fmtBytes(valNow) : '—'}
          </span>
          {valChg != null && (
            <span className="text-[10px]" style={{ color: barColor }}>
              {valChg > 0 ? '▲' : valChg < 0 ? '▼' : '·'}
              {fmtBytesShort(Math.abs(valChg))}
              {barChgPct != null && ` (${barChgPct >= 0 ? '+' : ''}${barChgPct.toFixed(2)}%)`}
            </span>
          )}
        </div>
        <div className="text-[9px] opacity-50 mt-0.5 font-mono">
          NODES {nodes.length} · BARS {candles.length}
        </div>
      </div>

      {/* 主图：自绘 K 线 */}
      <div ref={wrapRef} className="flex-1 min-w-0 relative" style={{ height: H }}>
        {candles.length < 1 ? (
          <div className="h-full flex items-center justify-center text-[10px] uppercase tracking-[0.2em] opacity-40">
            Awaiting Throughput Data ···
          </div>
        ) : (
          <svg
            width={w}
            height={H}
            className="block"
            onMouseMove={e => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
              const x = e.clientX - rect.left
              if (slotW <= 0) return
              const i = Math.max(0, Math.min(candles.length - 1, Math.floor((x - padLeft) / slotW)))
              setHoverIdx(i)
              setHoverX(x)
            }}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {ticks.map((v, i) => {
              const y = yOf(v)
              return (
                <g key={i}>
                  <line
                    x1={padLeft}
                    x2={w - padRight}
                    y1={y}
                    y2={y}
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.25}
                    strokeDasharray="2 4"
                  />
                  <text
                    x={w - padRight + 4}
                    y={y + 3}
                    fontSize={9}
                    fill="hsl(var(--nx-text-muted))"
                    fontFamily="ui-monospace, monospace"
                  >
                    {fmtBytesShort(v)}
                  </text>
                </g>
              )
            })}
            {candles.map((c, i) => {
              const cx = padLeft + slotW * (i + 0.5)
              const up = c.c >= c.o
              const color = up ? UP : DOWN
              const yH = yOf(c.h)
              const yL = yOf(c.l)
              const yO = yOf(c.o)
              const yC = yOf(c.c)
              const top = Math.min(yO, yC)
              const bodyH = Math.max(1, Math.abs(yC - yO))
              return (
                <g key={c.t}>
                  <line x1={cx} x2={cx} y1={yH} y2={yL} stroke={color} strokeWidth={1} />
                  <rect
                    x={cx - bodyW / 2}
                    y={top}
                    width={bodyW}
                    height={bodyH}
                    fill={color}
                  />
                  <title>
                    {fmtTime(c.t)}  O {fmtBytes(c.o)}  H {fmtBytes(c.h)}  L {fmtBytes(c.l)}  C {fmtBytes(c.c)}
                  </title>
                </g>
              )
            })}
            {/* EMA(9) 折线 - 已移除 */}
            {valNow != null && (
              <line
                x1={padLeft}
                x2={w - padRight}
                y1={yOf(valNow)}
                y2={yOf(valNow)}
                stroke={headColor}
                strokeWidth={0.6}
                strokeDasharray="1 3"
                opacity={0.6}
              />
            )}
            {candles.length >= 2 && (
              <>
                <text
                  x={padLeft + 2}
                  y={H - 1}
                  fontSize={8}
                  fill="hsl(var(--nx-text-muted))"
                  opacity={0.7}
                  fontFamily="ui-monospace, monospace"
                >
                  {fmtTime(candles[0].t)}
                </text>
                <text
                  x={w - padRight - 2}
                  y={H - 1}
                  fontSize={8}
                  textAnchor="end"
                  fill="hsl(var(--nx-text-muted))"
                  opacity={0.7}
                  fontFamily="ui-monospace, monospace"
                >
                  {fmtTime(candles[candles.length - 1].t)}
                </text>
              </>
            )}
            {/* Crosshair */}
            {hoverIdx != null && candles[hoverIdx] && (() => {
              const c = candles[hoverIdx]
              const cx = padLeft + slotW * (hoverIdx + 0.5)
              return (
                <g pointerEvents="none">
                  <line
                    x1={cx}
                    x2={cx}
                    y1={padTop}
                    y2={padTop + priceH}
                    stroke="hsl(var(--nx-text-muted))"
                    strokeWidth={0.6}
                    strokeDasharray="2 3"
                    opacity={0.7}
                  />
                  <line
                    x1={padLeft}
                    x2={w - padRight}
                    y1={yOf(c.c)}
                    y2={yOf(c.c)}
                    stroke="hsl(var(--nx-text-muted))"
                    strokeWidth={0.6}
                    strokeDasharray="2 3"
                    opacity={0.7}
                  />
                </g>
              )
            })()}
          </svg>
        )}
        {/* Tooltip */}
        {hoverIdx != null && candles[hoverIdx] && (() => {
          const c = candles[hoverIdx]
          const up = c.c >= c.o
          const tipColor = up ? UP : DOWN
          const tipW = 200
          // 智能定位：右侧空间不够时贴左边
          const left = Math.min(w - padRight - tipW - 4, Math.max(padLeft, hoverX + 12))
          return (
            <div
              className="absolute pointer-events-none font-mono tabular-nums"
              style={{
                left,
                top: 6,
                width: tipW,
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                padding: '6px 8px',
                fontSize: 10,
                lineHeight: 1.5,
                color: 'hsl(var(--nx-text-primary))',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
            >
              <div className="flex items-center justify-between mb-1 opacity-70 text-[9px] uppercase tracking-[0.2em]">
                <span>{fmtTime(c.t)}</span>
                <span style={{ color: tipColor }}>{up ? '▲ UP' : '▼ DOWN'}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span className="opacity-60">O</span><span className="text-right">{fmtBytes(c.o)}</span>
                <span className="opacity-60">H</span><span className="text-right" style={{ color: UP }}>{fmtBytes(c.h)}</span>
                <span className="opacity-60">L</span><span className="text-right" style={{ color: DOWN }}>{fmtBytes(c.l)}</span>
                <span className="opacity-60">C</span><span className="text-right" style={{ color: tipColor }}>{fmtBytes(c.c)}</span>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
