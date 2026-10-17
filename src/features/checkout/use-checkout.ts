import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import type { CreateOrderInput, Network, Order, Quote, WalletConnection } from '@/contracts/domain'
import { ApiError } from '@/lib/api/errors'
import { checkoutApi, ordersApi, profileApi, walletsApi } from '@/lib/api/resources'
import { queryKeys } from '@/lib/query/keys'
import { reconcileOrder } from '@/lib/realtime/versions'
import { orderAttempts } from './order-attempt'

export function useWallets(userId: string) {
  return useQuery({
    queryKey: queryKeys.private.wallets(userId),
    queryFn: ({ signal }) => walletsApi.list({ signal }),
  })
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.private.profile(userId),
    queryFn: ({ signal }) => profileApi.get({ signal }),
  })
}

/**
 * Cotação da rede escolhida. É a referência de valores para finalizar: o
 * resumo do checkout e a revisão exibem exatamente esta resposta. Eventos
 * `nft.updated` de itens do carrinho invalidam a cotação (ver realtime/sync).
 */
export function useQuote(userId: string, network: Network | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.private.quote(userId, network ?? 'ethereum'),
    queryFn: () => checkoutApi.quote(network ?? 'ethereum'),
    enabled: enabled && Boolean(network),
    staleTime: 60_000,
    // Uma cotação é criada a cada busca; não refaz ao focar a janela.
    refetchOnWindowFocus: false,
  })
}

export function useConnectWallet(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ walletId, network }: { walletId: string; network: Network }) => walletsApi.connect(walletId, network),
    onSuccess: (connection: WalletConnection) => {
      queryClient.setQueryData(queryKeys.private.wallets(userId), (wallets: Awaited<ReturnType<typeof walletsApi.list>> | undefined) =>
        wallets?.map((w) => (w.id === connection.walletId ? { ...w, connection } : w)),
      )
    },
  })
}

export function useDisconnectWallet(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (walletId: string) => walletsApi.disconnect(walletId),
    onSuccess: (connection) => {
      queryClient.setQueryData(queryKeys.private.wallets(userId), (wallets: Awaited<ReturnType<typeof walletsApi.list>> | undefined) =>
        wallets?.map((w) => (w.id === connection.walletId ? { ...w, connection } : w)),
      )
    },
  })
}

const MAX_TRANSIENT_RETRIES = 3

/**
 * Envio do pedido.
 *  - Clique repetido: o ref `inFlight` impede um segundo envio paralelo e o
 *    botão fica desabilitado enquanto a mutation roda.
 *  - Timeout/erro de rede: reenvia com a MESMA chave de idempotência (até 3
 *    vezes, com espera crescente); o servidor devolve o mesmo pedido.
 *  - 409 QUOTE_STALE/AVAILABILITY_CONFLICT: atualiza a cotação no cache com
 *    a versão do servidor e devolve o erro para a UI pedir nova confirmação.
 */
export function usePlaceOrder(userId: string) {
  const queryClient = useQueryClient()
  const inFlight = useRef(false)

  return useMutation({
    mutationKey: ['place-order', userId],
    mutationFn: async (input: CreateOrderInput & { onRetry?: (attempt: number) => void }): Promise<Order> => {
      if (inFlight.current) throw new ApiError({ status: 0, code: 'CANCELED', message: 'Pedido já em envio.', retryable: false })
      inFlight.current = true
      const { onRetry, ...body } = input
      const attempt = orderAttempts.forInput(userId, body)
      try {
        for (let i = 0; ; i++) {
          try {
            const order = await ordersApi.create(body, attempt.key)
            orderAttempts.markCreated(userId, order.id)
            return reconcileOrder(order)
          } catch (error) {
            const apiError = ApiError.from(error)
            if (apiError.isConnectivity || apiError.code === 'TRANSIENT') {
              if (i < MAX_TRANSIENT_RETRIES) {
                onRetry?.(i + 1)
                await new Promise((r) => setTimeout(r, 800 * (i + 1)))
                continue
              }
            }
            throw apiError
          }
        }
      } finally {
        inFlight.current = false
      }
    },
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.private.order(userId, order.id), order)
      void queryClient.invalidateQueries({ queryKey: queryKeys.private.activeOrders(userId) })
    },
    onError: (error, input) => {
      const apiError = ApiError.from(error)
      const details = apiError.details as { quote?: Quote } | undefined
      if (details?.quote) {
        queryClient.setQueryData(queryKeys.private.quote(userId, input.network), details.quote)
      }
    },
  })
}

export function orderQuery(userId: string, orderId: string) {
  return {
    queryKey: queryKeys.private.order(userId, orderId),
    queryFn: async ({ signal }: { signal: AbortSignal }) => reconcileOrder(await ordersApi.detail(orderId, { signal })),
  }
}

export function useActiveOrders(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.private.activeOrders(userId ?? 'anon'),
    queryFn: ({ signal }) => ordersApi.active({ signal }),
    enabled: Boolean(userId),
    staleTime: 10_000,
  })
}
