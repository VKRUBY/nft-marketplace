import { useRealtimeStatus } from '@/lib/realtime/socket'

const LABELS = {
  idle: 'Tempo real inativo',
  connecting: 'Conectando ao tempo real',
  connected: 'Tempo real conectado',
  reconnecting: 'Reconectando ao tempo real',
  offline: 'Sem conexão',
} as const

/** Estado da conexão em tempo real, com texto (não depende só de cor). */
export function RealtimeIndicator() {
  const status = useRealtimeStatus()
  const ok = status === 'connected'
  return (
    <span role="status" data-realtime-status={status} className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span aria-hidden className={`size-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <span className={ok ? 'sr-only' : undefined}>{LABELS[status]}</span>
    </span>
  )
}
