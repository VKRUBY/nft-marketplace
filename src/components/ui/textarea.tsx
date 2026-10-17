import type * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-36 w-full rounded-sm border border-field bg-transparent px-3 py-2 text-sm text-cream outline-none',
        'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
