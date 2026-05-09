import { bytes } from '../utils/format'

interface Props {
  online: number
  total: number
  regions: number
  totalUp: number
  totalDown: number
  netUp: number
  netDown: number
}

export function StatusIsland({ online, total, regions, totalUp, totalDown, netUp, netDown }: Props) {
  if (total === 0) return null

  return (
    <div className="fixed top-[54px] left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className="flex items-center gap-2 px-3.5 py-1 bg-white/90 dark:bg-neutral-950/80 backdrop-blur-xl rounded-full border border-gray-200 dark:border-white/10 text-[11px] font-mono whitespace-nowrap shadow-lg">
        <span className="text-gray-500 dark:text-white/50">
          <span className="text-emerald-500 dark:text-emerald-400 font-medium">{online}</span>
          <span className="text-gray-300 dark:text-white/25"> / </span>
          <span className="text-gray-700 dark:text-white/70">{total}</span>
          <span className="ml-1">在线</span>
        </span>
        <span className="text-gray-300 dark:text-white/20">·</span>
        <span className="text-gray-500 dark:text-white/50">
          <span className="text-gray-700 dark:text-white/70">{regions}</span>
          <span className="ml-1">地区</span>
        </span>
        <span className="text-gray-300 dark:text-white/20">·</span>
        <span className="text-gray-500 dark:text-white/50">↑ <span className="text-gray-700 dark:text-white/70">{bytes(netUp)}/s</span></span>
        <span className="text-gray-300 dark:text-white/20">/</span>
        <span className="text-gray-500 dark:text-white/50">↓ <span className="text-gray-700 dark:text-white/70">{bytes(netDown)}/s</span></span>
        <span className="text-gray-300 dark:text-white/20">·</span>
        <span className="text-gray-500 dark:text-white/50">↑ <span className="text-gray-700 dark:text-white/70">{bytes(totalUp)}</span></span>
        <span className="text-gray-300 dark:text-white/20">/</span>
        <span className="text-gray-500 dark:text-white/50">↓ <span className="text-gray-700 dark:text-white/70">{bytes(totalDown)}</span></span>
      </div>
    </div>
  )
}
