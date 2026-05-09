import { useEffect, useState } from 'react'
import type { Node } from '../types'

const REPO = 'https://github.com/NodeSeekDev/NodeGet-StatusShow'

function pad(n: number) { return n.toString().padStart(2, '0') }
function fmtClock(d: Date, utc = false) {
  const h = utc ? d.getUTCHours() : d.getHours()
  const m = utc ? d.getUTCMinutes() : d.getMinutes()
  const s = utc ? d.getUTCSeconds() : d.getSeconds()
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function Footer({ text, nodes = [] }: { text?: string; nodes?: Node[] }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const total = nodes.length
  const online = nodes.filter(n => n.online).length

  return (
    <footer
      className="sticky bottom-0 z-30"
      style={{
        background: 'hsl(var(--card) / 0.7)',
        borderTop: '1px solid hsl(var(--border) / 0.6)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="px-4 py-1.5 flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.18em] overflow-x-auto scrollbar-none">
        {/* LIVE 指示 */}
        <span className="flex items-center gap-1.5 shrink-0" style={{ color: 'hsl(142 71% 45%)' }}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: 'hsl(142 71% 45%)', animation: 'live-pulse 1.4s ease-in-out infinite' }}
          />
          <span className="font-bold">Live</span>
        </span>

        <span className="opacity-30 shrink-0">│</span>

        <span className="shrink-0" style={{ color: 'hsl(var(--nx-text-secondary))' }}>
          <span className="opacity-50">Nodes </span>
          <span className="tabular-nums" style={{ color: online === total ? 'hsl(142 71% 45%)' : 'hsl(45 90% 55%)' }}>
            {online}
          </span>
          <span className="opacity-50">/{total}</span>
        </span>

        <span className="opacity-30 shrink-0">│</span>

        <span className="shrink-0" style={{ color: 'hsl(var(--nx-text-secondary))' }}>
          <span className="opacity-50">Local </span>
          <span className="tabular-nums">{fmtClock(now)}</span>
        </span>

        <span className="opacity-30 shrink-0 hidden sm:inline">│</span>

        <span className="shrink-0 hidden sm:inline" style={{ color: 'hsl(var(--nx-text-muted))' }}>
          <span className="opacity-50">Utc </span>
          <span className="tabular-nums">{fmtClock(now, true)}</span>
        </span>

        <span className="ml-auto shrink-0" style={{ color: 'hsl(var(--nx-text-muted))' }}>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[hsl(var(--nx-text-primary))]"
          >
            {text || 'NodeGet · StatusShow'}
          </a>
        </span>
      </div>

      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 hsl(142 71% 45% / 0.6); }
          50% { opacity: 0.55; box-shadow: 0 0 0 4px hsl(142 71% 45% / 0); }
        }
      `}</style>
    </footer>
  )
}
