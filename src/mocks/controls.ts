import { db, findNft, onReset, reloadForScenario, resetDb } from './db'
import { resetNetworkState } from './network'
import {
  clearHistory,
  connectionCount,
  dropAllConnections,
  publishNftUpdated,
  replay,
  setRealtimeBlocked,
} from './realtime-hub'
import { getScenario, SCENARIOS, setScenario, type ScenarioConfig } from './scenarios'
import { expireSessions } from './services/auth'
import { updateEdition } from './services/catalog'
import { clearOrderTimers, resumePendingOrders } from './services/orders'

/**
 * Painel de controle do servidor simulado. Exposto como `window.__greenmint`
 * para os testes Playwright e para o painel de cenários da demo.
 *
 * Toda ação passa pelo banco simulado e chega à aplicação pelos mesmos
 * caminhos de produção: respostas REST (MSW) e eventos via socket.io-client.
 * Nada aqui toca em estado do React ou no cache do TanStack Query.
 */
export const mockControls = {
  scenarios: SCENARIOS.map(({ id, label, description }) => ({ id, label, description })),
  getScenario: () => getScenario(),
  /** Troca o cenário e reinicia o banco para o ponto de partida desse cenário. */
  setScenario(id: string, overrides?: Partial<ScenarioConfig>) {
    setScenario(id, overrides)
    clearOrderTimers()
    clearHistory()
    resetNetworkState()
    reloadForScenario()
    return getScenario()
  },
  reset() {
    clearOrderTimers()
    clearHistory()
    resetNetworkState()
    resetDb()
  },
  /** Altera preço/disponibilidade de uma edição e emite `nft.updated`. */
  updateEdition(nftId: string, editionId: string, patch: { priceEth?: string; available?: number }) {
    return updateEdition(nftId, editionId, patch).version
  },
  /** Reenvia o último evento do NFT (duplicata) ou o anterior (evento antigo). */
  replayNftEvent(nftId: string, which: 'last' | 'previous') {
    return replay(`nft:${nftId}`, which)
  },
  replayOrderEvent(orderId: string, which: 'last' | 'previous') {
    const order = db.orders[orderId]
    return replay(`order:${orderId}`, which, order?.userId ?? null)
  },
  /** Reemite o estado atual do NFT (mesma versão, mesmo eventId). */
  republishNft(nftId: string) {
    const nft = findNft(nftId)
    if (nft) publishNftUpdated(nft)
    return Boolean(nft)
  },
  dropRealtime: () => dropAllConnections(),
  setRealtimeBlocked: (blocked: boolean) => setRealtimeBlocked(blocked),
  realtimeConnections: () => connectionCount(),
  expireSessions: (userId?: string) => expireSessions(userId),
  snapshot: () => structuredClone(db),
}

export type MockControls = typeof mockControls

declare global {
  interface Window {
    __greenmint?: MockControls
  }
}

export function installControls(): void {
  window.__greenmint = mockControls
  onReset(() => resumePendingOrders())
  resumePendingOrders()
}
