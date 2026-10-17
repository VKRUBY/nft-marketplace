import type { EthString } from '@/shared/eth'
import type { AvailabilityStatus, OrderStatus } from './domain'

/**
 * Envelope de todo evento de tempo real.
 *
 * - `eventId` é estável: o mesmo fato reenviado (duplicata, replay após
 *   reconexão) chega com o mesmo id e é descartado pelo cliente.
 * - `version` é a versão do recurso após o fato. O cliente só aplica um
 *   evento se `version` for maior que a última versão conhecida do recurso.
 */
export interface RealtimeEnvelope<TType extends string, TResource extends string, TData> {
  eventId: string
  type: TType
  resource: { type: TResource; id: string }
  version: number
  occurredAt: string
  data: TData
}

export interface NftUpdatedData {
  nftId: string
  floorPriceEth: EthString
  totalAvailable: number
  status: AvailabilityStatus
  editions: Array<{
    id: string
    priceEth: EthString
    available: number
    status: AvailabilityStatus
  }>
}

export interface OrderUpdatedData {
  orderId: string
  status: OrderStatus
  txHash: string | null
  explorerUrl: string | null
  declineReason: string | null
}

export type NftUpdatedEvent = RealtimeEnvelope<'nft.updated', 'nft', NftUpdatedData>
export type OrderUpdatedEvent = RealtimeEnvelope<'order.updated', 'order', OrderUpdatedData>
export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

/** Eventos emitidos pelo servidor (Socket.IO). */
export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
  /** Resposta a `session.authenticate`. */
  'session.ready': (payload: { userId: string | null; sessionId: string }) => void
  'session.rejected': (payload: { reason: 'SESSION_EXPIRED' | 'UNAUTHENTICATED' }) => void
}

/** Eventos emitidos pelo cliente (Socket.IO). */
export interface ClientToServerEvents {
  /**
   * Associa a conexão a um usuário. Enviado logo após `connect` e a cada
   * troca de sessão; `token: null` desassocia (visitante).
   */
  'session.authenticate': (payload: { token: string | null; sessionId: string }) => void
}
