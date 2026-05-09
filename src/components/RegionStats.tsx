import { Flag } from './Flag'
import { cn } from '../utils/cn'
import type { Node } from '../types'

interface Props {
  nodes: Node[]
  active: string | null
  onChange: (region: string | null) => void
}

export function RegionStats({ nodes, active, onChange }: Props) {
  const counts = new Map<string, number>()
  for (const n of nodes) {
    const r = n.meta?.region?.trim().toUpperCase() || ''
    if (r) counts.set(r, (counts.get(r) ?? 0) + 1)
  }

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null

  return (
    <div
      className="sticky top-[78px] z-40 -mx-4 sm:-mx-6"
      style={{
        background: 'hsl(var(--background) / 0.85)',
        borderBottom: '1px solid hsl(var(--nx-accent) / 0.1)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="max-w-7xl mx-auto relative">
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex gap-2 px-4 sm:px-6 py-2 w-max min-w-full">
            <Chip selected={active === null} onClick={() => onChange(null)}>
              <span>全部</span>
              <span className="ml-1.5 opacity-60">{nodes.length}</span>
            </Chip>
            {entries.map(([region, count]) => (
              <Chip key={region} selected={active === region} onClick={() => onChange(region === active ? null : region)}>
                <Flag code={region} className="mr-1" />
                <span>{region}</span>
                <span className="ml-1.5 opacity-60">{count}</span>
              </Chip>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
      </div>
    </div>
  )
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('chip-nexus', selected && 'chip-nexus-active')}
    >
      {children}
    </button>
  )
}
