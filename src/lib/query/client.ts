import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/errors'

/**
 * Política de cache, retries e sincronização (detalhada em ARCHITECTURE.md):
 *
 *  - staleTime 30 s por padrão; catálogo e detalhe também recebem `nft.updated`
 *    em tempo real, então não precisam de polling.
 *  - gcTime 5 min: voltar a uma página recente mostra dados na hora e
 *    revalida em segundo plano.
 *  - retry: até 2 novas tentativas, só para falhas transitórias (rede,
 *    timeout, 5xx com `retryable`). 4xx nunca é repetido automaticamente.
 *  - backoff exponencial limitado a 4 s.
 *  - mutations: sem retry automático; a criação de pedido tem retry próprio
 *    com a mesma chave de idempotência.
 *  - refetchOnWindowFocus e refetchOnReconnect: ligados (reconciliação).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const apiError = ApiError.from(error)
  if (apiError.code === 'CANCELED') return false
  return failureCount < 2 && apiError.retryable
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
