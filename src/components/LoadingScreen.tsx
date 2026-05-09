import { motion } from 'motion/react'
import { PICKED_THEME } from './Background'

export function LoadingScreen() {
  const base = import.meta.env.BASE_URL
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 select-none overflow-hidden bg-black"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <video
        src={`${base}${PICKED_THEME}.mp4`}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={`${base}${PICKED_THEME}.webp`}
        aria-hidden
      />
    </motion.div>
  )
}
