import { delay, http } from 'msw'
import { z } from 'zod'
import { API } from '@/contracts/endpoints'
import {
  addCartItemSchema,
  avatarSchema,
  couponSchema,
  createOrderSchema,
  loginSchema,
  networkSchema,
  passwordChangeSchema,
  profileSchema,
  registerSchema,
  updateCartItemSchema,
  walletSchema,
} from '@/contracts/schemas'
import { MockApiError } from './errors'
import { apiPath, json, noContent, route } from './http'
import { CLIENT_TIMEOUT_MS } from './network'
import * as account from './services/account'
import * as auth from './services/auth'
import * as cart from './services/cart'
import * as catalog from './services/catalog'
import * as orders from './services/orders'

type IdParams = { id: string }

/** Padrões de rota do MSW (`:id`), espelhando os construtores de `API`. */
const PATH = {
  nftDetail: '/nfts/:id',
  favorite: '/me/favorites/:id',
  cartItem: '/cart/items/:id',
  order: '/orders/:id',
  wallet: '/me/wallets/:id',
  walletConnect: '/me/wallets/:id/connect',
  walletDisconnect: '/me/wallets/:id/disconnect',
}

export const handlers = [
  // ─── Sessão e conta ────────────────────────────────────────────────────────
  http.post(
    apiPath(API.auth.register),
    route(async ({ body }) => json(await auth.register(await body(registerSchema)), 201)),
  ),
  http.post(
    apiPath(API.auth.login),
    route(async ({ body }) => json(await auth.login(await body(loginSchema)))),
  ),
  http.get(
    apiPath(API.auth.session),
    route(({ request }) => json(auth.getSession(request.headers.get('authorization')))),
  ),
  http.post(
    apiPath(API.auth.logout),
    route(({ request }) => {
      auth.logout(request.headers.get('authorization'))
      return noContent()
    }),
  ),

  // ─── Catálogo ──────────────────────────────────────────────────────────────
  http.get(
    apiPath(API.nfts.highlights),
    route(() => json(catalog.getHighlights())),
  ),
  http.get(
    apiPath(API.nfts.list),
    route(({ request }) => {
      const params = catalog.parseListParams(new URL(request.url).searchParams)
      return json(catalog.listNfts(params))
    }),
  ),
  http.get<IdParams>(
    apiPath(PATH.nftDetail),
    route<IdParams>(({ params }) => json(catalog.getNft(params.id))),
  ),

  // ─── Favoritos ─────────────────────────────────────────────────────────────
  http.get(
    apiPath(API.favorites.list),
    route(({ userId }) => json(account.getFavorites(userId())), { private: true }),
  ),
  http.put<IdParams>(
    apiPath(PATH.favorite),
    route<IdParams>(({ userId, params }) => json(account.setFavorite(userId(), params.id, true)), { private: true }),
  ),
  http.delete<IdParams>(
    apiPath(PATH.favorite),
    route<IdParams>(({ userId, params }) => json(account.setFavorite(userId(), params.id, false)), { private: true }),
  ),

  // ─── Carrinho ──────────────────────────────────────────────────────────────
  http.get(
    apiPath(API.cart.root),
    route(({ owner, request }) => {
      const network = networkSchema.catch('ethereum').parse(new URL(request.url).searchParams.get('network') ?? undefined)
      return json(cart.toCartView(cart.getOrCreateCart(owner()), network))
    }),
  ),
  http.post(
    apiPath(API.cart.items),
    route(async ({ owner, body }) => json(cart.addItem(owner(), await body(addCartItemSchema)))),
  ),
  http.patch<IdParams>(
    apiPath(PATH.cartItem),
    route<IdParams>(async ({ owner, body, params }) =>
      json(cart.updateItem(owner(), params.id, (await body(updateCartItemSchema)).quantity)),
    ),
  ),
  http.delete<IdParams>(
    apiPath(PATH.cartItem),
    route<IdParams>(({ owner, params }) => json(cart.removeItem(owner(), params.id))),
  ),
  http.post(
    apiPath(API.cart.acknowledge),
    route(({ owner }) => json(cart.acknowledge(owner()))),
  ),
  http.put(
    apiPath(API.cart.coupon),
    route(async ({ owner, body }) => json(cart.applyCoupon(owner(), (await body(couponSchema)).code))),
  ),
  http.delete(
    apiPath(API.cart.coupon),
    route(({ owner }) => json(cart.removeCoupon(owner()))),
  ),
  http.post(
    apiPath(API.cart.merge),
    route(
      async ({ userId, body }) => {
        const { guestCartId } = await body(z.object({ guestCartId: z.string().min(8).max(64) }))
        return json(cart.mergeGuestCart(userId(), guestCartId))
      },
      { private: true },
    ),
  ),

  // ─── Cotação e pedidos ─────────────────────────────────────────────────────
  http.post(
    apiPath(API.checkout.quote),
    route(
      async ({ userId, body }) => {
        const { network } = await body(z.object({ network: networkSchema }))
        return json(orders.createQuote(userId(), network))
      },
      { private: true },
    ),
  ),
  http.post(
    apiPath(API.orders.create),
    route(
      async ({ userId, body, request }) => {
        const key = request.headers.get('idempotency-key')
        if (!key || !/^[\w-]{8,128}$/.test(key)) {
          throw new MockApiError('VALIDATION_ERROR', 'Cabeçalho Idempotency-Key ausente ou inválido.')
        }
        const result = orders.createOrder(userId(), key, await body(createOrderSchema))
        // Cenário `order-timeout`: o pedido já existe, mas a resposta chega depois do timeout do cliente.
        if (result.delayResponse) await delay(CLIENT_TIMEOUT_MS + 3_000)
        return json(result.order, result.replayed ? 200 : 201)
      },
      { private: true },
    ),
  ),
  http.get(
    apiPath(API.orders.active),
    route(({ userId }) => json(orders.activeOrders(userId())), { private: true }),
  ),
  http.get<IdParams>(
    apiPath(PATH.order),
    route<IdParams>(({ userId, params }) => json(orders.getOrder(userId(), params.id)), { private: true }),
  ),

  // ─── Perfil ────────────────────────────────────────────────────────────────
  http.get(
    apiPath(API.profile.root),
    route(({ userId }) => json(account.getProfile(userId())), { private: true }),
  ),
  http.patch(
    apiPath(API.profile.root),
    route(async ({ userId, body }) => json(account.updateProfile(userId(), await body(profileSchema))), {
      private: true,
    }),
  ),
  http.put(
    apiPath(API.profile.avatar),
    route(async ({ userId, body }) => json(account.updateAvatar(userId(), await body(avatarSchema))), {
      private: true,
    }),
  ),
  http.post(
    apiPath(API.profile.password),
    route(
      async ({ userId, body }) => {
        await account.changePassword(userId(), await body(passwordChangeSchema))
        return noContent()
      },
      { private: true },
    ),
  ),

  // ─── Carteiras ─────────────────────────────────────────────────────────────
  http.get(
    apiPath(API.wallets.list),
    route(
      ({ userId }) => {
        const id = userId()
        return json(account.listWallets(id).map((w) => ({ ...w, connection: account.getWalletConnection(id, w.id) })))
      },
      { private: true },
    ),
  ),
  http.post(
    apiPath(API.wallets.list),
    route(async ({ userId, body }) => json(account.createWallet(userId(), await body(walletSchema)), 201), {
      private: true,
    }),
  ),
  http.patch<IdParams>(
    apiPath(PATH.wallet),
    route<IdParams>(
      async ({ userId, body, params }) => json(account.updateWallet(userId(), params.id, await body(walletSchema))),
      { private: true },
    ),
  ),
  http.post<IdParams>(
    apiPath(PATH.walletConnect),
    route<IdParams>(
      async ({ userId, body, params }) => {
        const { network } = await body(z.object({ network: networkSchema }))
        return json(account.connectWallet(userId(), params.id, network))
      },
      { private: true },
    ),
  ),
  http.post<IdParams>(
    apiPath(PATH.walletDisconnect),
    route<IdParams>(({ userId, params }) => json(account.disconnectWallet(userId(), params.id)), { private: true }),
  ),

  // Qualquer outra rota da API: 404 no envelope padrão.
  http.all(
    apiPath('/*'),
    route(() => {
      throw new MockApiError('NOT_FOUND', 'Rota não encontrada.')
    }),
  ),
]
