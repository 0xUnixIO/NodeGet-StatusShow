import { useMemo, useState } from 'react'
import { useFloating, offset, flip, shift, FloatingPortal } from '@floating-ui/react'
import { cn } from '../utils/cn'
import { bytes } from '../utils/format'
import type { HistorySample } from '../types'

const DOT_COUNT = 80

interface Bar {
  online: boolean
  hasData: boolean
  rate: number | null  // 0-1，仅 uptime 模式有值
  t: number | null
  cpu: number | null
  mem: number | null
  disk: number | null
  netIn: number
  netOut: number
}

function buildBars(history: HistorySample[], currentOnline: boolean): Bar[] {
  const empty = (): Bar => ({ online: false, hasData: false, rate: null, t: null, cpu: null, mem: null, disk: null, netIn: 0, netOut: 0 })

  if (history.length === 0) {
    return Array.from({ length: DOT_COUNT }, empty)
  }

  const recent = history.slice(-DOT_COUNT)
  const padBars: Bar[] = Array.from({ length: DOT_COUNT - recent.length }, empty)
  const dataBars: Bar[] = recent.map(s => ({
    online: s.online,
    hasData: true,
    rate: s.rate ?? null,
    t: s.t,
    cpu: s.cpu,
    mem: s.mem,
    disk: s.disk,
    netIn: s.netIn,
    netOut: s.netOut,
  }))

  if (dataBars.length > 0) {
    dataBars[dataBars.length - 1].online = currentOnline
  }

  return [...padBars, ...dataBars]
}

// hue 从 -9°(351°, 红) 线性插值到 142°(绿)，经过 ~66°(黄)
function rateColor(rate: number): string {
  const hue = Math.round(-9 + rate * 151)
  return `hsl(${(hue + 360) % 360} 82% 56%)`
}

function formatTime(ms: number) {
  const d = new Date(ms)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

export function UptimeBars({
  history,
  online,
  className,
  barHeight = 'h-1.5',
  hidePct = false,
}: {
  history: HistorySample[]
  online: boolean
  className?: string
  barHeight?: string
  hidePct?: boolean
}) {
  const bars = useMemo(() => buildBars(history, online), [history, online])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const { refs, floatingStyles } = useFloating({
    placement: 'top',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  })

  const onlineCount = bars.filter(b => b.hasData && b.online).length
  const totalData = bars.filter(b => b.hasData).length
  const pct = totalData > 0 ? Math.round((onlineCount / totalData) * 100) : null
  const hoveredBar = hoveredIndex !== null ? bars[hoveredIndex] : null

  const pctColor = pct !== null ? rateColor(pct / 100) : 'hsl(220 20% 45%)'

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div
        className="grid gap-px flex-1"
        style={{ gridTemplateColumns: `repeat(${DOT_COUNT}, minmax(0, 1fr))` }}
      >
        {bars.map((bar, i) => (
          <div
            key={i}
            className={cn('w-full cursor-default rounded-sm', barHeight, !bar.hasData && 'upbar-empty')}
            style={bar.hasData ? {
              backgroundColor: rateColor(bar.rate ?? (bar.online ? 1 : 0)),
            } : undefined}
            onMouseEnter={e => { refs.setReference(e.currentTarget); setHoveredIndex(i) }}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </div>

      {!hidePct && pct !== null && (
        <span
          className="text-[10px] shrink-0 select-none"
          style={{ color: pctColor }}
        >
          {pct}%
        </span>
      )}

      {hoveredBar && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              background: 'hsl(224 40% 8%)',
              borderColor: 'hsl(191 97% 55% / 0.25)',
              color: 'hsl(210 35% 75%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
            className="z-50 rounded border px-2 py-1.5 text-[11px] pointer-events-none"
          >
            {hoveredBar.hasData && hoveredBar.t ? (
              <div className="space-y-0.5">
                <div style={{ color: 'hsl(220 20% 45%)' }}>{formatTime(hoveredBar.t)}</div>
                {hoveredBar.rate !== null ? (
                  <div style={{ color: rateColor(hoveredBar.rate) }}>
                    ● 在线率 {Math.round(hoveredBar.rate * 100)}%
                  </div>
                ) : (
                  <div style={{ color: hoveredBar.online ? 'hsl(142 76% 58%)' : 'hsl(351 83% 61%)' }}>
                    {hoveredBar.online ? '● 在线' : '● 离线'}
                  </div>
                )}
                {hoveredBar.cpu !== null && <div style={{ color: 'hsl(191 97% 55%)' }}>CPU {hoveredBar.cpu.toFixed(1)}%</div>}
                {hoveredBar.mem !== null && <div style={{ color: 'hsl(263 85% 75%)' }}>MEM {hoveredBar.mem.toFixed(1)}%</div>}
                {hoveredBar.disk !== null && <div style={{ color: 'hsl(30 95% 62%)' }}>DSK {hoveredBar.disk.toFixed(1)}%</div>}
                {(hoveredBar.netIn > 0 || hoveredBar.netOut > 0) && (
                  <div style={{ color: 'hsl(220 20% 45%)' }}>↓ {bytes(hoveredBar.netIn)}/s · ↑ {bytes(hoveredBar.netOut)}/s</div>
                )}
              </div>
            ) : (
              <div style={{ color: 'hsl(220 20% 35%)' }}>无数据</div>
            )}
          </div>
        </FloatingPortal>
      )}
    </div>
  )
}
