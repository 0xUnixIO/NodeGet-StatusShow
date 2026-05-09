import { useEffect, useRef, useState } from 'react'
import type { Node } from '../types'
import { displayName } from '../utils/derive'

const UP = 'hsl(142 71% 45%)'
const DOWN = 'hsl(0 72% 56%)'
const FLAT = 'hsl(var(--nx-text-muted))'

export interface TickEvent {
  id: number
  t: number
  type: 'CPU' | 'MEM' | 'NET' | 'UP' | 'DOWN'
  symbol: string
  value: string
  delta: string
  color: string
}

const MAX_EVENTS = 80

let evIdSeq = 0

function pad(n: number) { return n.toString().padStart(2, '0') }
function fmtTime(t: number) {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function useTickEvents(nodes: Node[]) {
  const prevRef = useRef<Map<string, { cpu: number | null; mem: number | null; online: boolean }>>(new Map())
  const [events, setEvents] = useState<TickEvent[]>([])

  useEffect(() => {
    const next: TickEvent[] = []
    const newSnap = new Map<string, { cpu: number | null; mem: number | null; online: boolean }>()
    const now = Date.now()

    for (const n of nodes) {
      const cpu = n.dynamic?.cpu_usage ?? null
      const memT = n.dynamic?.total_memory ?? 0
      const memU = n.dynamic?.used_memory ?? 0
      const mem = memT > 0 ? (memU / memT) * 100 : null
      const online = n.online
      newSnap.set(n.uuid, { cpu, mem, online })

      const prev = prevRef.current.get(n.uuid)
      if (!prev) continue
      const sym = displayName(n)

      // 上下线
      if (prev.online !== online) {
        next.push({
          id: ++evIdSeq,
          t: now,
          type: online ? 'UP' : 'DOWN',
          symbol: sym,
          value: online ? 'ONLINE' : 'OFFLINE',
          delta: '',
          color: online ? UP : DOWN,
        })
      }
      // CPU 跳变
      if (prev.cpu != null && cpu != null) {
        const d = cpu - prev.cpu
        if (Math.abs(d) >= 1) {
          next.push({
            id: ++evIdSeq,
            t: now,
            type: 'CPU',
            symbol: sym,
            value: `${cpu.toFixed(1)}%`,
            delta: `${d > 0 ? '+' : ''}${d.toFixed(1)}`,
            color: d > 0 ? DOWN : UP,
          })
        }
      }
      // MEM 跳变
      if (prev.mem != null && mem != null) {
        const d = mem - prev.mem
        if (Math.abs(d) >= 0.5) {
          next.push({
            id: ++evIdSeq,
            t: now,
            type: 'MEM',
            symbol: sym,
            value: `${mem.toFixed(1)}%`,
            delta: `${d > 0 ? '+' : ''}${d.toFixed(1)}`,
            color: d > 0 ? DOWN : UP,
          })
        }
      }
    }

    prevRef.current = newSnap
    if (next.length) {
      setEvents(prev => {
        const merged = [...next, ...prev]
        return merged.length > MAX_EVENTS ? merged.slice(0, MAX_EVENTS) : merged
      })
    }
  }, [nodes])

  return events
}

export function TimeAndSales({ events }: { events: TickEvent[] }) {
  return (
    <div className="h-full flex flex-col">
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] shrink-0"
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
            <span className="inline-block w-1 h-1 rounded-full bg-white" style={{ animation: 'tas-blink 1.4s ease-in-out infinite' }} />
            FEED
          </span>
          <span>Time &amp; Sales · WebSocket</span>
        </div>
        <span className="tabular-nums opacity-60">{events.length}</span>
      </div>

      {/* Header */}
      <div
        className="grid items-center gap-2 px-3 py-1 text-[9px] uppercase tracking-[0.22em] font-bold shrink-0"
        style={{
          gridTemplateColumns: '70px 36px minmax(80px, 1fr) 70px 60px',
          background: 'hsl(var(--secondary) / 0.7)',
          borderBottom: '1px solid hsl(var(--border) / 0.5)',
          color: 'hsl(var(--nx-text-muted))',
        }}
      >
        <span>Time</span>
        <span>Type</span>
        <span>Symbol</span>
        <span className="text-right">Value</span>
        <span className="text-right">Δ</span>
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {events.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[10px] uppercase tracking-[0.2em] opacity-40 px-3 text-center">
            Awaiting feed ···<br /> Tick events will stream here
          </div>
        ) : (
          events.map(e => (
            <div
              key={e.id}
              className="grid items-center gap-2 px-3 py-0.5 text-[11px] font-mono tabular-nums"
              style={{
                gridTemplateColumns: '70px 36px minmax(80px, 1fr) 70px 60px',
                borderBottom: '1px solid hsl(var(--border) / 0.18)',
                color: 'hsl(var(--nx-text-secondary))',
                animation: 'tas-flash 800ms ease-out',
              }}
            >
              <span className="text-[10px]" style={{ color: 'hsl(var(--nx-text-muted))' }}>{fmtTime(e.t)}</span>
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1 text-center"
                style={{
                  background: e.color === FLAT ? 'transparent' : `${e.color.replace(')', ' / 0.15)')}`,
                  color: e.color,
                }}
              >
                {e.type}
              </span>
              <span className="truncate text-[11px]" style={{ color: 'hsl(var(--nx-text-primary))' }}>{e.symbol}</span>
              <span className="text-right" style={{ color: e.color }}>{e.value}</span>
              <span className="text-right text-[10px]" style={{ color: e.color }}>{e.delta}</span>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes tas-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes tas-flash {
          0% { background-color: hsl(var(--nx-text-secondary) / 0.18); }
          100% { background-color: transparent; }
        }
      `}</style>
    </div>
  )
}
