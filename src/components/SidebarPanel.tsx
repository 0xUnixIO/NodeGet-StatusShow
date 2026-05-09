import { useMemo, useRef, useState, useEffect } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import worldAtlas from 'world-atlas/countries-110m.json'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { geoContains } from 'd3-geo'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { bytes } from '../utils/format'
import { useTheme } from '../hooks/useTheme'
import { resolveCoords } from '../utils/coords'
import type { Node } from '../types'

const geoFeatures = feature(
  worldAtlas as unknown as Topology<{ countries: GeometryCollection }>,
  (worldAtlas as unknown as Topology<{ countries: GeometryCollection }>).objects.countries,
)

interface Props {
  nodes: Node[]
  onViewMap?: () => void
}


/* ── 实时带宽历史 hook ── */
type BwPoint = { t: number; netIn: number; netOut: number }

function useBandwidthHistory(netIn: number, netOut: number, maxPoints = 50): BwPoint[] {
  const ref = useRef<BwPoint[]>([])
  const [data, setData] = useState<BwPoint[]>([])
  useEffect(() => {
    const now = Date.now()
    const prev = ref.current[ref.current.length - 1]
    if (prev && now - prev.t < 1500) return
    const next = [...ref.current, { t: now, netIn, netOut }].slice(-maxPoints)
    ref.current = next
    setData(next)
  }, [netIn, netOut])
  return data
}

/* ── 带宽折线图 ── */
function BandwidthChart({ netIn, netOut }: { netIn: number; netOut: number }) {
  const history = useBandwidthHistory(netIn, netOut)

  function fmtBw(v: number) {
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
    return `${Math.round(v)}B`
  }

  function fmtTime(t: number) {
    return new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center text-[10px]"
        style={{ height: 72, color: 'hsl(var(--nx-text-dim))' }}>
        收集中…
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={72}>
      <LineChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="t" hide />
        <YAxis
          tickFormatter={fmtBw}
          tick={{ fontSize: 8, fill: 'hsl(var(--nx-text-dim))' }}
          width={28}
          tickLine={false}
          axisLine={false}
          domain={[0, 'auto']}
        />
        <Tooltip
          isAnimationActive={false}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const t = (payload[0]?.payload as BwPoint)?.t
            return (
              <div className="rounded border px-2 py-1.5 shadow text-[10px] space-y-0.5"
                style={{ background: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}>
                <div style={{ color: 'hsl(var(--nx-text-dim))' }}>{fmtTime(t)}</div>
                {payload.map(p => (
                  <div key={p.dataKey as string} className="flex items-center gap-1.5">
                    <span style={{ color: p.color }}>{p.dataKey === 'netIn' ? '↓' : '↑'}</span>
                    <span style={{ color: p.color }} className="font-mono">
                      {bytes(p.value as number)}/s
                    </span>
                  </div>
                ))}
              </div>
            )
          }}
          cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '3 2' }}
        />
        <Line type="monotone" dataKey="netIn" stroke="hsl(142 71% 45%)" strokeWidth={1.5}
          dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="netOut" stroke="hsl(0 72% 56%)" strokeWidth={1.5}
          dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function MiniMap({ nodes, onViewMap }: { nodes: Node[]; onViewMap?: () => void }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const markers = useMemo(() => {
    const result: { uuid: string; lat: number; lng: number; online: boolean }[] = []
    for (const n of nodes) {
      const coords = resolveCoords(n.meta ?? undefined)
      if (coords) result.push({ uuid: n.uuid, lat: coords[1], lng: coords[0], online: n.online })
    }
    return result
  }, [nodes])

  // 计算有节点的国家 ID 集合
  const litCountries = useMemo(() => {
    const ids = new Set<string>()
    for (const m of markers) {
      for (const geo of geoFeatures.features) {
        if (geoContains(geo, [m.lng, m.lat])) {
          ids.add(String(geo.id))
          break
        }
      }
    }
    return ids
  }, [markers])

  // 根据节点位置动态计算中心和缩放
  const { center, scale } = useMemo(() => {
    if (!markers.length) return { center: [10, 20] as [number, number], scale: 85 }
    const lngs = markers.map(m => m.lng)
    const lats = markers.map(m => m.lat)
    const cLng = lngs.reduce((a, b) => a + b, 0) / lngs.length
    const cLat = Math.max(-50, Math.min(65, lats.reduce((a, b) => a + b, 0) / lats.length))
    const lonSpan = Math.max(...lngs) - Math.min(...lngs)
    const latSpan = Math.max(...lats) - Math.min(...lats)
    // 加 padding，取 lon/lat 中较大的作为基准
    const span = Math.max(lonSpan + 50, latSpan * 2 + 50, 80)
    const s = Math.max(60, Math.min(220, Math.round(85 * 360 / span)))
    return { center: [cLng, cLat] as [number, number], scale: s }
  }, [markers])

  if (markers.length === 0) return null

  return (
    <div
      className="rounded-lg overflow-hidden relative group"
      onClick={onViewMap}
      style={{ background: isDark ? '#060d1a' : '#b0c4d8', cursor: onViewMap ? 'pointer' : 'default' }}
      title="点击查看完整地图"
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale, center }}
        style={{ width: '100%', height: '110px', display: 'block' }}
      >
        <Geographies geography={geoFeatures}>
          {({ geographies }) =>
            geographies.map(geo => {
              const isLit = litCountries.has(String(geo.id))
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isLit
                    ? (isDark ? '#065f46' : '#6ee7b7')
                    : (isDark ? '#11324a' : '#cfdce8')}
                  stroke={isDark ? 'rgba(103,232,249,0.15)' : 'rgba(70,95,115,0.3)'}
                  strokeWidth={0.4}
                  style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                />
              )
            })
          }
        </Geographies>
        {markers.map((m, i) => (
          <Marker key={m.uuid} coordinates={[m.lng, m.lat]}>
            {/* 在线节点脉冲扩散圈 */}
            {m.online && (
              <circle r={4} fill="#10b981" stroke="none" opacity={0}>
                <animate
                  attributeName="r"
                  from="3" to="10"
                  dur="2.4s"
                  begin={`${(i % 6) * 0.4}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.5" to="0"
                  dur="2.4s"
                  begin={`${(i % 6) * 0.4}s`}
                  repeatCount="indefinite"
                />
              </circle>
            )}
            {/* 节点实心圆点 */}
            <circle
              r={m.online ? 3.5 : 2.5}
              fill={m.online ? '#10b981' : '#f43f5e'}
              stroke={m.online ? '#d1fae5' : '#fecdd3'}
              strokeWidth={1}
            />
          </Marker>
        ))}
      </ComposableMap>
      {/* hover 遮罩提示 */}
      {onViewMap && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.25)' }}>
          <span className="text-white text-[11px] font-medium px-2 py-1 rounded"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            查看完整地图
          </span>
        </div>
      )}
    </div>
  )
}

export function SidebarPanel({ nodes, onViewMap }: Props) {
  const stats = useMemo(() => {
    const total = nodes.length
    const online = nodes.filter(n => n.online).length
    const offline = total - online

    const netUp   = nodes.reduce((s, n) => s + (n.dynamic?.transmit_speed ?? 0), 0)
    const netDown = nodes.reduce((s, n) => s + (n.dynamic?.receive_speed ?? 0), 0)

    const totalUp   = nodes.reduce((s, n) => s + (n.dynamic?.total_transmitted ?? 0), 0)
    const totalDown = nodes.reduce((s, n) => s + (n.dynamic?.total_received ?? 0), 0)

    // 全局平均 CPU/MEM 指数
    const onlineNodes = nodes.filter(n => n.online && n.dynamic)
    let cpuSum = 0, cpuCnt = 0
    let memUsed = 0, memTotal = 0
    for (const n of onlineNodes) {
      if (n.dynamic?.cpu_usage != null) { cpuSum += n.dynamic.cpu_usage; cpuCnt++ }
      memUsed  += n.dynamic?.used_memory ?? 0
      memTotal += n.dynamic?.total_memory ?? 0
    }
    const avgCpu = cpuCnt ? cpuSum / cpuCnt : null
    const avgMem = memTotal ? (memUsed / memTotal) * 100 : null

    return { total, online, offline, netUp, netDown, totalUp, totalDown, avgCpu, avgMem }
  }, [nodes])

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[9px] font-bold uppercase tracking-[0.22em] mb-2" style={{ color: 'hsl(var(--nx-text-muted))' }}>
      {children}
    </p>
  )

  return (
    <div className="p-4 flex flex-col gap-5 font-mono">

      {/* MARKET INDEX：全局聚合指标 */}
      <div>
        <SectionTitle>Market Index</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <div className="border px-2 py-1.5" style={{ borderColor: 'hsl(var(--border) / 0.5)', background: 'hsl(var(--card) / 0.5)' }}>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'hsl(var(--nx-text-dim))' }}>CPU</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: stats.avgCpu != null && stats.avgCpu >= 70 ? 'hsl(20 90% 60%)' : 'hsl(var(--nx-text-primary))' }}>
              {stats.avgCpu != null ? `${stats.avgCpu.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="border px-2 py-1.5" style={{ borderColor: 'hsl(var(--border) / 0.5)', background: 'hsl(var(--card) / 0.5)' }}>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'hsl(var(--nx-text-dim))' }}>MEM</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: stats.avgMem != null && stats.avgMem >= 80 ? 'hsl(20 90% 60%)' : 'hsl(var(--nx-text-primary))' }}>
              {stats.avgMem != null ? `${stats.avgMem.toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* BREADTH：在线/离线 涨跌家数 */}
      <div>
        <SectionTitle>Breadth</SectionTitle>
        <div className="leading-none tracking-tight"
          style={{ fontSize: 44, fontWeight: 200, color: 'hsl(var(--foreground))' }}>
          {stats.online}
          <span className="text-base font-normal" style={{ color: 'hsl(var(--muted-foreground))' }}>
            /{stats.total}
          </span>
        </div>

        {/* 每节点状态格 */}
        <div className="flex gap-0.5 h-1 mt-3">
          {nodes.map(n => (
            <div
              key={n.uuid}
              className="flex-1"
              style={{ background: n.online ? 'hsl(142 71% 45%)' : 'hsl(var(--border))' }}
            />
          ))}
        </div>

        {/* 涨跌家数风格 */}
        <div className="flex justify-between mt-2 text-[11px] tabular-nums">
          <span className="flex items-center gap-1" style={{ color: 'hsl(142 71% 45%)' }}>
            <span>▲</span>
            <span className="font-bold">{stats.online}</span>
            <span className="text-[9px] opacity-70">UP</span>
          </span>
          {stats.offline > 0 && (
            <span className="flex items-center gap-1" style={{ color: 'hsl(0 72% 56%)' }}>
              <span>▼</span>
              <span className="font-bold">{stats.offline}</span>
              <span className="text-[9px] opacity-70">DOWN</span>
            </span>
          )}
        </div>
      </div>

      {/* VOLUME：实时带宽 */}
      <div>
        <SectionTitle>Volume — Live</SectionTitle>
        {/* 当前数值 */}
        <div className="flex items-center justify-between text-xs mb-2 tabular-nums">
          <span className="flex items-center gap-1" style={{ color: 'hsl(0 72% 56%)' }}>
            <ArrowUp className="h-3 w-3" />
            <span className="font-bold">{bytes(stats.netUp)}/s</span>
          </span>
          <span className="flex items-center gap-1" style={{ color: 'hsl(142 71% 45%)' }}>
            <ArrowDown className="h-3 w-3" />
            <span className="font-bold">{bytes(stats.netDown)}/s</span>
          </span>
        </div>
        {/* 历史折线图 */}
        <BandwidthChart netIn={stats.netDown} netOut={stats.netUp} />
        {/* 图例 */}
        <div className="flex items-center gap-3 mt-1 tabular-nums">
          {[
            ['hsl(0 72% 56%)', '↑ TX'],
            ['hsl(142 71% 45%)', '↓ RX'],
          ].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1" style={{ fontSize: 9, color: c }}>
              <span className="inline-block w-4 h-0.5 rounded" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* AGGREGATE：累计流量 */}
      <div>
        <SectionTitle>Aggregate Volume</SectionTitle>
        <div className="flex flex-col gap-2">
          <BandwidthRow
            icon={<ArrowUp className="h-3.5 w-3.5" />}
            label="TX TOTAL"
            value={bytes(stats.totalUp)}
            color="hsl(0 72% 56%)"
          />
          <BandwidthRow
            icon={<ArrowDown className="h-3.5 w-3.5" />}
            label="RX TOTAL"
            value={bytes(stats.totalDown)}
            color="hsl(142 71% 45%)"
          />
        </div>
      </div>

      {/* 迷你地图 */}
      <MiniMap nodes={nodes} onViewMap={onViewMap} />
    </div>
  )
}

function StatusRow({
  color, label, count, total,
}: {
  color: string
  label: string
  count: number
  total: number
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: color }}
          />
          <span style={{ color: 'hsl(var(--nx-text-secondary))' }}>{label}</span>
        </span>
        <span
          className="font-semibold tabular-nums"
          style={{ color: 'hsl(var(--nx-text-primary))' }}
        >
          {count}
        </span>
      </div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: 'hsl(var(--border))' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function BandwidthRow({
  icon, label, value, color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span style={{ color: 'hsl(var(--nx-text-secondary))' }}>{label}</span>
      </span>
      <span
        className="font-mono font-medium tabular-nums"
        style={{ color: 'hsl(var(--nx-text-primary))' }}
      >
        {value}
      </span>
    </div>
  )
}
