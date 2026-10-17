import { Tabs as TabsPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex items-end gap-4 overflow-x-auto border-b border-line md:gap-8', className)} {...props} />
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px border-b-2 border-transparent pb-1 text-sm whitespace-nowrap sm:text-base font-medium text-cream transition-colors outline-none hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-accent-strong data-[state=active]:border-accent data-[state=active]:text-accent-strong md:text-lg',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('outline-none', className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
