import { useRealtimeStatus } from '@/lib/realtime/socket'

const LABELS = {
  idle: 'Tempo real inativo',
  connecting: 'Conectando ao tempo real…',
  connected: 'Tempo real conectado',
  reconnecting: 'Conexão em tempo real perdida. Reconectando…',
  offline: 'Sem conexão com a internet.',
} as const

/**
 * Estado da conexão em tempo real. Só aparece quando há problema (texto,
 * não só cor); `data-realtime-status` fica disponível para testes.
 */
export function RealtimeIndicator() {
  const status = useRealtimeStatus()
  const visible = status === 'reconnecting' || status === 'offline'
  return (
    <div
      role="status"
      data-realtime-status={status}
      className={
        visible
          ? 'fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-accent bg-surface px-4 py-2 text-xs text-cream shadow-lg md:bottom-6'
          : 'sr-only'
      }
    >
      {visible ? LABELS[status] : ''}
    </div>
  )
}
