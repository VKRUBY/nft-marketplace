import type { Nft } from '@/contracts/domain'
import type { NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent } from '@/contracts/events'
import type { OrderRecord } from './db'
import { getScenario } from './scenarios'

/**
 * Lado "servidor" do tempo real. Os serviços do banco simulado publicam
 * fatos aqui; cada conexão Socket.IO simulada (ver socket.ts) se inscreve e
 * repassa ao cliente apenas o que lhe pertence:
 *  - `nft.updated` é público (todas as conexões);
 *  - `order.updated` só vai para conexões autenticadas como dono do pedido.
 */

export interface HubSubscriber {
  userId: () => string | null
  send: (event: RealtimeEvent) => void
  /** false quando o WebSocket do cliente já fechou (inclusive sem evento `close`). */
  alive: () => boolean
  dispose: () => void
}

/**
 * Um socket fechado ainda no handshake (ex.: desmontagem dupla do StrictMode)
 * não dispara `close` no handler do MSW; por isso o hub verifica `alive()`
 * antes de cada entrega e descarta inscrições órfãs.
 */
function prune() {
  for (const sub of [...subscribers]) if (!sub.alive()) sub.dispose()
}

const subscribers = new Set<HubSubscriber>()

export function subscribe(subscriber: HubSubscriber): () => void {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export function connectionCount(): number {
  prune()
  return subscribers.size
}

/** Últimos eventos por recurso, para reenvio de duplicatas/antigos sob demanda. */
const history = new Map<string, RealtimeEvent[]>()

function remember(event: RealtimeEvent) {
  const key = `${event.resource.type}:${event.resource.id}`
  const list = history.get(key) ?? []
  list.push(event)
  history.set(key, list.slice(-5))
}

function deliver(event: RealtimeEvent, ownerId: string | null) {
  const { realtime } = getScenario()
  const previous = history.get(`${event.resource.type}:${event.resource.id}`)?.at(-2)
  prune()
  for (const sub of subscribers) {
    if (ownerId !== null && sub.userId() !== ownerId) continue
    sub.send(event)
    if (realtime.duplicateEvents) sub.send(event)
    if (realtime.staleEvents && previous) sub.send(previous)
  }
}

export function publishNftUpdated(nft: Nft): NftUpdatedEvent {
  const event: NftUpdatedEvent = {
    eventId: `evt_nft_${nft.id}_v${nft.version}`,
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      nftId: nft.id,
      floorPriceEth: nft.floorPriceEth,
      totalAvailable: nft.totalAvailable,
      status: nft.status,
      editions: nft.editions.map((e) => ({
        id: e.id,
        priceEth: e.priceEth,
        available: e.available,
        status: e.status,
      })),
    },
  }
  remember(event)
  deliver(event, null)
  return event
}

export function publishOrderUpdated(order: OrderRecord): OrderUpdatedEvent {
  const event: OrderUpdatedEvent = {
    eventId: `evt_order_${order.id}_v${order.version}`,
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    data: {
      orderId: order.id,
      status: order.status,
      txHash: order.txHash,
      explorerUrl: order.explorerUrl,
      declineReason: order.declineReason,
    },
  }
  remember(event)
  deliver(event, order.userId)
  return event
}

/**
 * Reenvia o último evento de um recurso (duplicata) ou o penúltimo (antigo).
 * Usado pelos testes para provar a deduplicação no cliente.
 */
export function replay(resourceKey: string, which: 'last' | 'previous', ownerId: string | null = null): boolean {
  const list = history.get(resourceKey)
  const event = which === 'last' ? list?.at(-1) : list?.at(-2)
  if (!event) return false
  prune()
  for (const sub of subscribers) {
    if (ownerId !== null && sub.userId() !== ownerId) continue
    sub.send(event)
  }
  return true
}

export function clearHistory(): void {
  history.clear()
}

type DisconnectFn = () => void
const disconnectors = new Set<DisconnectFn>()

export function registerDisconnector(fn: DisconnectFn): () => void {
  disconnectors.add(fn)
  return () => disconnectors.delete(fn)
}

/** Derruba todas as conexões ativas (o cliente tenta reconectar sozinho). */
export function dropAllConnections(): number {
  const count = disconnectors.size
  for (const fn of [...disconnectors]) fn()
  return count
}

let realtimeBlocked = false
/** Enquanto bloqueado, novas conexões são recusadas (simula queda prolongada). */
export function setRealtimeBlocked(blocked: boolean): void {
  realtimeBlocked = blocked
  if (blocked) dropAllConnections()
}
export function isRealtimeBlocked(): boolean {
  return realtimeBlocked
}
