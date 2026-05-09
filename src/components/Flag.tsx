import { cn } from '../utils/cn'

export function Flag({ code, className }: { code?: string | null; className?: string }) {
  const c = code?.trim().toUpperCase() || ''
  if (!/^[A-Z]{2}$/.test(c)) return null
  return (
    <img
      src={`https://flagcdn.com/${c.toLowerCase()}.svg`}
      alt={c}
      title={c}
      loading="lazy"
      className={cn('inline-block w-5 h-3.5 rounded-[1px] object-cover shadow-sm', className)}
    />
  )
}
