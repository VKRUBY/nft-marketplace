import type * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-sm border border-field bg-transparent px-3 text-sm text-cream transition-colors outline-none',
        'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40',
        'aria-invalid:border-danger aria-invalid:ring-danger/30',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'file:border-0 file:bg-transparent file:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
