import { useMemo } from 'react'
import type { Node } from '../types'
import { deriveUsage, displayName } from '../utils/derive'

type Tile = {
  uuid: string
  name: string
  cpu: number | null
  online: boolean
}

function cpuColor(cpu: number | null, online: boolean): string {
  if (!online) return 'hsl(0 0% 18%)'
  if (cpu == null) return 'hsl(0 0% 22%)'
  if (cpu < 25) return 'hsl(142 60% 25%)'
  if (cpu < 50) return 'hsl(142 70% 38%)'
  if (cpu < 70) return 'hsl(45 80% 45%)'
  if (cpu < 85) return 'hsl(25 85% 50%)'
  if (cpu < 95) return 'hsl(0 75% 50%)'
  return 'hsl(0 90% 55%)'
}

function shortName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 8) return trimmed
  // 优先取首段（- _ . 空格 之前）
  const first = trimmed.split(/[-_.\s]/)[0]
  if (first && first.length <= 8) return first
  return trimmed.slice(0, 8)
}

export function Heatmap({ nodes, onSelect }: { nodes: Node[]; onSelect?: (uuid: string) => void }) {
  const tiles = useMemo<Tile[]>(() => {
    const list: Tile[] = nodes.map(n => {
      const u = n.online ? deriveUsage(n) : { cpu: null }
      return {
        uuid: n.uuid,
        name: displayName(n),
        cpu: u.cpu ?? null,
        online: n.online,
      }
    })
    // 在线优先 → CPU 高优先
    list.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1
      const ac = a.cpu ?? -1
      const bc = b.cpu ?? -1
      return bc - ac
    })
    return list
  }, [nodes])

  return (
    <div
      className="flex flex-col overflow-hidden shrink-0"
      style={{ background: 'hsl(var(--card) / 0.7)', border: '1px solid hsl(var(--border))' }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] font-mono shrink-0"
        style={{
          background: 'hsl(var(--secondary))',
          color: 'hsl(var(--nx-text-secondary))',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <span>Heatmap · CPU Load</span>
        <span className="text-[9px]" style={{ color: 'hsl(var(--nx-text-dim))' }}>
          {tiles.length} nodes
        </span>
      </div>

      <div
        className="grid gap-[3px] p-2"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
        }}
      >
        {tiles.map(t => {
          const short = shortName(t.name)
          const bright = t.online && (t.cpu ?? 0) >= 50
          return (
            <button
              key={t.uuid}
              type="button"
              onClick={() => onSelect?.(t.uuid)}
              title={`${t.name} · ${t.online ? (t.cpu == null ? '—' : `CPU ${t.cpu.toFixed(0)}%`) : 'OFFLINE'}`}
              className="appearance-none border-0 m-0 p-1 cursor-pointer transition-transform hover:scale-110 hover:z-10 relative flex flex-col items-center justify-center font-mono leading-tight"
              style={{
                aspectRatio: '1.4 / 1',
                background: cpuColor(t.cpu, t.online),
                color: bright ? '#000' : 'hsl(0 0% 92%)',
                opacity: t.online ? 1 : 0.55,
                filter: t.online ? undefined : 'grayscale(0.7)',
              }}
            >
              <span
                className="text-[10px] font-bold truncate w-full text-center"
                style={{ textShadow: bright ? 'none' : '0 1px 2px rgba(0,0,0,0.6)' }}
              >
                {short}
              </span>
              <span className="text-[11px] font-bold tabular-nums">
                {t.online ? (t.cpu == null ? '—' : `${t.cpu.toFixed(0)}%`) : 'OFF'}
              </span>
            </button>
          )
        })}
      </div>

      <div
        className="flex items-center justify-between px-3 py-1 text-[9px] font-mono shrink-0"
        style={{
          color: 'hsl(var(--nx-text-dim))',
          borderTop: '1px solid hsl(var(--border) / 0.4)',
        }}
      >
        <span>0%</span>
        <div
          className="flex-1 mx-2 h-1.5"
          style={{
            background:
              'linear-gradient(to right, hsl(142 60% 25%), hsl(142 70% 38%), hsl(45 80% 45%), hsl(25 85% 50%), hsl(0 75% 50%), hsl(0 90% 55%))',
          }}
        />
        <span>100%</span>
      </div>
    </div>
  )
}
