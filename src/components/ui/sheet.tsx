import { Dialog as SheetPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/** Drawer lateral/inferior (Radix Dialog): mesmo controle de foco do diálogo. */
const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close

function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: 'left' | 'right' | 'bottom' }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <SheetPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col gap-4 overflow-y-auto bg-surface text-cream shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out',
          side === 'right' && 'inset-y-0 right-0 w-[min(88vw,360px)] data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
          side === 'left' && 'inset-y-0 left-0 w-[min(88vw,360px)] data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
          side === 'bottom' && 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-sm p-1 text-accent-strong hover:bg-band">
          <XIcon className="size-5" aria-hidden />
          <span className="sr-only">Fechar</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('text-lg font-bold', className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('text-sm text-sand', className)} {...props} />
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger }
