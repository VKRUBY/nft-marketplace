import type { AddCartItemInput, Cart, CartItem, CartItemIssue, Network } from '@/contracts/domain'
import { addEth, compareEth, mulEth, percentOfEth, subEth, toWei, fromWei } from '@/shared/eth'
import { db, findCoupon, findNft, persist, toAppliedCoupon, type CartLineRecord, type CartRecord } from '../db'
import { MockApiError } from '../errors'
import { NETWORK_FEES_ETH } from '../fixtures/accounts'
import { newId } from '../rng'

/**
 * Identidade do carrinho:
 *  - visitante → `guest:<X-Guest-Cart>` (uuid gerado no navegador);
 *  - autenticado → `user:<userId>`.
 * Ao autenticar, o cliente chama /cart/merge e os itens do visitante passam
 * para o carrinho do usuário (somando quantidades, respeitando limites).
 */
export type CartOwner = { kind: 'guest'; guestId: string } | { kind: 'user'; userId: string }

export function cartKey(owner: CartOwner): string {
  return owner.kind === 'user' ? `user:${owner.userId}` : `guest:${owner.guestId}`
}

export function getOrCreateCart(owner: CartOwner): CartRecord {
  const key = cartKey(owner)
  let cart = db.carts[key]
  if (!cart) {
    cart = {
      id: newId('cart'),
      owner: owner.kind,
      ownerId: owner.kind === 'user' ? owner.userId : owner.guestId,
      lines: [],
      couponCode: null,
      version: 1,
      updatedAt: new Date().toISOString(),
    }
    db.carts[key] = cart
  }
  return cart
}

function touch(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = new Date().toISOString()
  persist()
}

export function networkFee(network: Network, lineCount: number): string {
  if (lineCount === 0) return '0'
  const fee = NETWORK_FEES_ETH[network]
  return addEth(fee.base, mulEth(fee.perExtraLine, Math.max(0, lineCount - 1)))
}

function resolveLine(line: CartLineRecord) {
  const nft = findNft(line.nftId)
  const edition = nft?.editions.find((e) => e.id === line.editionId)
  return { nft, edition }
}

export function toCartItem(line: CartLineRecord): CartItem | null {
  const { nft, edition } = resolveLine(line)
  if (!nft || !edition) return null
  const issues: CartItemIssue[] = []
  if (edition.available === 0) issues.push('SOLD_OUT')
  else if (line.quantity > edition.available) issues.push('QUANTITY_REDUCED')
  if (compareEth(edition.priceEth, line.acknowledgedPriceEth) !== 0) issues.push('PRICE_CHANGED')
  return {
    id: line.id,
    nftId: nft.id,
    slug: nft.slug,
    editionId: edition.id,
    name: nft.name,
    editionLabel: edition.label,
    tokenId: edition.tokenId,
    image: nft.image,
    quantity: line.quantity,
    unitPriceEth: edition.priceEth,
    acknowledgedPriceEth: line.acknowledgedPriceEth,
    lineTotalEth: mulEth(edition.priceEth, line.quantity),
    available: edition.available,
    maxPerOrder: edition.maxPerOrder,
    issues,
  }
}

/**
 * Valores do carrinho: subtotal pelo preço vigente; itens esgotados não
 * entram no subtotal; quantidades acima do disponível contam só o disponível.
 * O desconto do cupom é aplicado sobre o subtotal e arredondado para baixo no wei.
 */
export function priceLines(items: CartItem[], couponCode: string | null, network: Network) {
  const billable = items
    .filter((i) => i.available > 0)
    .map((i) => ({ ...i, billableQuantity: Math.min(i.quantity, i.available) }))
  const subtotal = billable.reduce((acc, i) => addEth(acc, mulEth(i.unitPriceEth, i.billableQuantity)), '0')
  const coupon = couponCode ? findCoupon(couponCode) : undefined
  const couponValid = coupon && Date.parse(coupon.expiresAt) > Date.now()
  const discount = couponValid ? percentOfEth(subtotal, coupon.percentBp) : '0'
  const fee = networkFee(network, billable.length)
  const total = addEth(subEth(subtotal, discount), fee)
  return {
    billable,
    coupon: couponValid ? toAppliedCoupon(coupon) : null,
    couponExpired: Boolean(coupon && !couponValid),
    couponMissing: Boolean(couponCode && !coupon),
    subtotal,
    discount,
    fee,
    total: fromWei(toWei(total)),
  }
}

export function toCartView(cart: CartRecord, network: Network = 'ethereum'): Cart {
  const items = cart.lines.map(toCartItem).filter((i): i is CartItem => i !== null)
  const pricing = priceLines(items, cart.couponCode, network)
  return {
    id: cart.id,
    owner: cart.owner,
    items,
    coupon: pricing.coupon,
    summary: {
      itemCount: items.reduce((acc, i) => acc + i.quantity, 0),
      subtotalEth: pricing.subtotal,
      discountEth: pricing.discount,
      networkFeeEth: pricing.fee,
      totalEth: pricing.total,
      network,
    },
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

function assertQuantity(editionAvailable: number, maxPerOrder: number, quantity: number) {
  if (editionAvailable === 0) {
    throw new MockApiError('AVAILABILITY_CONFLICT', 'Esta edição está esgotada.', { quantity: 'Edição esgotada.' })
  }
  const limit = Math.min(editionAvailable, maxPerOrder)
  if (quantity > limit) {
    throw new MockApiError(
      'AVAILABILITY_CONFLICT',
      `Quantidade máxima para esta edição: ${limit}.`,
      { quantity: `Máximo de ${limit} por pedido.` },
      { maxQuantity: limit },
    )
  }
}

export function addItem(owner: CartOwner, input: AddCartItemInput): Cart {
  const nft = findNft(input.nftId)
  const edition = nft?.editions.find((e) => e.id === input.editionId)
  if (!nft || !edition) throw new MockApiError('NOT_FOUND', 'NFT ou edição não encontrados.')
  const cart = getOrCreateCart(owner)
  const existing = cart.lines.find((l) => l.editionId === edition.id)
  const quantity = (existing?.quantity ?? 0) + input.quantity
  assertQuantity(edition.available, edition.maxPerOrder, quantity)
  if (existing) {
    existing.quantity = quantity
    existing.acknowledgedPriceEth = edition.priceEth
  } else {
    cart.lines.push({
      id: newId('ci'),
      nftId: nft.id,
      editionId: edition.id,
      quantity,
      acknowledgedPriceEth: edition.priceEth,
    })
  }
  touch(cart)
  return toCartView(cart)
}

export function updateItem(owner: CartOwner, itemId: string, quantity: number): Cart {
  const cart = getOrCreateCart(owner)
  const line = cart.lines.find((l) => l.id === itemId)
  if (!line) throw new MockApiError('NOT_FOUND', 'Item não está no carrinho.')
  const { edition } = resolveLine(line)
  if (!edition) throw new MockApiError('NOT_FOUND', 'Edição não encontrada.')
  // Diminuir é sempre permitido; aumentar respeita o estoque.
  if (quantity > line.quantity) assertQuantity(edition.available, edition.maxPerOrder, quantity)
  line.quantity = quantity
  touch(cart)
  return toCartView(cart)
}

export function removeItem(owner: CartOwner, itemId: string): Cart {
  const cart = getOrCreateCart(owner)
  const before = cart.lines.length
  cart.lines = cart.lines.filter((l) => l.id !== itemId)
  if (cart.lines.length === before) throw new MockApiError('NOT_FOUND', 'Item não está no carrinho.')
  if (cart.lines.length === 0) cart.couponCode = null
  touch(cart)
  return toCartView(cart)
}

/** Aceita os valores vigentes: atualiza preços vistos, ajusta quantidades e remove esgotados. */
export function acknowledge(owner: CartOwner): Cart {
  const cart = getOrCreateCart(owner)
  cart.lines = cart.lines.flatMap((line) => {
    const { edition } = resolveLine(line)
    if (!edition || edition.available === 0) return []
    return [
      {
        ...line,
        quantity: Math.min(line.quantity, edition.available, edition.maxPerOrder),
        acknowledgedPriceEth: edition.priceEth,
      },
    ]
  })
  touch(cart)
  return toCartView(cart)
}

export function applyCoupon(owner: CartOwner, code: string): Cart {
  const coupon = findCoupon(code)
  if (!coupon) throw new MockApiError('COUPON_INVALID', 'Cupom inválido.', { code: 'Cupom não encontrado.' })
  if (Date.parse(coupon.expiresAt) <= Date.now()) {
    throw new MockApiError('COUPON_EXPIRED', 'Este cupom expirou.', { code: 'Cupom expirado.' })
  }
  const cart = getOrCreateCart(owner)
  if (cart.lines.length === 0) {
    throw new MockApiError('VALIDATION_ERROR', 'Adicione itens antes de aplicar um cupom.', { code: 'Carrinho vazio.' })
  }
  cart.couponCode = coupon.code
  touch(cart)
  return toCartView(cart)
}

export function removeCoupon(owner: CartOwner): Cart {
  const cart = getOrCreateCart(owner)
  cart.couponCode = null
  touch(cart)
  return toCartView(cart)
}

export function mergeGuestCart(userId: string, guestId: string): Cart {
  const userCart = getOrCreateCart({ kind: 'user', userId })
  const guestKey = cartKey({ kind: 'guest', guestId })
  const guest = db.carts[guestKey]
  if (guest) {
    for (const line of guest.lines) {
      const { edition } = resolveLine(line)
      if (!edition || edition.available === 0) continue
      const existing = userCart.lines.find((l) => l.editionId === line.editionId)
      const limit = Math.min(edition.available, edition.maxPerOrder)
      if (existing) {
        existing.quantity = Math.min(limit, existing.quantity + line.quantity)
      } else {
        userCart.lines.push({ ...line, id: newId('ci'), quantity: Math.min(limit, line.quantity) })
      }
    }
    if (!userCart.couponCode && guest.couponCode) userCart.couponCode = guest.couponCode
    delete db.carts[guestKey]
  }
  touch(userCart)
  return toCartView(userCart)
}

/** Remove do carrinho apenas as quantidades efetivamente compradas. */
export function removePurchased(userId: string, purchased: Array<{ editionId: string; quantity: number }>): void {
  const cart = db.carts[cartKey({ kind: 'user', userId })]
  if (!cart) return
  cart.lines = cart.lines.flatMap((line) => {
    const bought = purchased.find((p) => p.editionId === line.editionId)
    if (!bought) return [line]
    const remaining = line.quantity - bought.quantity
    return remaining > 0 ? [{ ...line, quantity: remaining }] : []
  })
  if (cart.lines.length === 0) cart.couponCode = null
  touch(cart)
}
