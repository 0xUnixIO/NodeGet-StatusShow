import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from 'react'
import { AnimatePresence } from 'motion/react'
import { AlertTriangle, Map as MapIcon } from 'lucide-react'
import { LoadingScreen } from './components/LoadingScreen'
import { Toaster } from './components/ui/sonner'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { useConfig } from './hooks/useConfig'
import { useNodes } from './hooks/useNodes'
import { Background } from './components/Background'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { WatchList } from './components/TradingView'
import { MarketStrip } from './components/MarketStrip'
import { IndexChart } from './components/IndexChart'
import { TimeAndSales, useTickEvents } from './components/TimeAndSales'
import { OptionsChain } from './components/OptionsChain'
import { Heatmap } from './components/Heatmap'
import { AlertBanner } from './components/AlertBanner'
import { WorldMap } from './components/WorldMap'
import { NodeDetail } from './components/NodeDetail'
import { TagFilter } from './components/TagFilter'
import type { View } from './types'

const DEFAULT_LOGO = `${import.meta.env.BASE_URL}logo.png`

function initialView(): View {
  return 'cards'
}

export function App() {
  const { config, error: configError } = useConfig()
  const { nodes, errors, loading, fetchNodeTcpHistory, fetchCardHistory, fetchUptimeHistory, prefetchAllHistory } = useNodes(config)
  const deferredNodes = useDeferredValue(nodes)

  // 顶部 sticky 区高度（用于让 NodeDetail aside 贴在它下方而不是被遮挡）
  const topStickyRef = useRef<HTMLDivElement>(null)
  const [topH, setTopH] = useState(0)
  useEffect(() => {
    const el = topStickyRef.current
    if (!el) return
    const ro = new ResizeObserver(es => {
      for (const e of es) setTopH(Math.round(e.contentRect.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 左侧 WatchList 高度，用来限制右侧 aside 不超过左边
  const [leftH, setLeftH] = useState(0)
  const leftRoRef = useRef<ResizeObserver | null>(null)
  const leftPaneRef = useCallback((el: HTMLDivElement | null) => {
    if (leftRoRef.current) {
      leftRoRef.current.disconnect()
      leftRoRef.current = null
    }
    if (!el) {
      setLeftH(0)
      return
    }
    setLeftH(Math.round(el.getBoundingClientRect().height))
    const ro = new ResizeObserver(es => {
      for (const e of es) setLeftH(Math.round(e.contentRect.height))
    })
    ro.observe(el)
    leftRoRef.current = ro
  }, [])

  // 节点列表加载后，主动 prefetch 所有节点最近 30 分钟历史，喂给全局 K 线图
  const prefetchedRef = useRef(false)
  useEffect(() => {
    if (prefetchedRef.current) return
    if (nodes.size === 0) return
    prefetchedRef.current = true
    prefetchAllHistory([...nodes.keys()], 30)
  }, [nodes, prefetchAllHistory])

  const [view, setView] = useState<View>(initialView)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeRegion, setActiveRegion] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (config?.site_name) document.title = config.site_name
  }, [config?.site_name])

  // 选中节点不再写入 URL hash —— 仅作为本地状态弹窗使用

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of deferredNodes.values()) {
      if (n.meta?.hidden) continue
      for (const t of n.meta?.tags ?? []) set.add(t)
    }
    return [...set].sort()
  }, [deferredNodes])

  const regionCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const n of deferredNodes.values()) {
      if (n.meta?.hidden) continue
      const r = n.meta?.region?.trim().toUpperCase()
      if (r) map.set(r, (map.get(r) ?? 0) + 1)
    }
    return map
  }, [deferredNodes])

  const allRegions = useMemo(() =>
    [...regionCounts.keys()].sort(),
    [regionCounts],
  )

  useEffect(() => {
    if (activeTag && !allTags.includes(activeTag)) setActiveTag(null)
  }, [allTags, activeTag])

  useEffect(() => {
    if (activeRegion && !allRegions.includes(activeRegion)) setActiveRegion(null)
  }, [allRegions, activeRegion])

  const list = useMemo(() => {
    let arr = [...deferredNodes.values()].filter(n => !n.meta?.hidden)
    // tag / region 不再过滤，改由 WatchList 灰显未匹配项
    const q = query.trim().toLowerCase()
    if (q) {
      arr = arr.filter(n => {
        const hay = [
          n.uuid,
          n.source,
          n.meta?.name,
          n.meta?.region,
          n.meta?.virtualization,
          n.static?.system?.system_host_name,
          n.static?.system?.system_name,
          ...(n.meta?.tags ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }

    return arr.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1
      const ao = a.meta?.order ?? 0
      const bo = b.meta?.order ?? 0
      if (ao !== bo) return ao - bo
      const an = a.meta?.name || a.uuid
      const bn = b.meta?.name || b.uuid
      return an.localeCompare(bn)
    })
  }, [deferredNodes, query])

  const selectedNode = selected ? nodes.get(selected) || null : null

  // hooks 必须在所有 early return 之前
  const allNodesForEvents = useMemo(
    () => [...deferredNodes.values()].filter(n => !n.meta?.hidden),
    [deferredNodes],
  )
  const tickEvents = useTickEvents(allNodesForEvents)


  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>加载 config.json 失败</AlertTitle>
          <AlertDescription>{String(configError.message || configError)}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!config) {
    return <LoadingScreen />
  }

  const logo = config.site_logo || DEFAULT_LOGO
  const empty = list.length === 0
  const hasErrors = errors.length > 0
  const allNodes = allNodesForEvents
  // 只要已经有节点（来自 WS / 静态接口），就不再显示 LoadingScreen
  const showLoading = loading && empty

  return (
    <div className="min-h-screen flex flex-col">
      <Background />

      {/* 顶部导航栏 */}
      <Navbar
        siteName={config.site_name || '节点监控'}
        logo={logo}
        regions={allRegions}
        regionCounts={regionCounts}
        activeRegion={activeRegion}
        onRegionChange={setActiveRegion}
        onHome={() => {
          setActiveRegion(null)
          setActiveTag(null)
          setQuery('')
          setSelected(null)
          setView('cards')
        }}
      />

      {/* 主内容（全宽） */}
      <main className="flex-1 min-w-0 pt-11 pb-0 space-y-0">

        {/* 地图视图 */}
        {view === 'map' && (
          <div className="space-y-3 max-w-4xl mx-auto p-4">
            <WorldMap nodes={list} onSelect={setSelected} />
          </div>
        )}

        {view !== 'map' && (<>
          {/* 顶部 sticky 复合区：MarketStrip + Ticker + IndexChart + TagFilter，滚动 WatchList 时持续可见 */}
          <div ref={topStickyRef} className="sticky top-11 z-30 backdrop-blur-sm">
            {/* 顶部：左 KPI + 右 Ticker 跑马灯（彭博/雅虎财经风），全宽紧贴 */}
            {!showLoading && !empty && (
              <div
                className="flex flex-col lg:flex-row items-stretch overflow-hidden"
                style={{
                  background: 'hsl(var(--card) / 0.65)',
                  borderBottom: '1px solid hsl(var(--border) / 0.6)',
                }}
              >
                <div
                  className="shrink-0 lg:border-r"
                  style={{ borderColor: 'hsl(var(--border) / 0.6)' }}
                >
                  <MarketStrip nodes={allNodes} onViewMap={() => setView('map')} embedded showWorldMap={false} />
                </div>
                <button
                  type="button"
                  onClick={() => setView('map')}
                  className="flex shrink-0 items-center justify-center gap-2 px-4 py-2 lg:py-0 text-[10px] uppercase tracking-[0.2em] font-bold transition-colors hover:bg-[hsl(var(--secondary))] border-t lg:border-t-0 lg:border-l"
                  style={{ color: 'hsl(var(--nx-text-secondary))', borderColor: 'hsl(var(--border) / 0.6)' }}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Map
                </button>
              </div>
            )}

            {!showLoading && !empty && <AlertBanner nodes={allNodes} onSelect={setSelected} />}

            {/* 大盘指数走势图（聚合 avg CPU/MEM） */}
            {!showLoading && !empty && (
              <IndexChart nodes={allNodes} />
            )}

            {/* 筛选栏：紧贴上方边框、全宽嵌入式 */}
            {allTags.length > 0 && (
              <div
                className="px-3 py-1"
                style={{
                  background: 'hsl(var(--card) / 0.7)',
                  borderBottom: '1px solid hsl(var(--border) / 0.5)',
                }}
              >
                <TagFilter tags={allTags} active={activeTag} onChange={setActiveTag} />
              </div>
            )}
          </div>

          {/* 加载状态 */}
          <AnimatePresence>
            {showLoading && !hasErrors && <LoadingScreen key="loading" />}
          </AnimatePresence>

          {!showLoading && empty && hasErrors && (
            <div className="py-20 text-center text-muted-foreground">暂无节点</div>
          )}

          {/* 节点列表（双栏：左 Watchlist + 右 Detail/Time&Sales，紧贴 0 gap） */}
          {!showLoading && !empty && (
            <div className="flex items-start">
              <div ref={leftPaneRef} className="flex-1 min-w-0">
                <WatchList nodes={list} selected={selected} activeTag={activeTag} activeRegion={activeRegion} onSelect={setSelected} />
              </div>
              {isWide && (
                <aside
                  className="w-[420px] xl:w-[480px] 2xl:w-[560px] shrink-0 sticky overflow-hidden backdrop-blur-sm"
                  style={{
                    top: 44 + topH,
                    height: leftH > 0
                      ? `min(${leftH}px, calc(100vh - ${44 + topH + 28}px))`
                      : `calc(100vh - ${44 + topH + 28}px)`,
                    background: 'hsl(var(--card) / 0.7)',
                    borderLeft: '1px solid hsl(var(--border) / 0.6)',
                  }}
                >
                  <div className="h-full flex flex-col overflow-y-auto">
                    <div className="shrink-0 border-b" style={{ borderColor: 'hsl(var(--border) / 0.6)' }}>
                      <Heatmap nodes={allNodes} onSelect={setSelected} />
                    </div>
                    <div className="shrink-0 border-b" style={{ borderColor: 'hsl(var(--border) / 0.6)' }}>
                      <OptionsChain nodes={allNodes} onSelect={setSelected} />
                    </div>
                    <div className="flex-1 min-h-0">
                      <TimeAndSales events={tickEvents} />
                    </div>
                  </div>
                </aside>
              )}
            </div>
          )}
        </>)}

        {/* 错误提示 */}
        {hasErrors && (
          <div className="px-3 py-2">
            <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{errors.length} 个后端错误</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {errors.map((e, i) => (
                  <li key={i}>
                    <b>{e.source}</b>：
                    {e.error instanceof Error ? e.error.message : String(e.error)}
                  </li>
                ))}
              </ul>
            </AlertDescription>
            </Alert>
          </div>
        )}
      </main>

      <Footer text={config.footer} nodes={allNodes} />

      {/* 节点详情：始终以全屏模态显示 */}
      <NodeDetail
        node={selectedNode}
        onClose={() => setSelected(null)}
        showSource={(config.site_tokens?.length ?? 0) > 1}
        fetchTcpHistory={fetchNodeTcpHistory}
        fetchUptimeHistory={fetchUptimeHistory}
      />
      <Toaster />
    </div>
  )
}
