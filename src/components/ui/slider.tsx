import { Slider as SliderPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

function Slider({
  className,
  thumbLabels = [],
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }) {
  const count = (props.value ?? props.defaultValue ?? [0]).length
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn('relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-accent/40">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      {Array.from({ length: count }, (_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={thumbLabels[i]}
          className="block size-4 rounded-full border-2 border-ink bg-accent ring-accent outline-none hover:ring-2 focus-visible:ring-2 focus-visible:ring-accent-strong"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
