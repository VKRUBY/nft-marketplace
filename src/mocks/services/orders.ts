import type { CreateOrderInput, Network, Order, Quote, QuoteIssue, QuoteLine } from '@/contracts/domain'
import { NETWORKS } from '@/contracts/networks'
import { mulEth, percentOfEth } from '@/shared/eth'
import { db, persist, type OrderRecord, type QuoteRecord } from '../db'
import { MockApiError } from '../errors'
import { publishOrderUpdated } from '../realtime-hub'
import { fnv1a, newId } from '../rng'
import { getScenario } from '../scenarios'
import { cartKey, getOrCreateCart, priceLines, removePurchased, toCartItem } from './cart'
import { adjustStock, updateEdition } from './catalog'

export const QUOTE_TTL_MS = 5 * 60 * 1000

function isWalletConnected(userId: string, walletId: string, network: Network): boolean {
  const wallet = db.wallets[userId]?.find((w) => w.id === walletId)
  const connection = db.walletConnections[walletId]
  return Boolean(wallet && connection?.status === 'connected' && connection.network === network)
}

/**
 * Cotação: fotografia dos valores vigentes do carrinho do usuário para uma
 * rede. O `fingerprint` resume tudo o que afeta o total; se mudar entre a
 * cotação aceita e o envio do pedido, a API exige nova confirmação.
 */
export function buildQuote(userId: string, network: Network): QuoteRecord {
  const cart = getOrCreateCart({ kind: 'user', userId })
  const items = cart.lines.map(toCartItem).filter((i) => i !== null)
  const pricing = priceLines(items, cart.couponCode, network)
  const issues: QuoteIssue[] = []

  for (const item of items) {
    if (item.issues.includes('SOLD_OUT')) {
      issues.push({ code: 'SOLD_OUT', itemId: item.id, message: `${item.name} (${item.editionLabel}) esgotou.` })
    } else if (item.issues.includes('QUANTITY_REDUCED')) {
      issues.push({
        code: 'QUANTITY_REDUCED',
        itemId: item.id,
        message: `${item.name}: restam ${item.available} unidade(s).`,
      })
    }
    if (item.issues.includes('PRICE_CHANGED')) {
      issues.push({
        code: 'PRICE_CHANGED',
        itemId: item.id,
        message: `O preço de ${item.name} mudou de ${item.acknowledgedPriceEth} para ${item.unitPriceEth} ETH.`,
      })
    }
  }
  if (pricing.couponExpired) issues.push({ code: 'COUPON_EXPIRED', message: 'O cupom aplicado expirou.' })
  if (pricing.couponMissing) issues.push({ code: 'COUPON_INVALID', message: 'O cupom aplicado não é mais válido.' })

  const lines: QuoteLine[] = pricing.billable.map((i) => ({
    itemId: i.id,
    nftId: i.nftId,
    editionId: i.editionId,
    name: i.name,
    editionLabel: i.editionLabel,
    tokenId: i.tokenId,
    image: i.image,
    quantity: i.billableQuantity,
    unitPriceEth: i.unitPriceEth,
    lineTotalEth: mulEth(i.unitPriceEth, i.billableQuantity),
  }))

  const fingerprint = fnv1a(
    JSON.stringify({
      network,
      lines: lines.map((l) => [l.editionId, l.quantity, l.unitPriceEth]),
      coupon: pricing.coupon?.code ?? null,
      fee: pricing.fee,
      issues: issues.map((i) => i.code).sort(),
    }),
  )

  const now = Date.now()
  const quote: QuoteRecord = {
    id: newId('qt'),
    cartVersion: cart.version,
    network,
    lines,
    coupon: pricing.coupon,
    subtotalEth: pricing.subtotal,
    discountEth: pricing.discount,
    networkFeeEth: pricing.fee,
    totalEth: pricing.total,
    issues,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
    userId,
    cartId: cart.id,
    fingerprint,
  }
  return quote
}

export function toPublicQuote(record: QuoteRecord): Quote {
  const { userId: _u, cartId: _c, fingerprint: _f, ...quote } = record
  return quote
}

export function createQuote(userId: string, network: Network): Quote {
  const quote = buildQuote(userId, network)
  if (quote.lines.length === 0 && quote.issues.length === 0) {
    throw new MockApiError('VALIDATION_ERROR', 'Seu carrinho está vazio.')
  }
  db.quotes[quote.id] = quote
  persist()
  schedulePriceChange(userId)
  return toPublicQuote(quote)
}

/** Cenário `price-change`: sobe 15% o preço do primeiro item, uma única vez. */
function schedulePriceChange(userId: string) {
  const delay = getScenario().priceChangeAfterQuoteMs
  if (delay === null || db.flags.priceChangeScheduled) return
  db.flags.priceChangeScheduled = true
  persist()
  setTimeout(() => {
    const line = db.carts[cartKey({ kind: 'user', userId })]?.lines[0]
    if (!line) return
    const nft = db.nfts.find((n) => n.id === line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) return
    const raised = percentOfEth(edition.priceEth, 11_500)
    updateEdition(nft.id, edition.id, { priceEth: raised })
  }, delay)
}

function txHash(orderId: string): string {
  let out = ''
  for (let i = 0; out.length < 64; i++) out += fnv1a(`${orderId}:${i}`)
  return `0x${out.slice(0, 64)}`
}

export function toPublicOrder(record: OrderRecord): Order {
  const {
    userId: _u,
    idempotencyKey: _k,
    requestHash: _r,
    resolveAt: _a,
    outcome: _o,
    reservations: _s,
    quoteId: _q,
    ...order
  } = record
  return order
}

export interface CreateOrderResult {
  order: Order
  /** true quando a chave de idempotência recuperou um pedido já existente. */
  replayed: boolean
  /** true quando o cenário manda atrasar esta resposta além do timeout do cliente. */
  delayResponse: boolean
}

export function createOrder(userId: string, idempotencyKey: string, input: CreateOrderInput): CreateOrderResult {
  const scenario = getScenario()
  const requestHash = fnv1a(JSON.stringify(input))
  const idemKey = `${userId}:${idempotencyKey}`

  const existingId = db.idempotency[idemKey]
  if (existingId) {
    const existing = db.orders[existingId]!
    if (existing.requestHash !== requestHash) {
      throw new MockApiError(
        'IDEMPOTENCY_CONFLICT',
        'Esta chave de idempotência já foi usada com outro conteúdo.',
      )
    }
    settleIfDue(existing)
    return { order: toPublicOrder(existing), replayed: true, delayResponse: false }
  }

  const accepted = db.quotes[input.quoteId]
  if (!accepted || accepted.userId !== userId) throw new MockApiError('NOT_FOUND', 'Cotação não encontrada.')
  if (Date.parse(accepted.expiresAt) <= Date.now()) {
    throw new MockApiError('QUOTE_EXPIRED', 'A cotação expirou. Revise os valores novamente.')
  }
  if (accepted.network !== input.network) {
    throw new MockApiError('VALIDATION_ERROR', 'A rede difere da cotação aceita.', { network: 'Rede divergente.' })
  }
  const wallet = db.wallets[userId]?.find((w) => w.id === input.walletId)
  if (!wallet) throw new MockApiError('NOT_FOUND', 'Carteira não encontrada.')
  if (!isWalletConnected(userId, wallet.id, input.network)) {
    throw new MockApiError('WALLET_REJECTED', 'Conecte a carteira na rede selecionada antes de confirmar.', {
      walletId: 'Carteira desconectada.',
    })
  }

  if (scenario.soldOutOnOrder && !db.flags.soldOutApplied && accepted.lines[0]) {
    db.flags.soldOutApplied = true
    updateEdition(accepted.lines[0].nftId, accepted.lines[0].editionId, { available: 0 })
  }

  // Revalidação: preço, disponibilidade, cupom e taxa precisam bater com a cotação aceita.
  const current = buildQuote(userId, input.network)
  if (current.fingerprint !== accepted.fingerprint || current.issues.length > 0) {
    db.quotes[current.id] = current
    persist()
    const soldOut = current.issues.some((i) => i.code === 'SOLD_OUT' || i.code === 'QUANTITY_REDUCED')
    throw new MockApiError(
      soldOut ? 'AVAILABILITY_CONFLICT' : 'QUOTE_STALE',
      soldOut
        ? 'A disponibilidade mudou. Revise o pedido antes de confirmar.'
        : 'Os valores mudaram desde a sua revisão. Confirme a nova cotação.',
      undefined,
      { quote: toPublicQuote(current) },
    )
  }
  if (accepted.lines.length === 0) throw new MockApiError('VALIDATION_ERROR', 'Seu carrinho está vazio.')

  const now = Date.now()
  const reservations = accepted.lines.map((l) => ({ nftId: l.nftId, editionId: l.editionId, quantity: l.quantity }))
  const order: OrderRecord = {
    id: newId('ord'),
    status: 'pending',
    lines: structuredClone(accepted.lines),
    coupon: accepted.coupon ? { ...accepted.coupon } : null,
    subtotalEth: accepted.subtotalEth,
    discountEth: accepted.discountEth,
    networkFeeEth: accepted.networkFeeEth,
    totalEth: accepted.totalEth,
    network: input.network,
    wallet: { id: wallet.id, nickname: wallet.nickname, address: wallet.address, provider: wallet.provider },
    buyer: { ...input.buyer },
    txHash: null,
    explorerUrl: null,
    declineReason: null,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    version: 1,
    userId,
    idempotencyKey,
    requestHash,
    resolveAt: now + scenario.payment.delayMs,
    outcome: scenario.payment.outcome,
    reservations,
    quoteId: accepted.id,
  }
  db.orders[order.id] = order
  db.idempotency[idemKey] = order.id
  delete db.quotes[accepted.id]
  adjustStock(reservations.map((r) => ({ nftId: r.nftId, editionId: r.editionId, delta: -r.quantity })))
  persist()
  scheduleResolution(order)

  const delayResponse = scenario.orderCreateTimeout && !db.flags.orderTimeoutApplied
  if (delayResponse) {
    db.flags.orderTimeoutApplied = true
    persist()
  }
  return { order: toPublicOrder(order), replayed: false, delayResponse }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleResolution(order: OrderRecord) {
  if (order.status !== 'pending' || timers.has(order.id)) return
  const wait = Math.max(0, order.resolveAt - Date.now())
  timers.set(
    order.id,
    setTimeout(() => {
      timers.delete(order.id)
      const fresh = db.orders[order.id]
      if (fresh) settleIfDue(fresh)
    }, wait),
  )
}

/** Conclui o pedido se o prazo da simulação já passou. Pedidos terminais não mudam mais. */
export function settleIfDue(order: OrderRecord): void {
  if (order.status !== 'pending' || Date.now() < order.resolveAt) return
  order.version += 1
  order.updatedAt = new Date().toISOString()
  if (order.outcome === 'confirm') {
    order.status = 'confirmed'
    order.txHash = txHash(order.id)
    order.explorerUrl = `${NETWORKS[order.network].explorer}/tx/${order.txHash}`
    removePurchased(
      order.userId,
      order.lines.map((l) => ({ editionId: l.editionId, quantity: l.quantity })),
    )
  } else {
    order.status = 'declined'
    order.declineReason = 'A carteira recusou a assinatura da transação.'
    adjustStock(order.reservations.map((r) => ({ nftId: r.nftId, editionId: r.editionId, delta: r.quantity })))
  }
  persist()
  publishOrderUpdated(order)
}

export function getOrder(userId: string, orderId: string): Order {
  const order = db.orders[orderId]
  if (!order) throw new MockApiError('NOT_FOUND', 'Pedido não encontrado.')
  if (order.userId !== userId) throw new MockApiError('FORBIDDEN', 'Este pedido pertence a outra conta.')
  settleIfDue(order)
  scheduleResolution(order)
  return toPublicOrder(order)
}

export function activeOrders(userId: string): Order[] {
  return Object.values(db.orders)
    .filter((o) => o.userId === userId)
    .map((o) => {
      settleIfDue(o)
      scheduleResolution(o)
      return o
    })
    .filter((o) => o.status === 'pending')
    .map(toPublicOrder)
}

/** Retoma timers de pedidos pendentes após recarregar a página. */
export function resumePendingOrders(): void {
  for (const order of Object.values(db.orders)) {
    settleIfDue(order)
    scheduleResolution(order)
  }
}

export function clearOrderTimers(): void {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
}

