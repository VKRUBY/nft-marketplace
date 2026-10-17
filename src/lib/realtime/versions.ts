import type { Nft, NftSummary, Order } from '@/contracts/domain'
import type { NftUpdatedData, RealtimeEvent } from '@/contracts/events'

/**
 * Registro de versões conhecidas por recurso — a fonte de verdade do cliente
 * para ordenar fatos vindos de REST e de Socket.IO.
 *
 * Regras:
 *  - evento com `eventId` já visto é descartado (duplicata);
 *  - evento com `version` ≤ versão conhecida é descartado (antigo);
 *  - resposta REST com versão menor que a de um evento já aplicado recebe
 *    o estado mais novo por cima (evita regressão por corrida REST × evento).
 */

const MAX_SEEN = 1000
const seen = new Set<string>()
const versions = new Map<string, number>()
const latestNft = new Map<string, { version: number; data: NftUpdatedData }>()

function key(type: string, id: string) {
  return `${type}:${id}`
}

function markSeen(eventId: string) {
  seen.add(eventId)
  if (seen.size > MAX_SEEN) {
    const first = seen.values().next().value
    if (first !== undefined) seen.delete(first)
  }
}

export type EventVerdict = 'apply' | 'duplicate' | 'stale'

export function judgeEvent(event: RealtimeEvent): EventVerdict {
  if (seen.has(event.eventId)) return 'duplicate'
  const k = key(event.resource.type, event.resource.id)
  const known = versions.get(k) ?? 0
  markSeen(event.eventId)
  if (event.version <= known) return 'stale'
  versions.set(k, event.version)
  if (event.type === 'nft.updated') latestNft.set(event.resource.id, { version: event.version, data: event.data })
  return 'apply'
}

/** Registra a versão vista via REST (só avança, nunca recua). */
export function observeVersion(type: 'nft' | 'order', id: string, version: number): void {
  const k = key(type, id)
  if ((versions.get(k) ?? 0) < version) versions.set(k, version)
}

export function knownVersion(type: 'nft' | 'order', id: string): number {
  return versions.get(key(type, id)) ?? 0
}

export function patchNftSummary<T extends NftSummary>(nft: T, data: NftUpdatedData, version: number): T {
  return {
    ...nft,
    floorPriceEth: data.floorPriceEth,
    totalAvailable: data.totalAvailable,
    status: data.status,
    version,
  }
}

export function patchNft(nft: Nft, data: NftUpdatedData, version: number): Nft {
  return {
    ...patchNftSummary(nft, data, version),
    editions: nft.editions.map((edition) => {
      const update = data.editions.find((e) => e.id === edition.id)
      return update ? { ...edition, ...update } : edition
    }),
  }
}

/** Aplica sobre uma resposta REST o estado mais novo já recebido por evento. */
export function reconcileNft<T extends NftSummary>(nft: T): T {
  const latest = latestNft.get(nft.id)
  if (latest && latest.version > nft.version) {
    return ('editions' in nft ? patchNft(nft as unknown as Nft, latest.data, latest.version) : patchNftSummary(nft, latest.data, latest.version)) as T
  }
  observeVersion('nft', nft.id, nft.version)
  return nft
}

export function reconcileOrder(order: Order): Order {
  observeVersion('order', order.id, order.version)
  return order
}

/** Limpa o que pertence à sessão anterior (pedidos), mantendo o catálogo público. */
export function forgetPrivateVersions(): void {
  for (const k of [...versions.keys()]) if (k.startsWith('order:')) versions.delete(k)
  for (const id of [...seen]) if (id.startsWith('evt_order_')) seen.delete(id)
}

export function resetVersions(): void {
  seen.clear()
  versions.clear()
  latestNft.clear()
}
