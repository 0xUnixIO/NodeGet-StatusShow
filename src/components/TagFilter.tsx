import { cn } from '../utils/cn'

interface Props {
  tags: string[]
  active: string | null
  onChange: (tag: string | null) => void
}

export function TagFilter({ tags, active, onChange }: Props) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span
        className="text-[9px] font-bold uppercase tracking-[0.22em] px-1 mr-1"
        style={{ color: 'hsl(var(--nx-text-muted))' }}
      >
        Filter ▸
      </span>
      <Chip selected={active === null} onClick={() => onChange(null)}>
        全部
      </Chip>
      {tags.map(t => (
        <Chip key={t} selected={active === t} onClick={() => onChange(t)}>
          {t}
        </Chip>
      ))}
    </div>
  )
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] transition-colors',
        selected
          ? 'text-foreground bg-secondary'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
