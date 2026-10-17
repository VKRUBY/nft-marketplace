import type * as React from 'react'
import { cn } from '@/lib/utils'

/** Placeholder com shimmer; respeita prefers-reduced-motion (ver index.css). */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden className={cn('skeleton rounded-md', className)} {...props} />
}

export { Skeleton }
