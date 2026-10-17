import type { Highlights, Nft, NftCategory, NftListParams, NftRarity, NftSort, NftSummary, Page } from '@/contracts/domain'
import { compareEth, isEthString } from '@/shared/eth'
import { db, findNft, persist } from '../db'
import { MockApiError } from '../errors'
import { recomputeAggregates } from '../fixtures/catalog'
import { publishNftUpdated } from '../realtime-hub'

const CATEGORIES: NftCategory[] = ['art', 'collectible', 'music', 'photography', 'gaming', 'pfp']
const RARITIES: NftRarity[] = ['common', 'rare', 'epic', 'legendary']
const SORTS: NftSort[] = ['recent', 'price_asc', 'price_desc', 'popular']
export const MAX_PAGE_SIZE = 48

export function toSummary(nft: Nft): NftSummary {
  const {
    description: _d,
    images: _i,
    editions: _e,
    contractAddress: _c,
    blockchain: _b,
    properties: _p,
    ...summary
  } = nft
  return summary
}

/** Converte a query string em parâmetros validados; valores inválidos geram 400. */
export function parseListParams(search: URLSearchParams): Required<Pick<NftListParams, 'page' | 'pageSize' | 'sort'>> &
  NftListParams {
  const fieldErrors: Record<string, string> = {}
  const list = (key: string) =>
    search
      .getAll(key)
      .flatMap((v) => v.split(','))
      .filter(Boolean)

  const category = list('category') as NftCategory[]
  if (category.some((c) => !CATEGORIES.includes(c))) fieldErrors.category = 'Categoria desconhecida.'
  const rarity = list('rarity') as NftRarity[]
  if (rarity.some((r) => !RARITIES.includes(r))) fieldErrors.rarity = 'Raridade desconhecida.'
  const status = search.get('status') ?? undefined
  if (status && status !== 'available' && status !== 'sold_out') fieldErrors.status = 'Status inválido.'
  const minPrice = search.get('minPrice') ?? undefined
  const maxPrice = search.get('maxPrice') ?? undefined
  if (minPrice && !isEthString(minPrice)) fieldErrors.minPrice = 'Preço mínimo inválido.'
  if (maxPrice && !isEthString(maxPrice)) fieldErrors.maxPrice = 'Preço máximo inválido.'
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
    category: category.length ? category : undefined,
    rarity: rarity.length ? rarity : undefined,
    status: status as NftListParams['status'],
    minPrice,
    maxPrice,
    sort,
    page,
    pageSize,
  }
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function listNfts(params: ReturnType<typeof parseListParams>): Page<NftSummary> {
  const q = params.q ? normalize(params.q) : null
  let items = db.nfts.filter((nft) => {
    if (q) {
      const haystack = normalize(`${nft.name} ${nft.collection.name} ${nft.creator.name} ${nft.creator.handle}`)
      if (!haystack.includes(q)) return false
    }
    if (params.category && !params.category.includes(nft.category)) return false
    if (params.rarity && !params.rarity.includes(nft.rarity)) return false
    if (params.status && nft.status !== params.status) return false
    if (params.minPrice && compareEth(nft.floorPriceEth, params.minPrice) < 0) return false
    if (params.maxPrice && compareEth(nft.floorPriceEth, params.maxPrice) > 0) return false
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

export function getHighlights(): Highlights {
  const available = db.nfts.filter((n) => n.status === 'available')
  const popular = [...available].sort((a, b) => b.likes - a.likes || a.id.localeCompare(b.id))
  return {
    hero: popular.slice(0, 3).map(toSummary),
    trending: popular.slice(3, 11).map(toSummary),
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
