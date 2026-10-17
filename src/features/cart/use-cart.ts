import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemInput, Cart, Network } from '@/contracts/domain'
import { ApiError } from '@/lib/api/errors'
import { cartApi } from '@/lib/api/resources'
import { useSession } from '@/lib/auth/session'
import { notify } from '@/lib/notices'
import { queryKeys } from '@/lib/query/keys'
import { sessionStore } from '@/lib/session-store'

/**
 * Carrinho: o servidor é a fonte de verdade (preços, disponibilidade,
 * cupom e totais). Cada mutation devolve o carrinho inteiro, que substitui
 * o cache da chave do dono atual (visitante ou usuário).
 */
export function useCartOwner(): string {
  const { user } = useSession()
  return user ? `user:${user.id}` : `guest:${sessionStore.getGuestCartId()}`
}

export const cartQuery = (owner: string, network: Network = 'ethereum') =>
  queryOptions({
    queryKey: queryKeys.cart.detail(owner, network),
    queryFn: ({ signal }) => cartApi.get(network, { signal }),
    staleTime: 15_000,
  })

export function useCart(network: Network = 'ethereum') {
  const owner = useCartOwner()
  const { isPending: sessionPending } = useSession()
  return useQuery({ ...cartQuery(owner, network), enabled: !sessionPending })
}

function useApplyCart() {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  return (cart: Cart) => {
    // Atualiza a visão na rede padrão e invalida as demais (taxa depende da rede).
    queryClient.setQueryData(queryKeys.cart.detail(owner, cart.summary.network), cart)
    void queryClient.invalidateQueries({
      queryKey: queryKeys.cart.owner(owner),
      predicate: (q) => q.queryKey[2] !== cart.summary.network,
    })
  }
}

export function useAddToCart() {
  const apply = useApplyCart()
  return useMutation({
    mutationFn: (input: AddCartItemInput & { name: string }) =>
      cartApi.add({ nftId: input.nftId, editionId: input.editionId, quantity: input.quantity }),
    onSuccess: (cart, input) => {
      apply(cart)
      notify.success(`${input.name} adicionado ao carrinho`, `${input.quantity} edição(ões).`, 'cart-add')
    },
  })
}

export function useUpdateCartItem() {
  const apply = useApplyCart()
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.update(itemId, quantity),
    onSuccess: apply,
    onError: (error) => notify.error('Não foi possível alterar a quantidade', ApiError.from(error).message, 'cart-qty'),
  })
}

export function useRemoveCartItem() {
  const apply = useApplyCart()
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string; name: string }) => cartApi.remove(itemId),
    onSuccess: (cart, { name }) => {
      apply(cart)
      notify.info(`${name} removido do carrinho`, undefined, 'cart-remove')
    },
    onError: (error) => notify.error('Não foi possível remover o item', ApiError.from(error).message, 'cart-remove'),
  })
}

export function useAcknowledgeCart() {
  const apply = useApplyCart()
  return useMutation({
    mutationFn: () => cartApi.acknowledge(),
    onSuccess: (cart) => {
      apply(cart)
      notify.success('Carrinho atualizado com os valores atuais', undefined, 'cart-ack')
    },
  })
}

export function useCoupon() {
  const apply = useApplyCart()
  const applyCoupon = useMutation({
    mutationFn: (code: string) => cartApi.applyCoupon(code),
    onSuccess: (cart) => {
      apply(cart)
      notify.success(`Cupom ${cart.coupon?.code ?? ''} aplicado`, cart.coupon?.description, 'coupon')
    },
  })
  const removeCoupon = useMutation({
    mutationFn: () => cartApi.removeCoupon(),
    onSuccess: (cart) => {
      apply(cart)
      notify.info('Cupom removido', undefined, 'coupon')
    },
  })
  return { applyCoupon, removeCoupon }
}
