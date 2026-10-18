import type { Socket } from 'socket.io-client'
import { useSyncExternalStore } from 'react'
import { SOCKET_PATH } from '@/contracts/endpoints'
import type { ClientToServerEvents, RealtimeEvent, ServerToClientEvents } from '@/contracts/events'

/**
 * Conexão Socket.IO da sessão atual.
 *
 * Ciclo de vida: uma instância de socket por sessão. Ao trocar de usuário
 * (login, logout, troca de conta) a instância anterior é desconectada e
 * todos os seus listeners são removidos antes de abrir a próxima — eventos
 * de uma sessão anterior não têm como chegar à nova.
 *
 * O socket.io-client é carregado sob demanda: fica fora do bundle inicial e
 * só captura `globalThis.WebSocket` na primeira conexão — depois que a camada
 * de mocks (se ligada) já instalou a interceptação.
 */

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>
type EventHandler = (event: RealtimeEvent) => void
type ReconnectHandler = () => void
type RejectedHandler = () => void

/** Mesmo default dos mocks; um backend real define VITE_SOCKET_URL. */
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) || 'https://realtime.greenmint.test'

let socket: AppSocket | null = null
let ioModule: Promise<typeof import('socket.io-client')> | null = null
const loadIo = () => (ioModule ??= import('socket.io-client'))
let status: RealtimeStatus = 'idle'
let generation = 0
const statusListeners = new Set<() => void>()
const eventHandlers = new Set<EventHandler>()
const reconnectHandlers = new Set<ReconnectHandler>()
const rejectedHandlers = new Set<RejectedHandler>()

function setStatus(next: RealtimeStatus) {
  if (status === next) return
  status = next
  for (const l of statusListeners) l()
}

export const realtimeClient = {
  /** Abre (ou reabre) a conexão associada ao token informado. */
  start(token: string | null) {
    this.stop()
    const myGeneration = ++generation
    setStatus('connecting')
    void loadIo().then(
      ({ io }) => {
        // Outra sessão começou (ou stop()) enquanto o módulo carregava.
        if (myGeneration === generation) open(io, token, myGeneration)
      },
      () => {
        if (myGeneration === generation) setStatus('offline')
      },
    )
  },

  stop() {
    generation++
    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
      socket = null
    }
    setStatus('idle')
  },

  onEvent(handler: EventHandler) {
    eventHandlers.add(handler)
    return () => eventHandlers.delete(handler)
  },
  onReconnect(handler: ReconnectHandler) {
    reconnectHandlers.add(handler)
    return () => reconnectHandlers.delete(handler)
  },
  onRejected(handler: RejectedHandler) {
    rejectedHandlers.add(handler)
    return () => rejectedHandlers.delete(handler)
  },
  getStatus: () => status,
  subscribeStatus(listener: () => void) {
    statusListeners.add(listener)
    return () => statusListeners.delete(listener)
  },
}

function open(io: typeof import('socket.io-client').io, token: string | null, myGeneration: number) {
  const sessionId = crypto.randomUUID()
  const options = {
    path: SOCKET_PATH,
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4_000,
    timeout: 8_000,
  }
  const instance: AppSocket = io(SOCKET_URL, options)
  socket = instance

  let hasConnected = false
  const isCurrent = () => myGeneration === generation

  instance.on('connect', () => {
    if (!isCurrent()) return
    instance.emit('session.authenticate', { token, sessionId })
  })
  instance.on('session.ready', (payload) => {
    if (!isCurrent() || payload.sessionId !== sessionId) return
    setStatus('connected')
    // Primeira conexão não precisa reconciliar: as queries acabaram de buscar dados.
    if (hasConnected) for (const h of reconnectHandlers) h()
    hasConnected = true
  })
  instance.on('session.rejected', () => {
    if (!isCurrent()) return
    for (const h of rejectedHandlers) h()
  })
  instance.on('disconnect', () => {
    if (!isCurrent()) return
    setStatus(navigator.onLine ? 'reconnecting' : 'offline')
  })
  instance.on('connect_error', () => {
    if (!isCurrent()) return
    setStatus(navigator.onLine ? 'reconnecting' : 'offline')
  })

  const forward = (event: RealtimeEvent) => {
    if (!isCurrent()) return
    for (const h of eventHandlers) h(event)
  }
  instance.on('nft.updated', forward)
  instance.on('order.updated', forward)
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(realtimeClient.subscribeStatus, realtimeClient.getStatus, realtimeClient.getStatus)
}
