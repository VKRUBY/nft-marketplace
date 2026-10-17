import type { Network, NftListParams } from '@/contracts/domain'

/**
 * Chaves do TanStack Query.
 *
 * Isolamento:
 *  - dados públicos (`nfts`) dependem só dos parâmetros da consulta;
 *  - dados privados ficam sob `['private', userId, ...]`, então dois usuários
 *    nunca compartilham entradas e o logout remove tudo com um prefixo;
 *  - o carrinho é chaveado pelo dono (`guest:<id>` ou `user:<id>`).
 */
export const queryKeys = {
  session: ['session'] as const,
  nfts: {
    all: ['nfts'] as const,
    lists: () => ['nfts', 'list'] as const,
    list: (params: NftListParams) => ['nfts', 'list', normalizeListParams(params)] as const,
    highlights: () => ['nfts', 'highlights'] as const,
    detail: (idOrSlug: string) => ['nfts', 'detail', idOrSlug] as const,
  },
  cart: {
    all: ['cart'] as const,
    owner: (owner: string) => ['cart', owner] as const,
    detail: (owner: string, network: Network) => ['cart', owner, network] as const,
  },
  private: {
    all: ['private'] as const,
    user: (userId: string) => ['private', userId] as const,
    favorites: (userId: string) => ['private', userId, 'favorites'] as const,
    profile: (userId: string) => ['private', userId, 'profile'] as const,
    wallets: (userId: string) => ['private', userId, 'wallets'] as const,
    quote: (userId: string, network: Network) => ['private', userId, 'quote', network] as const,
    activeOrders: (userId: string) => ['private', userId, 'orders', 'active'] as const,
    order: (userId: string, orderId: string) => ['private', userId, 'orders', orderId] as const,
  },
}

/** Ordena e remove valores vazios para que parâmetros equivalentes gerem a mesma chave. */
export function normalizeListParams(params: NftListParams): NftListParams {
  const out: NftListParams = {}
  if (params.q?.trim()) out.q = params.q.trim()
  if (params.category?.length) out.category = [...params.category].sort()
  if (params.rarity?.length) out.rarity = [...params.rarity].sort()
  if (params.status) out.status = params.status
  if (params.minPrice) out.minPrice = params.minPrice
  if (params.maxPrice) out.maxPrice = params.maxPrice
  out.sort = params.sort ?? 'recent'
  out.page = params.page ?? 1
  out.pageSize = params.pageSize ?? 12
  return out
}
