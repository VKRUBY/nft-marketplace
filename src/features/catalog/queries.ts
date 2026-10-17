import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { NftListParams } from '@/contracts/domain'
import { nftApi } from '@/lib/api/resources'
import { queryKeys } from '@/lib/query/keys'
import { reconcileNft } from '@/lib/realtime/versions'

/**
 * Consultas do catálogo. Cada conjunto de parâmetros tem sua chave; o
 * TanStack Query cancela (AbortSignal) a requisição anterior ao trocar de
 * chave e só exibe o resultado da chave atual, então respostas fora de ordem
 * nunca sobrescrevem a busca mais recente.
 */
export const nftListQuery = (params: NftListParams) =>
  queryOptions({
    queryKey: queryKeys.nfts.list(params),
    queryFn: async ({ signal }) => {
      const page = await nftApi.list(params, { signal })
      return { ...page, items: page.items.map(reconcileNft) }
    },
    placeholderData: keepPreviousData,
  })

export const highlightsQuery = () =>
  queryOptions({
    queryKey: queryKeys.nfts.highlights(),
    queryFn: async ({ signal }) => {
      const h = await nftApi.highlights({ signal })
      return {
        hero: h.hero.map(reconcileNft),
        featured: h.featured ? reconcileNft(h.featured) : null,
        trending: h.trending.map(reconcileNft),
      }
    },
    staleTime: 60_000,
  })

export const nftDetailQuery = (idOrSlug: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.detail(idOrSlug),
    queryFn: async ({ signal }) => reconcileNft(await nftApi.detail(idOrSlug, { signal })),
  })

export const facetsQuery = () =>
  queryOptions({
    queryKey: queryKeys.nfts.facets(),
    queryFn: ({ signal }) => nftApi.facets({ signal }),
    staleTime: 5 * 60_000,
  })
