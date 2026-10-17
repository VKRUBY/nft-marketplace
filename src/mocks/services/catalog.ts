import type {
  CatalogFacets,
  CatalogTab,
  Highlights,
  Network,
  Nft,
  NftCategory,
  NftListParams,
  NftSort,
  NftSummary,
  Page,
} from '@/contracts/domain'
import { CATEGORY_LIST, NETWORK_LIST } from '@/contracts/networks'
import { compareEth, isEthString, maxEth, minEth } from '@/shared/eth'
import { db, findNft, persist } from '../db'
import { MockApiError } from '../errors'
import { recomputeAggregates } from '../fixtures/catalog'
import { publishNftUpdated } from '../realtime-hub'

const SORTS: NftSort[] = ['recent', 'price_asc', 'price_desc', 'popular']
const TABS: CatalogTab[] = ['all', 'new', 'trending']
export const MAX_PAGE_SIZE = 48

export function toSummary(nft: Nft): NftSummary {
  const {
    description: _d,
    longDescription: _l,
    images: _i,
    editions: _e,
    creator: _c,
    attributes: _a,
    contractAddress: _ca,
    royaltyPercent: _r,
    reviews: _rv,
    ...summary
  } = nft
  return summary
}

export type ParsedListParams = Required<Pick<NftListParams, 'page' | 'pageSize' | 'sort' | 'tab'>> & NftListParams

/** Converte a query string em parâmetros validados; valores inválidos geram 400. */
export function parseListParams(search: URLSearchParams): ParsedListParams {
  const fieldErrors: Record<string, string> = {}
  const list = (key: string) =>
    search
      .getAll(key)
      .flatMap((v) => v.split(','))
      .filter(Boolean)

  const category = list('category') as NftCategory[]
  if (category.some((c) => !CATEGORY_LIST.includes(c))) fieldErrors.category = 'Coleção desconhecida.'
  const network = list('network') as Network[]
  if (network.some((n) => !NETWORK_LIST.includes(n))) fieldErrors.network = 'Rede desconhecida.'
  const tab = (search.get('tab') ?? 'all') as CatalogTab
  if (!TABS.includes(tab)) fieldErrors.tab = 'Aba inválida.'
  const status = search.get('status') ?? undefined
  if (status && status !== 'available' && status !== 'sold_out') fieldErrors.status = 'Status inválido.'
  const minPrice = search.get('minPrice') ?? undefined
  const maxPrice = search.get('maxPrice') ?? undefined
  if (minPrice && !isEthString(minPrice)) fieldErrors.minPrice = 'Preço mínimo inválido.'
  if (maxPrice && !isEthString(maxPrice)) fieldErrors.maxPrice = 'Preço máximo inválido.'
  if (minPrice && maxPrice && isEthString(minPrice) && isEthString(maxPrice) && compareEth(minPrice, maxPrice) > 0) {
    fieldErrors.minPrice = 'O preço mínimo é maior que o máximo.'
  }
  const sort = (search.get('sort') ?? 'recent') as NftSort
  if (!SORTS.includes(sort)) fieldErrors.sort = 'Ordenação inválida.'
  const page = Number(search.get('page') ?? 1)
  const pageSize = Number(search.get('pageSize') ?? 12)
  if (!Number.isInteger(page) || page < 1) fieldErrors.page = 'Página inválida.'
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) fieldErrors.pageSize = 'Tamanho de página inválido.'

  if (Object.keys(fieldErrors).length > 0) {
    throw new MockApiError('VALIDATION_ERROR', 'Parâmetros de busca inválidos.', fieldErrors)
  }
  return {
    q: search.get('q')?.trim() || undefined,
    tab,
    category: category.length ? category : undefined,
    network: network.length ? network : undefined,
    status: status as NftListParams['status'],
    minPrice,
    maxPrice,
    sort,
    page,
    pageSize,
    exclude: search.get('exclude') || undefined,
    collection: search.get('collection') || undefined,
  }
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function listNfts(params: ParsedListParams): Page<NftSummary> {
  const q = params.q ? normalize(params.q) : null
  let items = db.nfts.filter((nft) => {
    if (q) {
      const haystack = normalize(`${nft.name} ${nft.collection.name} ${nft.creator.name} ${nft.creator.handle}`)
      if (!haystack.includes(q)) return false
    }
    if (params.tab === 'new' && !nft.isNewRelease) return false
    if (params.tab === 'trending' && !nft.isTrending) return false
    if (params.category && !params.category.includes(nft.category)) return false
    if (params.network && !params.network.includes(nft.network)) return false
    if (params.status && nft.status !== params.status) return false
    if (params.minPrice && compareEth(nft.floorPriceEth, params.minPrice) < 0) return false
    if (params.maxPrice && compareEth(nft.floorPriceEth, params.maxPrice) > 0) return false
    if (params.exclude && (nft.id === params.exclude || nft.slug === params.exclude)) return false
    if (params.collection && nft.collection.id !== params.collection) return false
    return true
  })

  const byRecent = (a: Nft, b: Nft) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
  items = [...items].sort((a, b) => {
    switch (params.sort) {
      case 'price_asc':
        return compareEth(a.floorPriceEth, b.floorPriceEth) || byRecent(a, b)
      case 'price_desc':
        return compareEth(b.floorPriceEth, a.floorPriceEth) || byRecent(a, b)
      case 'popular':
        return b.likes - a.likes || byRecent(a, b)
      default:
        return byRecent(a, b)
    }
  })

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize))
  const start = (params.page - 1) * params.pageSize
  return {
    items: items.slice(start, start + params.pageSize).map(toSummary),
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
  }
}

/** Contagens reais do catálogo para a barra lateral e limites do filtro de preço. */
export function getFacets(): CatalogFacets {
  const prices = db.nfts.map((n) => n.floorPriceEth)
  return {
    categories: CATEGORY_LIST.map((id) => ({ id, count: db.nfts.filter((n) => n.category === id).length })),
    networks: NETWORK_LIST.map((id) => ({ id, count: db.nfts.filter((n) => n.network === id).length })),
    priceRange: {
      min: prices.length ? prices.reduce((a, b) => minEth(a, b)) : '0',
      max: prices.length ? prices.reduce((a, b) => maxEth(a, b)) : '0',
    },
  }
}

export function getHighlights(): Highlights {
  const available = db.nfts.filter((n) => n.status === 'available')
  const popular = [...available].sort((a, b) => b.likes - a.likes || a.id.localeCompare(b.id))
  const featured = available.find((n) => n.compareAtPriceEth && n.rare) ?? popular[0] ?? null
  return {
    hero: popular.slice(0, 3).map(toSummary),
    featured: featured ? toSummary(featured) : null,
    trending: popular.slice(3, 13).map(toSummary),
  }
}

export function getNft(idOrSlug: string): Nft {
  const nft = findNft(idOrSlug)
  if (!nft) throw new MockApiError('NOT_FOUND', 'NFT não encontrado.')
  return nft
}

/**
 * Altera preço e/ou disponibilidade de uma edição, incrementa a versão do
 * NFT e publica `nft.updated`. Usado pelos cenários e pelos controles de teste.
 */
export function updateEdition(
  nftId: string,
  editionId: string,
  patch: { priceEth?: string; available?: number },
): Nft {
  const index = db.nfts.findIndex((n) => n.id === nftId)
  const current = db.nfts[index]
  if (!current) throw new MockApiError('NOT_FOUND', 'NFT não encontrado.')
  if (!current.editions.some((e) => e.id === editionId)) throw new MockApiError('NOT_FOUND', 'Edição não encontrada.')
  const next = recomputeAggregates({
    ...current,
    version: current.version + 1,
    editions: current.editions.map((e) =>
      e.id === editionId
        ? {
            ...e,
            ...(patch.priceEth !== undefined ? { priceEth: patch.priceEth } : {}),
            ...(patch.available !== undefined ? { available: Math.max(0, Math.min(e.supply, patch.available)) } : {}),
          }
        : e,
    ),
  })
  db.nfts[index] = next
  persist()
  publishNftUpdated(next)
  return next
}

/** Ajusta o estoque de várias edições de uma vez (reserva/devolução de pedido). */
export function adjustStock(changes: Array<{ nftId: string; editionId: string; delta: number }>): void {
  const touched = new Set<string>()
  for (const change of changes) {
    const index = db.nfts.findIndex((n) => n.id === change.nftId)
    const nft = db.nfts[index]
    if (!nft) continue
    db.nfts[index] = {
      ...nft,
      editions: nft.editions.map((e) =>
        e.id === change.editionId ? { ...e, available: Math.max(0, Math.min(e.supply, e.available + change.delta)) } : e,
      ),
    }
    touched.add(change.nftId)
  }
  for (const nftId of touched) {
    const index = db.nfts.findIndex((n) => n.id === nftId)
    const next = recomputeAggregates({ ...db.nfts[index]!, version: db.nfts[index]!.version + 1 })
    db.nfts[index] = next
    publishNftUpdated(next)
  }
  persist()
}
