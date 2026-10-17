import { z } from 'zod'
import type { NftListParams } from '@/contracts/domain'
import { isEthString } from '@/shared/eth'

/**
 * Estado do catálogo na URL. Valores inválidos caem no padrão em vez de
 * quebrar a rota, para que links antigos ou editados à mão continuem abrindo.
 * Qualquer mudança de filtro/busca/ordenação zera `page` (ver `withFilters`).
 */
const listOf = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .union([z.array(z.string()), z.string()])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')))
    .transform((v) => v.filter((x): x is T => (values as readonly string[]).includes(x)))
    .optional()
    .catch(undefined)

const eth = z
  .string()
  .refine(isEthString)
  .optional()
  .catch(undefined)

export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: listOf(['art', 'collectible', 'music', 'photography', 'gaming', 'pfp'] as const),
  rarity: listOf(['common', 'rare', 'epic', 'legendary'] as const),
  status: z.enum(['available', 'sold_out']).optional().catch(undefined),
  minPrice: eth,
  maxPrice: eth,
  sort: z.enum(['recent', 'price_asc', 'price_desc', 'popular']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const CATALOG_PAGE_SIZE = 12

export function toListParams(search: CatalogSearch): NftListParams {
  return {
    q: search.q || undefined,
    category: search.category?.length ? search.category : undefined,
    rarity: search.rarity?.length ? search.rarity : undefined,
    status: search.status,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    sort: search.sort ?? 'recent',
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

/** Aplica mudanças de filtro e reinicia a paginação. */
export function withFilters(current: CatalogSearch, patch: Partial<Omit<CatalogSearch, 'page'>>): CatalogSearch {
  const next: CatalogSearch = { ...current, ...patch, page: undefined }
  for (const key of Object.keys(next) as Array<keyof CatalogSearch>) {
    const value = next[key]
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete next[key]
  }
  return next
}
