import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold transition-[background-color,color,border-color,opacity] outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-accent text-ink hover:bg-accent-strong',
        outline: 'border border-accent bg-transparent text-accent-strong hover:bg-accent/10',
        secondary: 'bg-surface text-cream hover:bg-band',
        ghost: 'text-cream hover:bg-surface',
        link: 'h-auto px-0 font-medium text-accent-strong underline-offset-4 hover:underline',
        destructive: 'border border-danger/60 bg-transparent text-danger hover:bg-danger/10',
      },
      size: {
        default: 'h-10 px-4 text-sm',
        sm: 'h-8 px-3 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
