const ISP_COLORS: Record<string, string> = {
  '移动': '#3b82f6',
  '联通': '#f59e0b',
  '电信': '#10b981',
}

const FALLBACK_COLORS = ['#8b5cf6', '#ef4444', '#06b6d4']

export function ispColor(cron: string, idx = 0): string {
  for (const [key, color] of Object.entries(ISP_COLORS)) {
    if (cron.includes(key)) return color
  }
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length] ?? '#9ca3af'
}

export function shortCron(cron: string): string {
  return cron.replace(/^tcping-/, '')
}
