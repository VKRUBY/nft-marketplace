import type { EthString } from '@/shared/eth'

/** ISO-8601 em UTC. */
export type IsoDate = string

// ─── Conta e sessão ──────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  username: string
  email: string
  phone: string | null
  bio: string | null
  avatarUrl: string | null
  country: string | null
  city: string | null
  website: string | null
  createdAt: IsoDate
  updatedAt: IsoDate
}

export interface Session {
  user: User
  /** Momento em que o token deixa de ser aceito pela API. */
  expiresAt: IsoDate
}

export interface AuthResponse {
  token: string
  session: Session
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  name: string
  username: string
  email: string
  password: string
  acceptTerms: true
}

export type ProfileUpdateInput = Partial<
  Pick<User, 'name' | 'username' | 'email' | 'phone' | 'bio' | 'country' | 'city' | 'website'>
>

export interface AvatarUpdateInput {
  /** data URL (image/png | image/jpeg | image/webp), até 2 MB. */
  dataUrl: string
}

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}

// ─── Catálogo ────────────────────────────────────────────────────────────────

export type NftCategory = 'art' | 'collectible' | 'music' | 'photography' | 'gaming' | 'pfp'
export type NftRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type AvailabilityStatus = 'available' | 'sold_out'

export interface NftImage {
  url: string
  alt: string
  width: number
  height: number
}

export interface Edition {
  id: string
  /** Rótulo exibido ao colecionador, ex.: "Edição Gênesis". */
  label: string
  /** Identificador do token na simulação, ex.: "#0314". */
  tokenId: string
  priceEth: EthString
  supply: number
  available: number
  maxPerOrder: number
  status: AvailabilityStatus
}

export interface Creator {
  id: string
  name: string
  handle: string
  avatarUrl: string
  verified: boolean
}

export interface Collection {
  id: string
  name: string
  verified: boolean
}

export interface NftSummary {
  id: string
  slug: string
  name: string
  image: NftImage
  category: NftCategory
  rarity: NftRarity
  collection: Collection
  creator: Creator
  /** Menor preço entre as edições disponíveis (ou entre todas, se esgotado). */
  floorPriceEth: EthString
  totalAvailable: number
  status: AvailabilityStatus
  likes: number
  createdAt: IsoDate
  /** Versão monotônica do recurso; usada para ignorar eventos antigos. */
  version: number
}

export interface Nft extends NftSummary {
  description: string
  images: NftImage[]
  editions: Edition[]
  contractAddress: string
  blockchain: Network
  properties: Array<{ trait: string; value: string }>
}

export type NftSort = 'recent' | 'price_asc' | 'price_desc' | 'popular'

export interface NftListParams {
  q?: string
  category?: NftCategory[]
  rarity?: NftRarity[]
  status?: AvailabilityStatus
  minPrice?: EthString
  maxPrice?: EthString
  sort?: NftSort
  page?: number
  pageSize?: number
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface Highlights {
  hero: NftSummary[]
  trending: NftSummary[]
}

// ─── Favoritos ───────────────────────────────────────────────────────────────

export interface Favorites {
  nftIds: string[]
}

// ─── Carrinho ────────────────────────────────────────────────────────────────

export type CartItemIssue = 'PRICE_CHANGED' | 'QUANTITY_REDUCED' | 'SOLD_OUT'

export interface CartItem {
  id: string
  nftId: string
  editionId: string
  name: string
  editionLabel: string
  tokenId: string
  image: NftImage
  quantity: number
  /** Preço vigente no catálogo. */
  unitPriceEth: EthString
  /** Preço visto pelo colecionador ao adicionar ou ao último aceite. */
  acknowledgedPriceEth: EthString
  lineTotalEth: EthString
  available: number
  maxPerOrder: number
  issues: CartItemIssue[]
}

export interface AppliedCoupon {
  code: string
  description: string
  /** Desconto em pontos-base (1000 = 10%). */
  percentBp: number
  expiresAt: IsoDate
}

export interface CartSummary {
  itemCount: number
  subtotalEth: EthString
  discountEth: EthString
  networkFeeEth: EthString
  totalEth: EthString
  network: Network
}

export interface Cart {
  id: string
  owner: 'guest' | 'user'
  items: CartItem[]
  coupon: AppliedCoupon | null
  summary: CartSummary
  version: number
  updatedAt: IsoDate
}

export interface AddCartItemInput {
  nftId: string
  editionId: string
  quantity: number
}

// ─── Carteiras e redes ───────────────────────────────────────────────────────

export type Network = 'ethereum' | 'polygon' | 'arbitrum' | 'base'
export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase' | 'rainbow'
export type WalletRole = 'primary' | 'secondary'

export interface Wallet {
  id: string
  role: WalletRole
  label: string
  provider: WalletProvider
  address: string
  ens: string | null
  networks: Network[]
  createdAt: IsoDate
  updatedAt: IsoDate
}

export interface WalletInput {
  role: WalletRole
  label: string
  provider: WalletProvider
  address: string
  ens?: string | null
  networks: Network[]
}

export type WalletConnectionStatus = 'connected' | 'disconnected'

export interface WalletConnection {
  walletId: string
  network: Network
  status: WalletConnectionStatus
  connectedAt: IsoDate | null
}

/** Carteira como retornada por GET /me/wallets: inclui o estado da conexão simulada. */
export interface WalletView extends Wallet {
  connection: WalletConnection | null
}

// ─── Cotação e pedido ────────────────────────────────────────────────────────

export type QuoteIssueCode =
  | 'PRICE_CHANGED'
  | 'QUANTITY_REDUCED'
  | 'SOLD_OUT'
  | 'COUPON_EXPIRED'
  | 'COUPON_INVALID'
  | 'FEE_CHANGED'

export interface QuoteIssue {
  code: QuoteIssueCode
  itemId?: string
  message: string
}

export interface QuoteLine {
  itemId: string
  nftId: string
  editionId: string
  name: string
  editionLabel: string
  tokenId: string
  image: NftImage
  quantity: number
  unitPriceEth: EthString
  lineTotalEth: EthString
}

export interface Quote {
  id: string
  cartVersion: number
  network: Network
  lines: QuoteLine[]
  coupon: AppliedCoupon | null
  subtotalEth: EthString
  discountEth: EthString
  networkFeeEth: EthString
  totalEth: EthString
  issues: QuoteIssue[]
  createdAt: IsoDate
  expiresAt: IsoDate
}

export interface QuoteInput {
  network: Network
}

export interface BuyerInfo {
  name: string
  email: string
  phone: string
  country: string
  city: string
}

export interface CreateOrderInput {
  quoteId: string
  walletId: string
  network: Network
  buyer: BuyerInfo
}

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface Order {
  id: string
  status: OrderStatus
  /** Snapshot imutável da cotação aceita; o recibo é sempre renderizado daqui. */
  lines: QuoteLine[]
  coupon: AppliedCoupon | null
  subtotalEth: EthString
  discountEth: EthString
  networkFeeEth: EthString
  totalEth: EthString
  network: Network
  wallet: Pick<Wallet, 'id' | 'label' | 'address' | 'provider'>
  buyer: BuyerInfo
  txHash: string | null
  explorerUrl: string | null
  declineReason: string | null
  createdAt: IsoDate
  updatedAt: IsoDate
  version: number
}

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['confirmed', 'declined']
