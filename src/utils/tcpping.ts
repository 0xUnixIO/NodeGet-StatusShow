import type { TcpPingRecord } from '../types'

const PING_BUCKET_MS = 30_000

// 将 TCP Ping 记录按 30s 桶聚合，返回每桶每运营商的平均延迟
export function buildPingBuckets(
  pings: TcpPingRecord[],
  cronNames: string[],
): { t: number; [cron: string]: number | null }[] {
  const snap = (t: number) => Math.round(t / PING_BUCKET_MS) * PING_BUCKET_MS
  const acc = new Map<number, Map<string, number[]>>()
  for (const p of pings) {
    if (p.latency == null) continue
    const t = snap(p.t)
    const m = acc.get(t) ?? new Map<string, number[]>()
    if (!acc.has(t)) acc.set(t, m)
    const arr = m.get(p.cron) ?? []
    arr.push(p.latency)
    m.set(p.cron, arr)
  }
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, m]) => ({
      t,
      ...Object.fromEntries(
        cronNames.map(c => {
          const vals = m.get(c)
          return [c, vals?.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null]
        }),
      ),
    }))
}

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
