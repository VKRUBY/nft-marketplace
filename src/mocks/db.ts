import type {
  AppliedCoupon,
  BuyerInfo,
  Network,
  Nft,
  Order,
  Quote,
  Wallet,
  WalletConnection,
} from '@/contracts/domain'
import { buildCoupons, buildUsers, buildWallets, type CouponRecord, type UserRecord } from './fixtures/accounts'
import { buildCatalog } from './fixtures/catalog'
import { getScenario } from './scenarios'

/**
 * Banco simulado único: catálogo, contas, favoritos, carrinhos, carteiras,
 * cotações e pedidos vivem no mesmo estado, então toda mudança aparece de
 * forma consistente nas respostas REST e nos eventos Socket.IO.
 *
 * Persistência: localStorage (sustenta refresh). `resetDb()` restaura o
 * estado inicial conhecido do cenário ativo.
 */

export interface SessionRecord {
  token: string
  userId: string
  expiresAt: number
}

export interface CartLineRecord {
  id: string
  nftId: string
  editionId: string
  quantity: number
  acknowledgedPriceEth: string
}

export interface CartRecord {
  id: string
  owner: 'guest' | 'user'
  ownerId: string
  lines: CartLineRecord[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface QuoteRecord extends Quote {
  userId: string
  cartId: string
  fingerprint: string
}

export interface OrderRecord extends Order {
  userId: string
  idempotencyKey: string
  requestHash: string
  /** Momento (epoch ms) em que o pedido deixa de estar pendente. */
  resolveAt: number
  outcome: 'confirm' | 'decline'
  /** Estoque reservado, devolvido em caso de recusa. */
  reservations: Array<{ nftId: string; editionId: string; quantity: number }>
  quoteId: string
}

export interface DbState {
  schemaVersion: number
  scenarioId: string
  users: UserRecord[]
  sessions: SessionRecord[]
  nfts: Nft[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  wallets: Record<string, Wallet[]>
  walletConnections: Record<string, WalletConnection>
  coupons: CouponRecord[]
  quotes: Record<string, QuoteRecord>
  orders: Record<string, OrderRecord>
  /** `${userId}:${idempotencyKey}` → orderId */
  idempotency: Record<string, string>
  /** Controle de efeitos de cenário que só ocorrem uma vez. */
  flags: Record<string, boolean>
}

export const SCHEMA_VERSION = 2
const STORAGE_KEY = 'greenmint:mock-db'

function seed(scenarioId: string): DbState {
  const scenario = getScenario()
  return {
    schemaVersion: SCHEMA_VERSION,
    scenarioId,
    users: buildUsers(),
    sessions: [],
    nfts: scenario.emptyCatalog ? [] : buildCatalog(),
    favorites: { usr_ana: ['nft_002', 'nft_005', 'nft_013'], usr_bruno: [] },
    carts: {},
    wallets: buildWallets(),
    walletConnections: {},
    coupons: buildCoupons(),
    quotes: {},
    orders: {},
    idempotency: {},
    flags: {},
  }
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function load(): DbState {
  const scenarioId = getScenario().id
  const raw = storage()?.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DbState
      // Troca de cenário ou de schema reinicia o estado para manter o cenário reproduzível.
      if (parsed.schemaVersion === SCHEMA_VERSION && parsed.scenarioId === scenarioId) return parsed
    } catch {
      /* estado corrompido: recomeça do seed */
    }
  }
  return seed(scenarioId)
}

export let db: DbState = load()

export function persist(): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* cota excedida: o estado continua válido em memória */
  }
}

type ResetListener = () => void
const resetListeners = new Set<ResetListener>()

export function onReset(listener: ResetListener): () => void {
  resetListeners.add(listener)
  return () => resetListeners.delete(listener)
}

/** Restaura integralmente o estado inicial do cenário ativo. */
export function resetDb(): void {
  db = seed(getScenario().id)
  persist()
  for (const listener of resetListeners) listener()
}

/** Recarrega o estado ao trocar de cenário (cada cenário tem seu ponto de partida). */
export function reloadForScenario(): void {
  db = seed(getScenario().id)
  persist()
  for (const listener of resetListeners) listener()
}

// ─── Utilitários de consulta ────────────────────────────────────────────────

export function findNft(idOrSlug: string): Nft | undefined {
  return db.nfts.find((n) => n.id === idOrSlug || n.slug === idOrSlug)
}

export function findUser(userId: string): UserRecord | undefined {
  return db.users.find((u) => u.id === userId)
}

export function publicUser(record: UserRecord) {
  const { passwordHash: _h, passwordSalt: _s, ...user } = record
  return user
}

export function findCoupon(code: string): CouponRecord | undefined {
  return db.coupons.find((c) => c.code === code.toUpperCase())
}

export function toAppliedCoupon(c: CouponRecord): AppliedCoupon {
  return { code: c.code, description: c.description, percentBp: c.percentBp, expiresAt: c.expiresAt }
}

export type { BuyerInfo, Network }
