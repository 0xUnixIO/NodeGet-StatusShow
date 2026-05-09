import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BackendPool } from '../api/pool'
import { dynamicSummaryMulti, kvGetMulti, listAgentUuids, queryNodeTcpPings, queryTcpPings, querySummaryHistory, staticDataMulti } from '../api/methods'
import { isOnline } from '../utils/status'
import type { DynamicSummary, HistorySample, Node, NodeMeta, SiteConfig, TcpPingRecord } from '../types'

type Agent = Pick<Node, 'uuid' | 'source' | 'meta' | 'static'>

interface BackendError {
  source: string
  error: unknown
}

const STATIC_FIELDS = ['cpu', 'system']
const DYNAMIC_FIELDS = [
  'cpu_usage',
  'used_memory',
  'total_memory',
  'available_memory',
  'used_swap',
  'total_swap',
  'total_space',
  'available_space',
  'read_speed',
  'write_speed',
  'receive_speed',
  'transmit_speed',
  'total_received',
  'total_transmitted',
  'load_one',
  'load_five',
  'load_fifteen',
  'uptime',
  'boot_time',
  'process_count',
  'tcp_connections',
  'udp_connections',
]
const META_KEYS = [
  'metadata_name',
  'metadata_region',
  'metadata_tags',
  'metadata_hidden',
  'metadata_virtualization',
  'metadata_latitude',
  'metadata_longitude',
  'metadata_order',
]
const DYN_INTERVAL_MS = 2000
const HISTORY_LIMIT = 120
const TCP_PING_INTERVAL_MS = 30_000
const TCP_PING_WINDOW_MS = 3 * 3600_000  // 每次查最近 3 小时
const TCP_PING_MAX = 2000                 // 每节点最多保留 2000 条（20s/条 × 3运营商 × 3h ≈ 1620）
const UPTIME_BUCKETS = 80
const UPTIME_BUCKET_MS = (24 * 3600_000) / UPTIME_BUCKETS

function emptyMeta(): NodeMeta {
  return { name: '', region: '', tags: [], hidden: false, virtualization: '', lat: null, lng: null, order: 0 }
}

function blankAgent(uuid: string, source: string): Agent {
  return { uuid, source, meta: emptyMeta(), static: {} }
}

function parseMeta(raw: Record<string, unknown>): NodeMeta {
  const lat = Number(raw.metadata_latitude)
  const lng = Number(raw.metadata_longitude)
  const order = Number(raw.metadata_order)
  return {
    name: raw.metadata_name ? String(raw.metadata_name) : '',
    region: raw.metadata_region ? String(raw.metadata_region) : '',
    tags: Array.isArray(raw.metadata_tags) ? raw.metadata_tags.filter(Boolean) : [],
    hidden: Boolean(raw.metadata_hidden),
    virtualization: raw.metadata_virtualization ? String(raw.metadata_virtualization) : '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    order: Number.isFinite(order) ? order : 0,
  }
}

function sampleFrom(row: DynamicSummary): HistorySample {
  const memTotal = row.total_memory || 0
  const diskTotal = row.total_space || 0
  return {
    t: row.timestamp,
    online: true,
    cpu: row.cpu_usage ?? null,
    mem: memTotal && row.used_memory != null ? (row.used_memory / memTotal) * 100 : null,
    disk:
      diskTotal && row.available_space != null
        ? ((diskTotal - row.available_space) / diskTotal) * 100
        : null,
    netIn: row.receive_speed ?? 0,
    netOut: row.transmit_speed ?? 0,
  }
}

export function useNodes(config: SiteConfig | null) {
  const [agents, setAgents] = useState<Map<string, Agent>>(new Map())
  // live 只在 nodes useMemo 中读取，不需要触发完整的状态更新路径，用 ref 存数据 + 版本号触发重渲染
  const liveRef = useRef<Map<string, DynamicSummary>>(new Map())
  const [liveVer, setLiveVer] = useState(0)
  const [history, setHistory] = useState<Map<string, HistorySample[]>>(new Map())
  const [tcpPingMap, setTcpPingMap] = useState<Map<string, TcpPingRecord[]>>(new Map())
  const [errors, setErrors] = useState<BackendError[]>([])
  const [loading, setLoading] = useState(true)
  const firstDynRef = useRef(false)
  const poolRef = useRef<BackendPool | null>(null)
  const historyFetchedRef = useRef<Set<string>>(new Set())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!config?.site_tokens?.length) {
      setLoading(false)
      return
    }
    setLoading(true)
    firstDynRef.current = false
    const pool = new BackendPool(config.site_tokens)
    poolRef.current = pool
    toast.info(`Connecting ${pool.entries.length} backend${pool.entries.length > 1 ? 's' : ''}…`, { id: 'boot' })
    const sourceUuids = new Map<string, string[]>()

    const bootstrap = async () => {
      // 每个 backend 独立发进度 toast（不再用 fanout 阻塞等到全部完成）
      const errs: BackendError[] = []
      const okList: { source: string; rows: string[] }[] = []
      await Promise.allSettled(
        pool.entries.map(async entry => {
          toast.info(`[${entry.name}] requesting agent list…`, { id: 'boot' })
          try {
            const rows = (await listAgentUuids(entry.client)) ?? []
            toast.success(`[${entry.name}] ${rows.length} agents registered`, { id: 'boot' })
            okList.push({ source: entry.name, rows })
          } catch (e) {
            toast.error(`[${entry.name}] list_agents failed`, { id: 'boot' })
            errs.push({ source: entry.name, error: e })
          }
        }),
      )
      setErrors(prev => [...prev, ...errs])

      const seed = new Map<string, Agent>()
      for (const { source, rows } of okList) {
        sourceUuids.set(source, rows)
        for (const uuid of rows) seed.set(uuid, blankAgent(uuid, source))
      }
      setAgents(seed)

      await Promise.all(
        pool.entries.map(async entry => {
          const uuids = sourceUuids.get(entry.name) || []
          if (!uuids.length) return
          toast.info(`[${entry.name}] loading meta+static · ${uuids.length} nodes…`, { id: 'boot' })

          const kvItems = uuids.flatMap(u => META_KEYS.map(k => ({ namespace: u, key: k })))
          const [meta, stat] = await Promise.allSettled([
            kvGetMulti(entry.client, kvItems),
            staticDataMulti(entry.client, uuids, STATIC_FIELDS),
          ])

          setAgents(prev => {
            const next = new Map(prev)

            if (meta.status === 'fulfilled' && meta.value) {
              const grouped = new Map<string, Record<string, unknown>>()
              for (const row of meta.value) {
                if (!row || row.value == null) continue
                let bucket = grouped.get(row.namespace)
                if (!bucket) grouped.set(row.namespace, (bucket = {}))
                bucket[row.key] = row.value
              }
              for (const uuid of uuids) {
                const cur = next.get(uuid) ?? blankAgent(uuid, entry.name)
                next.set(uuid, { ...cur, meta: parseMeta(grouped.get(uuid) ?? {}) })
              }
            }

            if (stat.status === 'fulfilled' && stat.value) {
              for (const row of stat.value) {
                if (!row.uuid) continue
                const cur = next.get(row.uuid) ?? blankAgent(row.uuid, entry.name)
                next.set(row.uuid, { ...cur, static: row })
              }
            }
            return next
          })
          toast.success(`[${entry.name}] meta+static loaded · ${uuids.length} nodes`, { id: 'boot' })
        }),
      )

      await Promise.all([tickDynamic(), tickTcpPing()])
      // 兜底：若所有节点真的离线（无 dynamic 数据），依然结束 loading
      if (!firstDynRef.current) setLoading(false)
    }

    let dynPending = false
    const tickDynamic = async () => {
      if (dynPending) return
      dynPending = true
      try {
        const updates: DynamicSummary[] = []
        await Promise.allSettled(
          pool.entries.map(async entry => {
            const uuids = sourceUuids.get(entry.name) || []
            if (!uuids.length) return
            try {
              const rows = await dynamicSummaryMulti(entry.client, uuids, DYNAMIC_FIELDS)
              for (const row of rows || []) updates.push(row)
            } catch {}
          }),
        )
        if (!updates.length) return

        // 直接 mutate ref，无需克隆整个 Map
        for (const row of updates) liveRef.current.set(row.uuid, row)

        startTransition(() => {
          if (!firstDynRef.current && updates.length > 0) {
            firstDynRef.current = true
            setLoading(false)
            // 最后一条简短显示，然后清空所有 boot toast
            toast.success(`Dynamic stream live · +${updates.length} updates`, { id: 'boot', duration: 1500 })
            setTimeout(() => toast.dismiss('boot'), 1600)
          }
          setLiveVer(v => v + 1)
          setHistory(prev => {
            let next: Map<string, HistorySample[]> | null = null
            for (const row of updates) {
              const arr = prev.get(row.uuid) || []
              const sample = sampleFrom(row)
              // 时间戳相同说明本轮没有新数据，跳过
              if (arr.length && arr[arr.length - 1].t === sample.t) continue
              if (!next) next = new Map(prev)  // 懒克隆：只有真正有变化才分配
              // slice(1)+push 比 concat+slice 少一次数组分配
              const newArr = arr.length >= HISTORY_LIMIT ? arr.slice(1) : arr.slice()
              newArr.push(sample)
              next.set(row.uuid, newArr)
            }
            return next ?? prev  // 没有任何变化时返回原引用，React 跳过重渲染
          })
        })
      } finally {
        dynPending = false
      }
    }

    const tickTcpPing = async () => {
      const now = Date.now()
      const from = now - TCP_PING_WINDOW_MS
      const byUuid = new Map<string, TcpPingRecord[]>()
      const results = await Promise.allSettled(
        pool.entries.map(async entry => {
          const rows = await queryTcpPings(entry.client, from, now)
          for (const r of rows || []) {
            if (!r.uuid || r.timestamp == null) continue
            const record: TcpPingRecord = { t: r.timestamp, cron: r.cron_source ?? '未知', latency: r.task_event_result?.tcp_ping ?? null }
            const arr = byUuid.get(r.uuid) ?? []
            arr.push(record)
            byUuid.set(r.uuid, arr)
          }
        }),
      )
      for (const r of results) {
        if (r.status === 'rejected') console.warn('[tcpping]', r.reason)
      }
      if (!byUuid.size) return
      setTcpPingMap(prev => {
        const next = new Map(prev)
        for (const [uuid, records] of byUuid) {
          const existing = prev.get(uuid) ?? []
          const merged = [...existing, ...records]
          const seen = new Set<string>()
          const deduped = merged.filter(r => {
            const key = `${r.t}-${r.cron}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          deduped.sort((a, b) => a.t - b.t)
          next.set(uuid, deduped.slice(-TCP_PING_MAX))
        }
        return next
      })
    }

    const ac = new AbortController()

    bootstrap().catch((e: unknown) => {
      setErrors(prev => [...prev, { source: '*', error: e }])
      setLoading(false)
    })

    ;(async () => {
      while (!ac.signal.aborted) {
        await new Promise(r => setTimeout(r, DYN_INTERVAL_MS))
        if (!ac.signal.aborted) await tickDynamic()
      }
    })()

    ;(async () => {
      while (!ac.signal.aborted) {
        await new Promise(r => setTimeout(r, TCP_PING_INTERVAL_MS))
        if (!ac.signal.aborted) await tickTcpPing()
      }
    })()

    const onVisible = () => {
      if (document.visibilityState === 'visible') tickDynamic()
    }
    document.addEventListener('visibilitychange', onVisible)

    const clockTimer = setInterval(() => setTick(t => t + 1), 5000)

    return () => {
      ac.abort()
      clearInterval(clockTimer)
      document.removeEventListener('visibilitychange', onVisible)
      poolRef.current = null
      pool.close()
    }
  }, [config])

  const fetchNodeTcpHistory = useCallback(async (uuid: string): Promise<TcpPingRecord[]> => {
    const pool = poolRef.current
    if (!pool) return []
    const now = Date.now()
    const from = now - 6 * 3600_000
    const results: TcpPingRecord[] = []
    await Promise.allSettled(
      pool.entries.map(async entry => {
        try {
          const rows = await queryNodeTcpPings(entry.client, uuid, from, now)
          for (const r of rows || []) {
            if (!r.uuid || r.timestamp == null) continue
            results.push({ t: r.timestamp, cron: r.cron_source ?? '未知', latency: r.task_event_result?.tcp_ping ?? null })
          }
        } catch {}
      }),
    )
    return results.sort((a, b) => a.t - b.t)
  }, [])

  const nodes = useMemo(() => {
    const now = Date.now()
    const out = new Map<string, Node>()
    for (const [uuid, a] of agents) {
      const dyn = liveRef.current.get(uuid) || null
      out.set(uuid, {
        ...a,
        dynamic: dyn,
        history: history.get(uuid) || [],
        tcpPings: tcpPingMap.get(uuid) || [],
        online: isOnline(dyn?.timestamp, now),
      })
    }
    return out
  }, [agents, liveVer, history, tcpPingMap, tick])

  const fetchCardHistory = useCallback((uuid: string, visible: boolean) => {
    if (!visible) return
    if (historyFetchedRef.current.has(uuid)) return
    const pool = poolRef.current
    if (!pool) return
    historyFetchedRef.current.add(uuid)
    const now = Date.now()
    const from = now - HISTORY_LIMIT * DYN_INTERVAL_MS
    Promise.allSettled(
      pool.entries.map(async entry => {
        try {
          const rows = await querySummaryHistory(entry.client, uuid, from, now, DYNAMIC_FIELDS, HISTORY_LIMIT)
          if (!rows?.length) return
          startTransition(() => {
            setHistory(prev => {
              const existing = prev.get(uuid) || []
              // 合并：后端历史 + 已有实时数据，去重，按时间排序，取最近 HISTORY_LIMIT 条
              const merged = [...rows.map(sampleFrom), ...existing]
              const seen = new Set<number>()
              const deduped = merged.filter(s => {
                if (seen.has(s.t)) return false
                seen.add(s.t)
                return true
              })
              deduped.sort((a, b) => a.t - b.t)
              const next = new Map(prev)
              next.set(uuid, deduped.slice(-HISTORY_LIMIT))
              return next
            })
          })
        } catch {}
      }),
    )
  }, [])

  const fetchUptimeHistory = useCallback(async (uuid: string): Promise<HistorySample[]> => {
    const pool = poolRef.current
    if (!pool) return []
    const entry = pool.entries[0]
    if (!entry) return []
    const now = Date.now()
    const from = now - 24 * 3600_000
    let rows: { timestamp?: number | null }[] = []
    try {
      rows = await querySummaryHistory(entry.client, uuid, from, now, ['uptime']) ?? []
    } catch {
      return []
    }
    const bucketCount = new Array<number>(UPTIME_BUCKETS).fill(0)
    for (const r of rows) {
      if (r.timestamp == null) continue
      const idx = Math.floor((r.timestamp - from) / UPTIME_BUCKET_MS)
      if (idx >= 0 && idx < UPTIME_BUCKETS) bucketCount[idx]++
    }
    const maxPerBucket = UPTIME_BUCKET_MS / DYN_INTERVAL_MS
    // 从第一个有数据的桶开始，之前的让 UptimeBars 用灰色 pad 填充
    // 区分"节点未部署（无数据）"和"节点离线（曾在线过）"
    const firstNonZero = bucketCount.findIndex(v => v > 0)
    const start = firstNonZero >= 0 ? firstNonZero : UPTIME_BUCKETS
    return bucketCount.slice(start).map((count, i) => ({
      t: from + (start + i + 0.5) * UPTIME_BUCKET_MS,
      online: count > 0,
      rate: Math.min(1, count / maxPerBucket),
      cpu: null,
      mem: null,
      disk: null,
      netIn: 0,
      netOut: 0,
    }))
  }, [])

  // 给所有节点 prefetch 较长的历史窗口（用于全局 K 线指数等）
  // minutes: 拉取窗口长度（分钟）
  const prefetchAllHistory = useCallback(async (uuids: string[], minutes = 30) => {
    const pool = poolRef.current
    if (!pool || !uuids.length) return
    const now = Date.now()
    const from = now - minutes * 60_000
    const limit = Math.ceil((minutes * 60_000) / DYN_INTERVAL_MS) + 50
    // 并发上限：每节点对所有 backend entry 并行；总体节点也并行（小项目通常没几十个节点）
    await Promise.allSettled(
      uuids.map(uuid =>
        Promise.allSettled(
          pool.entries.map(async entry => {
            try {
              const rows = await querySummaryHistory(entry.client, uuid, from, now, DYNAMIC_FIELDS, limit)
              if (!rows?.length) return
              startTransition(() => {
                setHistory(prev => {
                  const existing = prev.get(uuid) || []
                  const merged = [...rows.map(sampleFrom), ...existing]
                  const seen = new Set<number>()
                  const deduped = merged.filter(s => {
                    if (seen.has(s.t)) return false
                    seen.add(s.t)
                    return true
                  })
                  deduped.sort((a, b) => a.t - b.t)
                  // 拉长 limit 以容纳长窗口数据，但每节点不超过 limit 条
                  const next = new Map(prev)
                  next.set(uuid, deduped.slice(-limit))
                  return next
                })
              })
            } catch {}
          }),
        ),
      ),
    )
  }, [])

  return { nodes, errors, loading, fetchNodeTcpHistory, fetchCardHistory, fetchUptimeHistory, prefetchAllHistory }
}
