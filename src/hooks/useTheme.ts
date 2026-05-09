import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const listeners = new Set<(t: Theme) => void>()

let current: Theme = 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  current = theme
  listeners.forEach(fn => fn(theme))
}

// 页面加载时立即应用，避免闪烁
applyTheme(current)

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current)

  useEffect(() => {
    listeners.add(setTheme)
    return () => { listeners.delete(setTheme) }
  }, [])

  const toggle = (e?: React.MouseEvent) => {
    const next: Theme = current === 'dark' ? 'light' : 'dark'
    const rect = (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    const maxR = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    if (!document.startViewTransition) {
      applyTheme(next)
      return
    }

    const vt = document.startViewTransition(() => applyTheme(next))
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxR}px at ${x}px ${y}px)`] },
        { duration: 400, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
      )
    })
  }

  return { theme, toggle }
}
