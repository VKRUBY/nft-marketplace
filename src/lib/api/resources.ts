import type {
  AddCartItemInput,
  AuthResponse,
  AvatarUpdateInput,
  Cart,
  CreateOrderInput,
  Favorites,
  Highlights,
  LoginInput,
  Network,
  Nft,
  NftListParams,
  NftSummary,
  Order,
  Page,
  PasswordChangeInput,
  ProfileUpdateInput,
  Quote,
  RegisterInput,
  Session,
  User,
  Wallet,
  WalletConnection,
  WalletInput,
  WalletView,
} from '@/contracts/domain'
import { API } from '@/contracts/endpoints'
import { request } from './client'

type Signal = { signal?: AbortSignal }

/** Serializa listas como `a,b` (formato aceito pela API). Remove vazios. */
export function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(','))
    } else {
      search.set(key, String(value))
    }
  }
  return search.toString()
}

export const authApi = {
  register: (input: RegisterInput) => request<AuthResponse>({ method: 'POST', url: API.auth.register, data: input }),
  login: (input: LoginInput) => request<AuthResponse>({ method: 'POST', url: API.auth.login, data: input }),
  session: ({ signal }: Signal = {}) => request<Session>({ url: API.auth.session, signal }),
  logout: () => request<void>({ method: 'POST', url: API.auth.logout }),
}

export const nftApi = {
  list: (params: NftListParams, { signal }: Signal = {}) =>
    request<Page<NftSummary>>({
      url: API.nfts.list,
      params,
      paramsSerializer: { serialize: (p) => toQueryString(p as Record<string, unknown>) },
      signal,
    }),
  highlights: ({ signal }: Signal = {}) => request<Highlights>({ url: API.nfts.highlights, signal }),
  detail: (idOrSlug: string, { signal }: Signal = {}) => request<Nft>({ url: API.nfts.detail(idOrSlug), signal }),
}

export const favoritesApi = {
  list: ({ signal }: Signal = {}) => request<Favorites>({ url: API.favorites.list, signal }),
  add: (nftId: string) => request<Favorites>({ method: 'PUT', url: API.favorites.item(nftId) }),
  remove: (nftId: string) => request<Favorites>({ method: 'DELETE', url: API.favorites.item(nftId) }),
}

export const cartApi = {
  get: (network: Network | undefined, { signal }: Signal = {}) =>
    request<Cart>({ url: API.cart.root, params: network ? { network } : undefined, signal }),
  add: (input: AddCartItemInput) => request<Cart>({ method: 'POST', url: API.cart.items, data: input }),
  update: (itemId: string, quantity: number) =>
    request<Cart>({ method: 'PATCH', url: API.cart.item(itemId), data: { quantity } }),
  remove: (itemId: string) => request<Cart>({ method: 'DELETE', url: API.cart.item(itemId) }),
  acknowledge: () => request<Cart>({ method: 'POST', url: API.cart.acknowledge }),
  applyCoupon: (code: string) => request<Cart>({ method: 'PUT', url: API.cart.coupon, data: { code } }),
  removeCoupon: () => request<Cart>({ method: 'DELETE', url: API.cart.coupon }),
  merge: (guestCartId: string) => request<Cart>({ method: 'POST', url: API.cart.merge, data: { guestCartId } }),
}

export const checkoutApi = {
  quote: (network: Network) => request<Quote>({ method: 'POST', url: API.checkout.quote, data: { network } }),
}

export const ordersApi = {
  create: (input: CreateOrderInput, idempotencyKey: string) =>
    request<Order>({
      method: 'POST',
      url: API.orders.create,
      data: input,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  active: ({ signal }: Signal = {}) => request<Order[]>({ url: API.orders.active, signal }),
  detail: (orderId: string, { signal }: Signal = {}) => request<Order>({ url: API.orders.detail(orderId), signal }),
}

export const profileApi = {
  get: ({ signal }: Signal = {}) => request<User>({ url: API.profile.root, signal }),
  update: (input: ProfileUpdateInput) => request<User>({ method: 'PATCH', url: API.profile.root, data: input }),
  avatar: (input: AvatarUpdateInput) => request<User>({ method: 'PUT', url: API.profile.avatar, data: input }),
  changePassword: (input: PasswordChangeInput) =>
    request<void>({ method: 'POST', url: API.profile.password, data: input }),
}

export const walletsApi = {
  list: ({ signal }: Signal = {}) => request<WalletView[]>({ url: API.wallets.list, signal }),
  create: (input: WalletInput) => request<Wallet>({ method: 'POST', url: API.wallets.list, data: input }),
  update: (walletId: string, input: WalletInput) =>
    request<Wallet>({ method: 'PATCH', url: API.wallets.item(walletId), data: input }),
  connect: (walletId: string, network: Network) =>
    request<WalletConnection>({ method: 'POST', url: API.wallets.connect(walletId), data: { network } }),
  disconnect: (walletId: string) =>
    request<WalletConnection>({ method: 'POST', url: API.wallets.disconnect(walletId) }),
}
