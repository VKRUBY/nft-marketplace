import type { EthString } from '@/shared/eth'

/** ISO-8601 em UTC. */
export type IsoDate = string

// ─── Conta e sessão ──────────────────────────────────────────────────────────

/** Perfil do colecionador (campos do frame "Perfil do Colecionador"). */
export interface User {
  id: string
  /** "Nome de exibição". */
  name: string
  /** "Nome de usuário". */
  username: string
  email: string
  /** "Nome ENS" sem o sufixo, ex.: "ana" → ana.eth. */
  ensName: string | null
  /** "Apelido da carteira". */
  walletNickname: string | null
  avatarUrl: string | null
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

/** Frame "Cadastro": nome de usuário, e-mail, senha e confirmação. */
export interface RegisterInput {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export type ProfileUpdateInput = Partial<Pick<User, 'name' | 'username' | 'email' | 'ensName' | 'walletNickname'>>

export interface AvatarUpdateInput {
  /** data URL (image/png | image/jpeg | image/webp) ou `null` para remover. */
  dataUrl: string | null
}

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

// ─── Catálogo ────────────────────────────────────────────────────────────────

/** Coleções da barra lateral do Início. */
export type NftCategory =
  | 'digital_art'
  | 'photography'
  | 'music'
  | 'art_3d'
  | 'collectible'
  | 'generative'
  | 'gaming'
  | 'subscription'
  | 'utility'

export type AvailabilityStatus = 'available' | 'sold_out'

/** Abas do catálogo: Todos os NFTs, Novos lançamentos, Em alta. */
export type CatalogTab = 'all' | 'new' | 'trending'

export interface NftImage {
  url: string
  /** Variações responsivas no formato do atributo `srcset`. */
  srcSet: string
  alt: string
  width: number
  height: number
}

export type EditionKind = 'unique' | 'limited' | 'open'

export interface Edition {
  id: string
  /** Rótulo do seletor de edição: "1/1", "1/10", "1/50", "ABERTA". */
  label: string
  kind: EditionKind
  /** "ID do token", ex.: "#0042". */
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
}

export interface Collection {
  id: string
  name: string
}

export interface NftSummary {
  id: string
  slug: string
  name: string
  image: NftImage
  category: NftCategory
  network: Network
  collection: Collection
  /** Menor preço entre as edições disponíveis (ou entre todas, se esgotado). */
  floorPriceEth: EthString
  /** Preço anterior exibido riscado ao lado do atual, quando há promoção. */
  compareAtPriceEth: EthString | null
  totalAvailable: number
  status: AvailabilityStatus
  /** Exibe o selo "RARO". */
  rare: boolean
  isNewRelease: boolean
  isTrending: boolean
  likes: number
  rating: number
  reviewCount: number
  createdAt: IsoDate
  /** Versão monotônica do recurso; usada para ignorar eventos antigos. */
  version: number
}

export interface Review {
  id: string
  author: string
  rating: number
  comment: string
  createdAt: IsoDate
}

export interface Nft extends NftSummary {
  description: string
  longDescription: string[]
  images: NftImage[]
  editions: Edition[]
  creator: Creator
  attributes: string[]
  contractAddress: string
  royaltyPercent: number
  reviews: Review[]
}

export type NftSort = 'recent' | 'price_asc' | 'price_desc' | 'popular'

export interface NftListParams {
  q?: string
  tab?: CatalogTab
  category?: NftCategory[]
  network?: Network[]
  status?: AvailabilityStatus
  minPrice?: EthString
  maxPrice?: EthString
  sort?: NftSort
  page?: number
  pageSize?: number
  /** Exclui um NFT (usado em "Mais desta coleção"). */
  exclude?: string
  collection?: string
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Contagens da barra lateral e limites do filtro de preço. */
export interface CatalogFacets {
  categories: Array<{ id: NftCategory; count: number }>
  networks: Array<{ id: Network; count: number }>
  priceRange: { min: EthString; max: EthString }
}

export interface Highlights {
  /** Slides do carrossel do topo. */
  hero: NftSummary[]
  /** "NFT em destaque — oferta limitada". */
  featured: NftSummary | null
  /** "Colecionadores também viram". */
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
  slug: string
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

export type Network = 'ethereum' | 'polygon' | 'solana'
export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase'
export type WalletRole = 'primary' | 'secondary'

/** Campos do frame "Carteiras" (repetidos no "Perfil do colecionador" do Pagamento). */
export interface WalletDetails {
  /** "Nome de exibição". */
  displayName: string
  /** "Apelido da carteira" — ex.: "Principal", "Reserva". */
  nickname: string
  network: Network
  /** "Nome do perfil". */
  profileName: string
  /** "Endereço da carteira" (0x…). */
  address: string
  /** "ENS ou carteira secundária (opcional)". */
  secondaryAddress: string | null
  /** "Tipo de carteira". */
  provider: WalletProvider
  /** "Código de indicação" (opcional; ver ARCHITECTURE.md). */
  referralCode: string | null
  email: string
  /** "Nome ENS" sem o sufixo .eth (opcional; ver ARCHITECTURE.md). */
  ensName: string | null
}

export interface Wallet extends WalletDetails {
  id: string
  role: WalletRole
  createdAt: IsoDate
  updatedAt: IsoDate
}

export interface WalletInput extends WalletDetails {
  role: WalletRole
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

/** Dados do "Perfil do colecionador" enviados com o pedido. */
export interface BuyerInfo extends Omit<WalletDetails, 'nickname'> {
  /** "Nome de usuário". */
  username: string
  /** "Observação do colecionador (opcional)". */
  note: string | null
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
  wallet: Pick<Wallet, 'id' | 'nickname' | 'address' | 'provider'>
  buyer: BuyerInfo
  txHash: string | null
  explorerUrl: string | null
  declineReason: string | null
  createdAt: IsoDate
  updatedAt: IsoDate
  version: number
}

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['confirmed', 'declined']
