import { useEffect, useState } from 'react'
import { Menu, Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { Flag } from './Flag'
import { cn } from '../utils/cn'

interface Props {
  siteName: string
  logo?: string
  regions?: string[]
  regionCounts?: Map<string, number>
  activeRegion?: string | null
  onRegionChange?: (r: string | null) => void
  onMenuOpen?: () => void
  onHome?: () => void
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export function Navbar({
  siteName,
  logo,
  regions,
  regionCounts,
  activeRegion,
  onRegionChange,
  onMenuOpen,
  onHome,
}: Props) {
  const { theme, toggle } = useTheme()
  const hasRegions = (regions?.length ?? 0) > 1
  const isDark = theme === 'dark'

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-11 flex items-stretch"
      style={{
        background: isDark ? 'rgba(8, 11, 18, 0.92)' : 'rgba(245, 247, 250, 0.92)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: isDark
          ? '1px solid rgba(255,255,255,0.08)'
          : '1px solid rgba(0,0,0,0.08)',
      }}
    >
      {/* 左：菜单 + LOGO + 站点名 + 市场状态 */}
      <div
        className="flex items-center gap-3 pl-3 pr-4 shrink-0 border-r"
        style={{ borderColor: divider }}
      >
        {onMenuOpen && (
          <button
            type="button"
            onClick={onMenuOpen}
            className="lg:hidden p-1 transition-colors shrink-0"
            style={{ color: 'hsl(var(--nx-text-muted))' }}
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <a
          href="./"
          onClick={e => {
            e.preventDefault()
            onHome?.()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="flex items-center gap-2 shrink-0"
        >
          {logo && (
            <img src={logo} alt="" className="w-5 h-5 rounded-full object-cover" />
          )}
          <span
            className="text-xs font-bold tracking-[0.22em] uppercase"
            style={{ color: 'hsl(var(--nx-text-primary))' }}
          >
            {siteName}
          </span>
        </a>
      </div>

      {/* 中：region 切换 */}
      <div className="flex-1 min-w-0 flex items-center px-2 overflow-hidden">
        {hasRegions && (
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none w-full">
            <button
              type="button"
              onClick={() => onRegionChange?.(null)}
              className={cn(
                'px-2.5 h-7 text-[10px] uppercase tracking-[0.18em] font-bold font-mono transition-colors shrink-0 inline-flex items-center',
                !activeRegion
                  ? 'text-foreground bg-secondary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              All
            </button>
            {regions!.map(r => (
              <button
                key={r}
                type="button"
                onClick={() =>
                  onRegionChange?.(activeRegion === r ? null : r)
                }
                className={cn(
                  'px-2.5 h-7 text-[10px] tracking-[0.18em] font-mono transition-colors shrink-0 inline-flex items-center gap-1.5',
                  activeRegion === r
                    ? 'text-foreground bg-secondary font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Flag code={r} />
                <span className="uppercase">{r}</span>
                <span className="opacity-50 tabular-nums">
                  {regionCounts?.get(r)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 右：时钟 + 主题切换 */}
      <div
        className="flex items-center gap-3 px-3 shrink-0 border-l"
        style={{ borderColor: divider }}
      >
        <span
          className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold font-mono tracking-[0.16em]"
          style={{ color: 'hsl(var(--nx-text-secondary))' }}
        >
          <span className="opacity-50 uppercase">Local</span>
          <span
            className="tabular-nums"
            style={{ color: 'hsl(var(--nx-text-primary))' }}
          >
            {clock}
          </span>
        </span>
        <button
          type="button"
          onClick={toggle}
          title={theme === 'dark' ? '切换亮色' : '切换暗色'}
          className="p-1 transition-colors shrink-0"
          style={{ color: 'hsl(var(--nx-text-muted))' }}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <style>{`
        @keyframes nav-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 hsl(142 71% 45% / 0.6); }
          50% { opacity: 0.55; box-shadow: 0 0 0 4px hsl(142 71% 45% / 0); }
        }
      `}</style>
    </header>
  )
}
