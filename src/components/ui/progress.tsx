import * as ProgressPrimitive from '@radix-ui/react-progress'
import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react'
import { cn } from '../../utils/cn'

type Props = ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string
  plain?: boolean
}

/* 用 CSS mask 切出分段间隙，保留弹簧动画 */
const SEGMENT_MASK = [
  'repeating-linear-gradient(',
  '90deg,',
  'black,',
  'black calc(100%/20 - 1.5px),',
  'transparent calc(100%/20 - 1.5px),',
  'transparent calc(100%/20)',
  ')',
].join(' ')

export const Progress = forwardRef<ElementRef<typeof ProgressPrimitive.Root>, Props>(
  ({ className, value, indicatorClassName, plain = false, ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, value || 0))
    const spring = useSpring(clamped, { stiffness: 80, damping: 18, mass: 0.5 })
    const translateX = useTransform(spring, v => `translateX(-${100 - v}%)`)

    useEffect(() => { spring.set(clamped) }, [clamped, spring])

    return (
      <ProgressPrimitive.Root
        ref={ref}
        className={cn('relative h-1.5 w-full overflow-hidden bg-border', className)}
        style={plain ? { borderRadius: '999px' } : {
          maskImage: SEGMENT_MASK,
          WebkitMaskImage: SEGMENT_MASK,
          borderRadius: '1px',
        }}
        {...props}
      >
        <motion.div
          className={cn('h-full w-full flex-1 bg-primary', indicatorClassName)}
          style={{ transform: translateX }}
        />
      </ProgressPrimitive.Root>
    )
  },
)
Progress.displayName = ProgressPrimitive.Root.displayName
