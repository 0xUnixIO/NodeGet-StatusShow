import { useMemo, useRef, useLayoutEffect } from 'react'
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

const PX_PER_SEC = 60

export function AlertBanner({ nodes, onSelect }: { nodes: Node[]; onSelect?: (uuid: string) => void }) {
  const stripRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<Animation | null>(null)

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

  // 用实测像素宽度驱动动画，避免 -50% 因文本变化而跳帧
  useLayoutEffect(() => {
    const el = stripRef.current
    if (!el || !alerts.length) return
    const onePass = el.scrollWidth / 2
    const dur = Math.max(8000, (onePass / PX_PER_SEC) * 1000)
    const kf: Keyframe[] = [
      { transform: 'translateX(0px)' },
      { transform: `translateX(-${onePass}px)` },
    ]
    if (animRef.current) {
      // 保留当前进度，取消旧动画后立即以相同位置重启
      const oldDur = (animRef.current.effect?.getComputedTiming().duration as number) || dur
      const startTime = ((animRef.current.currentTime as number) % oldDur) / oldDur * dur
      animRef.current.cancel()
      animRef.current = el.animate(kf, { duration: dur, iterations: Infinity, easing: 'linear' })
      animRef.current.currentTime = startTime
    } else {
      animRef.current = el.animate(kf, { duration: dur, iterations: Infinity, easing: 'linear' })
    }
  }, [alerts])

  useLayoutEffect(() => () => { animRef.current?.cancel() }, [])

  if (alerts.length === 0) return null

  const halts = alerts.filter(a => a.level === 'halt').length
  const color = halts > 0 ? RED : YELLOW

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
        className="shrink-0 z-10 flex items-center gap-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] font-mono"
        style={{ background: color, color: '#000' }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: '#000', animation: 'alert-pulse 1s ease-in-out infinite' }}
        />
        {halts > 0 ? `HALT · ${halts}` : `WARN · ${alerts.length}`}
      </div>

      {/* 跑马灯：复制两份实现无缝循环，动画由 Web Animations API 驱动 */}
      <div className="flex-1 min-w-0 overflow-hidden flex items-center">
        <div
          ref={stripRef}
          className="flex items-center whitespace-nowrap"
          style={{ willChange: 'transform' }}
        >
          {[...alerts, ...alerts].map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect?.(a.uuid)}
              className="shrink-0 inline-flex items-center px-3 text-[10px] font-bold font-mono tracking-wide uppercase appearance-none bg-transparent border-0 m-0 cursor-pointer"
              style={{ color: a.level === 'halt' ? RED : YELLOW }}
            >
              <span className="mr-2 opacity-30" style={{ color }}>·</span>
              ◆ {a.text}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes alert-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
