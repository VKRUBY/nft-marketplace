/**
 * Rotas REST compartilhadas entre o cliente Axios e os handlers MSW.
 * Base: `VITE_API_URL` (padrão `/api`).
 *
 * Cabeçalhos:
 *  - `Authorization: Bearer <token>` nas rotas autenticadas.
 *  - `X-Guest-Cart: <uuid>` identifica o carrinho do visitante.
 *  - `Idempotency-Key: <uuid>` obrigatório em POST /orders.
 */
export const API = {
  auth: {
    register: '/auth/register', // POST RegisterInput → 201 AuthResponse
    login: '/auth/login', // POST LoginInput → 200 AuthResponse
    session: '/auth/session', // GET → 200 Session | 401
    logout: '/auth/logout', // POST → 204
  },
  nfts: {
    list: '/nfts', // GET NftListParams (query) → Page<NftSummary>
    highlights: '/nfts/highlights', // GET → Highlights
    detail: (idOrSlug: string) => `/nfts/${encodeURIComponent(idOrSlug)}`, // GET → Nft | 404
  },
  favorites: {
    list: '/me/favorites', // GET → Favorites
    item: (nftId: string) => `/me/favorites/${encodeURIComponent(nftId)}`, // PUT | DELETE → Favorites
  },
  cart: {
    root: '/cart', // GET → Cart
    items: '/cart/items', // POST AddCartItemInput → Cart | 409 AVAILABILITY_CONFLICT
    item: (itemId: string) => `/cart/items/${encodeURIComponent(itemId)}`, // PATCH {quantity} | DELETE → Cart
    acknowledge: '/cart/acknowledge', // POST → Cart (aceita preços/quantidades vigentes)
    coupon: '/cart/coupon', // PUT {code} → Cart | 422 ; DELETE → Cart
    merge: '/cart/merge', // POST {guestCartId} → Cart
  },
  checkout: {
    quote: '/checkout/quote', // POST QuoteInput → Quote
  },
  orders: {
    create: '/orders', // POST CreateOrderInput + Idempotency-Key → 201/200 Order | 409
    active: '/orders/active', // GET → Order[] (pedidos pendentes do usuário)
    detail: (orderId: string) => `/orders/${encodeURIComponent(orderId)}`, // GET → Order
  },
  profile: {
    root: '/me/profile', // GET → User ; PATCH ProfileUpdateInput → User
    avatar: '/me/avatar', // PUT AvatarUpdateInput → User
    password: '/me/password', // POST PasswordChangeInput → 204
  },
  wallets: {
    list: '/me/wallets', // GET → Wallet[] ; POST WalletInput → 201 Wallet
    item: (walletId: string) => `/me/wallets/${encodeURIComponent(walletId)}`, // PATCH WalletInput → Wallet
    connect: (walletId: string) => `/me/wallets/${encodeURIComponent(walletId)}/connect`, // POST {network} → WalletConnection | 422 WALLET_REJECTED
    disconnect: (walletId: string) => `/me/wallets/${encodeURIComponent(walletId)}/disconnect`, // POST → WalletConnection
  },
} as const

export const SOCKET_PATH = '/socket.io/'
