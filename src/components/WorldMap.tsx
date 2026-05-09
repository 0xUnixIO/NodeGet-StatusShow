import { memo, useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { geoContains } from 'd3-geo'
import worldAtlas from 'world-atlas/countries-110m.json'
import { useTheme } from '../hooks/useTheme'
import { cn } from '../utils/cn'
import { resolveCoords } from '../utils/coords'
import type { Node } from '../types'

const geoFeatures = feature(
  worldAtlas as unknown as Topology<{ countries: GeometryCollection }>,
  (worldAtlas as unknown as Topology<{ countries: GeometryCollection }>).objects.countries,
)


interface Point {
  uuid: string
  name: string
  region: string
  lng: number
  lat: number
  online: boolean
  cpu: number | null
  mem: number | null
  netIn: number
  netOut: number
  uptime: number | null
}

interface Cluster {
  key: string
  lat: number
  lng: number
  points: Point[]
}

interface ClusterTooltip {
  cluster: Cluster
  x: number
  y: number
}

interface GeoTooltip {
  name: string
  x: number
  y: number
}

const LIGHT = {
  bg: '#b0c4d8',
  fill: '#cfdce8',
  fillHover: '#b8ccda',
  stroke: 'rgba(70,95,115,0.4)',
  nodeCountry: '#6ee7b7',
  nodeCountryHover: '#34d399',
}

const DARK = {
  bg: '#060d1a',
  fill: '#11324a',
  fillHover: '#1e4f6d',
  stroke: 'rgba(103,232,249,0.2)',
}

// 节点数 → 绿色深度（count/max 归一化到 0-1，线性插值 hex）
function lerpHex(a: string, b: string, t: number): string {
  const p = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16)
  const r = Math.round(p(a, 1) + (p(b, 1) - p(a, 1)) * t)
  const g = Math.round(p(a, 3) + (p(b, 3) - p(a, 3)) * t)
  const bl = Math.round(p(a, 5) + (p(b, 5) - p(a, 5)) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

function nodeCountryColor(count: number, max: number, dark: boolean, hover = false): string {
  const t = max <= 1 ? 1 : (count - 1) / (max - 1)
  if (dark) {
    const fill = lerpHex('#065f46', '#10b981', t)   // emerald-800 → emerald-500
    const h = lerpHex('#047857', '#34d399', t)
    return hover ? h : fill
  }
  const fill = lerpHex('#a7f3d0', '#059669', t)     // emerald-200 → emerald-600
  const h = lerpHex('#6ee7b7', '#047857', t)
  return hover ? h : fill
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export const WorldMap = memo(function WorldMap({
  nodes,
  onSelect,
}: {
  nodes: Node[]
  onSelect: (uuid: string) => void
}) {
  const { theme } = useTheme()
  const c = theme === 'dark' ? DARK : LIGHT

  const [clusterTooltip, setClusterTooltip] = useState<ClusterTooltip | null>(null)
  const [geoTooltip, setGeoTooltip] = useState<GeoTooltip | null>(null)
  const [picker, setPicker] = useState<{ cluster: Cluster; x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1)

  const points = useMemo<Point[]>(() => {
    const out: Point[] = []
    for (const node of nodes) {
      const coords = resolveCoords(node.meta ?? undefined)
      if (!coords) continue
      const [lng, lat] = coords
      const d = node.dynamic
      const memPct = d?.used_memory && d?.total_memory
        ? d.used_memory / d.total_memory * 100
        : null
      out.push({
        uuid: node.uuid,
        name: node.meta.name || node.uuid.slice(0, 8),
        region: node.meta.region || '',
        lat,
        lng,
        online: node.online,
        cpu: d?.cpu_usage ?? null,
        mem: memPct,
        netIn: d?.receive_speed ?? 0,
        netOut: d?.transmit_speed ?? 0,
        uptime: d?.uptime ?? null,
      })
    }
    return out
  }, [nodes])

  const clusters = useMemo<Cluster[]>(() => {
    // 球面近似距离（度），zoom=1 时阈值 ~10°（约 1000km），随缩放等比缩小
    const threshold = 10 / zoom
    const assigned = new Set<string>()
    const result: Cluster[] = []

    for (const p of points) {
      if (assigned.has(p.uuid)) continue
      const group: Point[] = [p]
      assigned.add(p.uuid)

      for (const q of points) {
        if (assigned.has(q.uuid)) continue
        const avgLat = ((p.lat + q.lat) / 2) * (Math.PI / 180)
        const dlat = p.lat - q.lat
        const dlng = (p.lng - q.lng) * Math.cos(avgLat)
        if (Math.sqrt(dlat * dlat + dlng * dlng) < threshold) {
          group.push(q)
          assigned.add(q.uuid)
        }
      }

      result.push({
        key: p.uuid,
        lat: group.reduce((s, pt) => s + pt.lat, 0) / group.length,
        lng: group.reduce((s, pt) => s + pt.lng, 0) / group.length,
        points: group,
      })
    }
    return result
  }, [points, zoom])

  // 统计每个国家的节点数，仅当 lat/lng 发生变化时重算
  const posKey = points.map(p => `${p.uuid}:${p.lat},${p.lng}`).join('|')
  const nodeCountryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const point of points) {
      for (const geo of geoFeatures.features) {
        if (geoContains(geo, [point.lng, point.lat])) {
          const id = String(geo.id)
          counts.set(id, (counts.get(id) ?? 0) + 1)
          break
        }
      }
    }
    return counts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey])

  const maxCount = useMemo(
    () => Math.max(1, ...nodeCountryCounts.values()),
    [nodeCountryCounts],
  )

  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [0, 20]
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length
    const avgLat = Math.max(-50, Math.min(65, points.reduce((s, p) => s + p.lat, 0) / points.length))
    return [avgLng, avgLat]
  }, [points])

  return (
    <div className="relative w-full overflow-hidden rounded-xl border" style={{ background: c.bg }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140, center }}
        style={{ width: '100%', height: '500px' }}
      >
        <ZoomableGroup zoom={1} minZoom={0.5} maxZoom={8} onMoveEnd={({ zoom: z }) => setZoom(z)}>
          <Geographies geography={geoFeatures}>
            {({ geographies }) =>
              geographies.map(geo => {
                const count = nodeCountryCounts.get(String(geo.id)) ?? 0
                const isDark = theme === 'dark'
                const name = (geo.properties as { name?: string }).name ?? ''
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={count > 0 ? nodeCountryColor(count, maxCount, isDark) : c.fill}
                    stroke={c.stroke}
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { fill: count > 0 ? nodeCountryColor(count, maxCount, isDark, true) : c.fillHover, outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                    onMouseEnter={(e: React.MouseEvent) =>
                      setGeoTooltip({ name, x: e.clientX, y: e.clientY })
                    }
                    onMouseMove={(e: React.MouseEvent) =>
                      setGeoTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
                    }
                    onMouseLeave={() => setGeoTooltip(null)}
                  />
                )
              })
            }
          </Geographies>

          {clusters.map(cluster => {
            const hovered = clusterTooltip?.cluster.key === cluster.key
            const isMulti = cluster.points.length > 1
            const allOnline = cluster.points.every(p => p.online)
            const anyOnline = cluster.points.some(p => p.online)
            const fill = allOnline ? '#10b981' : anyOnline ? '#f59e0b' : '#f43f5e'
            const stroke = allOnline ? '#d1fae5' : anyOnline ? '#fef3c7' : '#fecdd3'
            const r = hovered ? (isMulti ? 10 : 8) : (isMulti ? 7 : 5)
            const sw = hovered ? 2.5 : 1.5
            return (
              <Marker
                key={cluster.key}
                coordinates={[cluster.lng, cluster.lat]}
                onClick={(e: React.MouseEvent) => {
                  if (!isMulti) {
                    onSelect(cluster.points[0].uuid)
                  } else {
                    setClusterTooltip(null)
                    setPicker({ cluster, x: e.clientX, y: e.clientY })
                  }
                }}
                onMouseEnter={(e: React.MouseEvent) => {
                  setGeoTooltip(null)
                  setClusterTooltip({ cluster, x: e.clientX, y: e.clientY })
                }}
                onMouseMove={(e: React.MouseEvent) =>
                  setClusterTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
                }
                onMouseLeave={() => setClusterTooltip(null)}
              >
                <circle
                  r={r}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={sw}
                  style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                />
                {isMulti && (
                  <text
                    textAnchor="middle"
                    dy=".35em"
                    fontSize={r * 0.85}
                    fill="white"
                    style={{ pointerEvents: 'none', fontWeight: 'bold', userSelect: 'none' }}
                  >
                    {cluster.points.length}
                  </text>
                )}
              </Marker>
            )
          })}
        </ZoomableGroup>
      </ComposableMap>

      {points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
          没有节点设置了经纬度坐标
        </div>
      )}

      {/* 国家名 tooltip */}
      {geoTooltip && !clusterTooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          style={{ left: geoTooltip.x + 12, top: geoTooltip.y + 8 }}
        >
          {geoTooltip.name || '—'}
        </div>
      )}

      {/* 节点 tooltip：只显示名字 */}
      {clusterTooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{ left: clusterTooltip.x + 14, top: clusterTooltip.y + 8 }}
        >
          {clusterTooltip.cluster.points.map((point, i) => (
            <div key={point.uuid} className={cn('flex items-center gap-1.5', i > 0 && 'mt-1')}>
              <span className={point.online ? 'text-emerald-500' : 'text-rose-500'}>●</span>
              <span className="font-medium">{point.name}</span>
            </div>
          ))}
        </div>
      )}
      {/* 多节点 picker */}
      {picker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
          <div
            className="fixed z-50 rounded-lg border bg-popover shadow-lg overflow-hidden text-xs text-popover-foreground"
            style={{ left: picker.x + 8, top: picker.y + 8 }}
          >
            {picker.cluster.points.map(point => (
              <button
                key={point.uuid}
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent text-left transition-colors"
                onClick={() => { onSelect(point.uuid); setPicker(null) }}
              >
                <span className={point.online ? 'text-emerald-500' : 'text-rose-400'}>●</span>
                <span className="font-medium">{point.name}</span>
                {point.region && <span className="text-muted-foreground ml-1">{point.region}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})
