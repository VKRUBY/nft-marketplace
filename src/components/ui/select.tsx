import { Select as SelectPrimitive } from 'radix-ui'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'flex h-10 w-full items-center justify-between gap-2 rounded-sm border border-field bg-transparent px-3 text-left text-sm text-cream outline-none',
        'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 aria-invalid:border-danger data-[placeholder]:text-dust',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 text-sand" aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({ className, children, position = 'popper', ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          'relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-sm border border-line bg-surface text-cream shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0',
          position === 'popper' && 'w-[var(--radix-select-trigger-width)] translate-y-1',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-default items-center rounded-sm py-2 pr-8 pl-2 text-sm outline-none select-none focus:bg-band data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4 text-accent-strong" aria-hidden />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue }
