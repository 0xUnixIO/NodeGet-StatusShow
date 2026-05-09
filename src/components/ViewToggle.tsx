import { LayoutGrid, Table } from 'lucide-react'
import { type ReactNode } from 'react'
import type { View } from '../types'

export function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  return (
    <div className="relative inline-grid grid-cols-2 bg-muted p-1 rounded-md">
      <div
        aria-hidden
        className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-sm bg-background shadow transition-transform duration-200 ease-out ${
          value === 'table' ? 'translate-x-full' : ''
        }`}
      />
      <Btn active={value === 'cards'} onClick={() => onChange('cards')}>
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">卡片</span>
      </Btn>
      <Btn active={value === 'table'} onClick={() => onChange('table')}>
        <Table className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">表格</span>
      </Btn>
    </div>
  )
}

function Btn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative z-10 inline-flex items-center justify-center gap-1.5 px-3 py-1 text-sm font-medium rounded-sm transition-colors ${
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
