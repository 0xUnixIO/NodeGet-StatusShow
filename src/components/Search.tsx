import { forwardRef } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { Input } from './ui/input'
import { cn } from '../utils/cn'

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
  autoFocus?: boolean
}

export const Search = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, className, autoFocus }, ref) => (
    <div className={cn('relative w-44 md:w-56', className)}>
      <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        placeholder="搜索节点…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-8"
        autoFocus={autoFocus}
      />
    </div>
  ),
)
Search.displayName = 'Search'
