import { useMemo } from 'react'
import type { Node } from '../types'
import { deriveUsage, displayName } from '../utils/derive'

const RED = 'hsl(0 80% 55%)'
const YELLOW = 'hsl(45 90% 55%)'

function fmtBps(bps: number): string {
  if (bps >= 1024 * 1024 * 1024) return `${(bps / 1024 / 1024 / 1024).toFixed(1)}GB/s`
  if (bps >= 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)}MB/s`
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)}KB/s`
  return `${bps}B/s`
}

type Alert = { uuid: string; level: 'halt' | 'warn'; text: string }

export function AlertBanner({ nodes, onSelect }: { nodes: Node[]; onSelect?: (uuid: string) => void }) {
  const alerts = useMemo<Alert[]>(() => {
    const list: Alert[] = []
    for (const n of nodes) {
      const name = displayName(n)
      if (!n.online) {
        list.push({ uuid: n.uuid, level: 'halt', text: `${name} · OFFLINE` })
        continue
      }
      const u = deriveUsage(n)
      if (u.cpu != null && u.cpu >= 90) {
        list.push({ uuid: n.uuid, level: 'halt', text: `${name} · CPU ${u.cpu.toFixed(0)}%` })
      } else if (u.cpu != null && u.cpu >= 80) {
        list.push({ uuid: n.uuid, level: 'warn', text: `${name} · CPU ${u.cpu.toFixed(0)}%` })
      }
      if (u.mem != null && u.mem >= 95) {
        list.push({ uuid: n.uuid, level: 'halt', text: `${name} · MEM ${u.mem.toFixed(0)}%` })
      }
      if (u.disk != null && u.disk >= 90) {
        list.push({ uuid: n.uuid, level: 'warn', text: `${name} · DISK ${u.disk.toFixed(0)}%` })
      }
      const netMax = Math.max(u.netIn ?? 0, u.netOut ?? 0)
      if (netMax >= 10 * 1024 * 1024) {
        list.push({ uuid: n.uuid, level: 'halt', text: `${name} · NET ${fmtBps(netMax)}` })
      } else if (netMax >= 1024 * 1024) {
        list.push({ uuid: n.uuid, level: 'warn', text: `${name} · NET ${fmtBps(netMax)}` })
      }
    }
    return list
  }, [nodes])

  if (alerts.length === 0) return null

  const halts = alerts.filter(a => a.level === 'halt').length
  // 复制内容做无缝滚动
  const loop = [...alerts, ...alerts]
  const duration = Math.max(20, alerts.length * 3.5)

  return (
    <div
      className="relative flex items-stretch overflow-hidden"
      style={{
        background: halts > 0 ? 'hsl(0 80% 55% / 0.12)' : 'hsl(45 90% 55% / 0.10)',
        borderTop: '1px solid hsl(var(--border) / 0.6)',
        borderBottom: '1px solid hsl(var(--border) / 0.6)',
        height: 22,
      }}
    >
      <div
        className="shrink-0 flex items-center gap-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] font-mono z-10"
        style={{
          background: halts > 0 ? RED : YELLOW,
          color: '#000',
        }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: '#000', animation: 'alert-pulse 1s ease-in-out infinite' }}
        />
        {halts > 0 ? `HALT · ${halts}` : `WARN · ${alerts.length}`}
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-12 z-10"
        style={{
          background: `linear-gradient(to left, ${halts > 0 ? 'hsl(0 80% 55% / 0.4)' : 'hsl(45 90% 55% / 0.4)'}, transparent)`,
        }}
      />

      <div
        className="flex whitespace-nowrap will-change-transform items-center"
        style={{ animation: `alert-scroll ${duration}s linear infinite` }}
      >
        {loop.map((a, idx) => (
          <button
            key={`${a.uuid}-${idx}`}
            type="button"
            onClick={() => onSelect?.(a.uuid)}
            className="shrink-0 px-4 text-[10px] font-bold font-mono tracking-wide uppercase appearance-none bg-transparent border-0 m-0 cursor-pointer"
            style={{
              color: a.level === 'halt' ? RED : YELLOW,
            }}
          >
            ◆ {a.text}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes alert-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes alert-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
