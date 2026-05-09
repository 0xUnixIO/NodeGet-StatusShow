import { useMemo } from 'react'
import type { Node } from '../types'
import { displayName, deriveUsage } from '../utils/derive'

const UP = 'hsl(142 71% 45%)'
const DOWN = 'hsl(0 72% 56%)'
const FLAT = 'hsl(var(--nx-text-muted))'

type OptType = 'CALL' | 'PUT'
type Status = 'ITM' | 'ATM' | 'OTM'

interface OptionContract {
  symbol: string         // 节点显示名
  uuid: string
  metric: 'CPU' | 'MEM' | 'NET'
  type: OptType
  strike: number
  last: number           // 当前指标值
  status: Status
  distance: number       // 距离 strike 的"距离"（0=已触发）
  unit: string
}

// 预定义"合约"模板：每个节点 × 模板 = 一条 option
const TEMPLATES: { metric: 'CPU' | 'MEM'; type: OptType; strike: number; unit: string }[] = [
  { metric: 'CPU', type: 'CALL', strike: 80, unit: '%' },
  { metric: 'CPU', type: 'CALL', strike: 50, unit: '%' },
  { metric: 'MEM', type: 'CALL', strike: 80, unit: '%' },
  { metric: 'MEM', type: 'CALL', strike: 60, unit: '%' },
]

function classify(last: number, strike: number, type: OptType): Status {
  // CALL：last 高于 strike 即"价内"(ITM)；接近 strike 即 ATM；否则 OTM
  if (type === 'CALL') {
    if (last >= strike) return 'ITM'
    if (last >= strike - 8) return 'ATM'
    return 'OTM'
  }
  if (last <= strike) return 'ITM'
  if (last <= strike + 8) return 'ATM'
  return 'OTM'
}

function statusColor(s: Status): string {
  if (s === 'ITM') return DOWN          // 已触发 = 红
  if (s === 'ATM') return 'hsl(45 90% 55%)' // 接近 = 黄
  return UP                              // 安全 = 绿
}

export function OptionsChain({ nodes, onSelect }: { nodes: Node[]; onSelect?: (uuid: string) => void }) {
  const contracts = useMemo<OptionContract[]>(() => {
    const list: OptionContract[] = []
    for (const n of nodes) {
      if (!n.online) continue
      const u = deriveUsage(n)
      for (const t of TEMPLATES) {
        let last: number | null = null
        if (t.metric === 'CPU') last = u.cpu ?? null
        if (t.metric === 'MEM') last = u.mem ?? null
        if (last == null) continue
        const status = classify(last, t.strike, t.type)
        // 只保留 ATM/ITM（接近触发或已触发的"活跃"合约），减少噪声
        if (status === 'OTM') continue
        list.push({
          symbol: displayName(n),
          uuid: n.uuid,
          metric: t.metric,
          type: t.type,
          strike: t.strike,
          last,
          status,
          distance: t.type === 'CALL' ? last - t.strike : t.strike - last,
          unit: t.unit,
        })
      }
    }
    // 按状态优先级（ITM > ATM）+ 距离绝对值降序
    return list.sort((a, b) => {
      const order: Record<Status, number> = { ITM: 0, ATM: 1, OTM: 2 }
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      return Math.abs(b.distance) - Math.abs(a.distance)
    })
  }, [nodes])

  const itmCount = contracts.filter(c => c.status === 'ITM').length
  const atmCount = contracts.filter(c => c.status === 'ATM').length
  const MAX_ROWS = 8
  const visible = contracts.slice(0, MAX_ROWS)
  const overflow = Math.max(0, contracts.length - MAX_ROWS)

  return (
    <div className="flex flex-col overflow-hidden shrink-0">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] shrink-0"
        style={{
          background: 'hsl(var(--card) / 0.7)',
          borderBottom: '1px solid hsl(var(--border) / 0.5)',
          color: 'hsl(var(--nx-text-secondary))',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] tracking-[0.2em]"
            style={{ background: 'hsl(45 95% 55%)', color: '#000' }}
          >
            CHAIN
          </span>
          <span>Options · Alert Threshold</span>
        </div>
        <span className="tabular-nums opacity-70 font-mono">
          <span style={{ color: DOWN }}>ITM {itmCount}</span>
          {' · '}
          <span style={{ color: 'hsl(45 90% 55%)' }}>ATM {atmCount}</span>
        </span>
      </div>

      {/* 表头 */}
      <div
        className="grid items-center gap-3 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-semibold shrink-0"
        style={{
          gridTemplateColumns: 'minmax(80px, 1.4fr) 38px 38px 56px 56px 48px',
          background: 'hsl(var(--secondary) / 0.7)',
          borderBottom: '1px solid hsl(var(--border) / 0.6)',
          color: 'hsl(var(--nx-text-muted))',
        }}
      >
        <span>Symbol</span>
        <span>M</span>
        <span>T</span>
        <span className="text-right">Strike</span>
        <span className="text-right">Last</span>
        <span className="text-right">Stat</span>
      </div>

      {/* 列表（最多 MAX_ROWS 行，溢出折叠为统计） */}
      <div>
        {visible.length === 0 ? (
          <div className="py-6 text-center text-[10px] uppercase tracking-[0.2em] opacity-40">
            No Active Options ··· All OTM
          </div>
        ) : (
          visible.map(c => {
            const sc = statusColor(c.status)
            return (
              <button
                type="button"
                key={`${c.uuid}-${c.metric}-${c.type}-${c.strike}`}
                onClick={() => onSelect?.(c.uuid)}
                className="grid items-center gap-3 px-4 py-1.5 text-[11px] font-mono tabular-nums hover:bg-[hsl(var(--secondary)/0.5)] text-left cursor-pointer w-full"
                style={{
                  gridTemplateColumns: 'minmax(80px, 1.4fr) 38px 38px 56px 56px 48px',
                  borderBottom: '1px solid hsl(var(--border) / 0.2)',
                  color: 'hsl(var(--nx-text-primary))',
                }}
              >
                <span className="truncate font-semibold">{c.symbol}</span>
                <span className="text-[10px] opacity-80">{c.metric}</span>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: c.type === 'CALL' ? UP : DOWN }}
                >
                  {c.type === 'CALL' ? 'C' : 'P'}
                </span>
                <span className="text-right opacity-70">
                  {c.strike}
                  {c.unit}
                </span>
                <span className="text-right font-bold" style={{ color: sc }}>
                  {c.last.toFixed(1)}
                  {c.unit}
                </span>
                <span
                  className="text-right text-[9px] font-bold tracking-[0.1em] px-1"
                  style={{
                    color: sc,
                    background: c.status === 'ITM' ? 'hsl(0 72% 56% / 0.15)' : c.status === 'ATM' ? 'hsl(45 90% 55% / 0.15)' : 'transparent',
                  }}
                >
                  {c.status}
                </span>
              </button>
            )
          })
        )}
        {overflow > 0 && (
          <div
            className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-center"
            style={{ color: 'hsl(var(--nx-text-muted))', borderTop: '1px solid hsl(var(--border) / 0.3)' }}
          >
            + {overflow} more (filtered)
          </div>
        )}
      </div>
    </div>
  )
}
