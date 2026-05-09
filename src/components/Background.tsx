const THEMES = ['starship', 'leading'] as const
const picked = THEMES[Date.now() % THEMES.length]

export const PICKED_THEME = picked

export function Background() {
  const base = import.meta.env.BASE_URL
  return (
    <div className="fixed inset-0 -z-10" aria-hidden>
      <video
        src={`${base}${picked}.mp4`}
        className="w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={`${base}${picked}.webp`}
      />
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, hsl(var(--background) / 0.55) 0%, hsl(var(--background) / 0.85) 100%)',
      }} />
      {/* 细微扫描线纹理，强化交易屏幕氛围 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)',
        }}
      />
    </div>
  )
}
