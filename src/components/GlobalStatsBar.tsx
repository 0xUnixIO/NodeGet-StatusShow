import { useMemo } from 'react'
import { deriveUsage } from '../utils/derive'
import type { Node } from '../types'

export function GlobalStatsBar({ nodes }: { nodes: Node[] }) {
  const stats = useMemo(() => {
    if (!nodes.length) return null
    const total = nodes.length
    const online = nodes.filter(n => n.online).length
    const offline = total - online

    const withMem = nodes.filter(n => (n.dynamic?.total_memory ?? 0) > 0)
    const avgMem = withMem.length
      ? withMem.reduce((s, n) => s + (deriveUsage(n).mem ?? 0), 0) / withMem.length
      : 0

    const withDisk = nodes.filter(n => n.dynamic?.hdd_total != null)
    const avgDisk = withDisk.length
      ? withDisk.reduce((s, n) => s + (deriveUsage(n).disk ?? 0), 0) / withDisk.length
      : 0

    return { total, online, offline, avgMem, avgDisk }
  }, [nodes])

  if (!stats) return null

  return (
    <div className="flex items-center gap-x-4 gap-y-1 px-3 py-2 rounded-md flex-wrap text-xs"
      style={{ background: 'hsl(var(--muted)/0.5)', color: 'hsl(var(--nx-text-muted))' }}>

      <span>
        <span className="font-semibold" style={{ color: 'hsl(var(--nx-text-primary))' }}>{stats.total}</span>
        {' '}节点
      </span>

      <span className="font-medium text-emerald-500">{stats.online} 在线</span>

      {stats.offline > 0 && (
        <span className="font-medium text-red-500">{stats.offline} 离线</span>
      )}

      <div className="w-px h-3 shrink-0" style={{ background: 'hsl(var(--border))' }} />

      <span>
        内存{' '}
        <span className="font-mono" style={{ color: 'hsl(var(--nx-text-secondary))' }}>
          {stats.avgMem.toFixed(1)}%
        </span>
      </span>

      {stats.avgDisk > 0 && (
        <>
          <div className="w-px h-3 shrink-0" style={{ background: 'hsl(var(--border))' }} />
          <span>
            磁盘{' '}
            <span className="font-mono" style={{ color: 'hsl(var(--nx-text-secondary))' }}>
              {stats.avgDisk.toFixed(1)}%
            </span>
          </span>
        </>
      )}
    </div>
  )
}
