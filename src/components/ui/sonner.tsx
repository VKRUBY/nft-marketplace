import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** Toasts (sonner) com a identidade da Kurio; anunciados em região aria-live. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton
      containerAriaLabel="Notificações"
      toastOptions={{
        classNames: {
          toast: '!bg-surface !text-cream !border !border-line !font-mono !rounded-md',
          description: '!text-sand',
          success: '!border-success/50',
          error: '!border-danger/60',
          warning: '!border-accent',
          closeButton: '!bg-surface !text-cream !border-line',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
