import { useMemo, useState, useEffect } from 'react'
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

// 每次只显示 1 条，确保任意屏幕宽度都放得下
const MAX_PER_PAGE = 1
const INTERVAL_MS = 3500
const TRANSITION_MS = 260

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

  const totalPages = Math.ceil(alerts.length / MAX_PER_PAGE)
  const isMultiPage = totalPages > 1

  const [page, setPage] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle')

  // 多页时自动翻页（竖向过渡动画）
  useEffect(() => {
    if (!isMultiPage) return
    let alive = true
    const pending: ReturnType<typeof setTimeout>[] = []

    const timer = setInterval(() => {
      setPhase('exit')
      const t1 = setTimeout(() => {
        if (!alive) return
        setPage(p => (p + 1) % totalPages)
        setPhase('enter')
        const t2 = setTimeout(() => {
          if (!alive) return
          setPhase('idle')
        }, TRANSITION_MS)
        pending.push(t2)
      }, TRANSITION_MS)
      pending.push(t1)
    }, INTERVAL_MS)

    return () => {
      alive = false
      clearInterval(timer)
      pending.forEach(clearTimeout)
    }
  }, [isMultiPage, totalPages])

  // alerts 变化时重置到第一页
  useEffect(() => {
    setPage(0)
    setPhase('idle')
  }, [alerts.length])

  if (alerts.length === 0) return null

  const halts = alerts.filter(a => a.level === 'halt').length
  const safePage = Math.min(page, totalPages - 1)
  const visible = alerts.slice(safePage * MAX_PER_PAGE, (safePage + 1) * MAX_PER_PAGE)

  const rowStyle: React.CSSProperties = {
    opacity: phase === 'exit' ? 0 : 1,
    transform: phase === 'exit'
      ? 'translateY(-5px)'
      : phase === 'enter'
        ? 'translateY(5px)'
        : 'translateY(0)',
    transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
  }

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
      {/* 左侧徽章 */}
      <div
        className="shrink-0 flex items-center gap-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] font-mono"
        style={{ background: halts > 0 ? RED : YELLOW, color: '#000' }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: '#000', animation: 'alert-pulse 1s ease-in-out infinite' }}
        />
        {halts > 0 ? `HALT · ${halts}` : `WARN · ${alerts.length}`}
      </div>

      {/* 当前条：竖向翻页动画 */}
      <div
        className="flex-1 min-w-0 flex items-center overflow-hidden"
        style={rowStyle}
      >
        {visible.map((a) => (
          <button
            key={a.uuid}
            type="button"
            onClick={() => onSelect?.(a.uuid)}
            className="shrink-0 flex items-center px-3 text-[10px] font-bold font-mono tracking-wide uppercase appearance-none bg-transparent border-0 m-0 cursor-pointer truncate"
            style={{ color: a.level === 'halt' ? RED : YELLOW }}
          >
            ◆ {a.text}
          </button>
        ))}
      </div>

      {/* 右侧页码，仅多页时显示 */}
      {isMultiPage && (
        <div
          className="shrink-0 flex items-center px-3 text-[9px] font-mono tabular-nums"
          style={{ color: halts > 0 ? RED : YELLOW, opacity: 0.6 }}
        >
          {safePage + 1}/{totalPages}
        </div>
      )}

      <style>{`
        @keyframes alert-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
