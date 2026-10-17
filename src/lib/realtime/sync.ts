import type { QueryClient } from '@tanstack/react-query'
import type { Cart, Highlights, Nft, NftSummary, Order, Page } from '@/contracts/domain'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts/events'
import { formatEth } from '@/shared/eth'
import { notify } from '../notices'
import { queryKeys } from '../query/keys'
import { realtimeClient } from './socket'
import { judgeEvent, patchNft, patchNftSummary } from './versions'

/**
 * Liga os eventos Socket.IO ao cache do TanStack Query.
 *
 *  nft.updated   → corrige preço/disponibilidade em listas, destaques e
 *                  detalhe; invalida carrinho e cotação (o servidor recalcula
 *                  avisos e totais) e anuncia a mudança se o item estiver no carrinho.
 *  order.updated → atualiza o pedido, a lista de pendentes e o carrinho.
 *  reconexão     → refaz as consultas ativas via REST (fonte de verdade).
 */
export function installRealtimeSync(queryClient: QueryClient, getUserId: () => string | null): () => void {
  const onNft = (event: NftUpdatedEvent) => {
    const { data, version } = event

    queryClient.setQueryData<Nft>(queryKeys.nfts.detail(data.nftId), (nft) =>
      nft ? patchNft(nft, data, version) : nft,
    )
    // O detalhe também pode estar em cache pelo slug.
    for (const [key, nft] of queryClient.getQueriesData<Nft>({ queryKey: ['nfts', 'detail'] })) {
      if (nft?.id === data.nftId && nft.version < version) queryClient.setQueryData(key, patchNft(nft, data, version))
    }
    queryClient.setQueriesData<Page<NftSummary>>({ queryKey: queryKeys.nfts.lists() }, (page) =>
      page
        ? { ...page, items: page.items.map((n) => (n.id === data.nftId ? patchNftSummary(n, data, version) : n)) }
        : page,
    )
    queryClient.setQueryData<Highlights>(queryKeys.nfts.highlights(), (h) =>
      h
        ? {
            hero: h.hero.map((n) => (n.id === data.nftId ? patchNftSummary(n, data, version) : n)),
            trending: h.trending.map((n) => (n.id === data.nftId ? patchNftSummary(n, data, version) : n)),
          }
        : h,
    )

    // Carrinho e cotação dependem de valores calculados no servidor.
    const carts = queryClient.getQueriesData<Cart>({ queryKey: queryKeys.cart.all })
    const affected = carts.flatMap(([, cart]) => cart?.items.filter((i) => i.nftId === data.nftId) ?? [])
    if (affected.length > 0) {
      for (const item of affected) {
        const edition = data.editions.find((e) => e.id === item.editionId)
        if (!edition) continue
        if (edition.available === 0) {
          notify.warning(
            `${item.name} esgotou`,
            'O item continua no carrinho, mas não pode ser comprado.',
            `rt:${item.editionId}`,
          )
        } else if (edition.priceEth !== item.unitPriceEth) {
          notify.warning(
            `Preço atualizado: ${item.name}`,
            `De ${formatEth(item.unitPriceEth)} para ${formatEth(edition.priceEth)} ETH.`,
            `rt:${item.editionId}`,
          )
        } else if (edition.available < item.quantity) {
          notify.warning(
            `Disponibilidade reduzida: ${item.name}`,
            `Restam ${edition.available} unidade(s).`,
            `rt:${item.editionId}`,
          )
        }
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all })
      const userId = getUserId()
      if (userId) void queryClient.invalidateQueries({ queryKey: [...queryKeys.private.user(userId), 'quote'] })
    }
  }

  const onOrder = (event: OrderUpdatedEvent) => {
    const userId = getUserId()
    if (!userId) return
    const { data, version } = event
    queryClient.setQueryData<Order>(queryKeys.private.order(userId, data.orderId), (order) =>
      order && order.version < version
        ? {
            ...order,
            status: data.status,
            txHash: data.txHash,
            explorerUrl: data.explorerUrl,
            declineReason: data.declineReason,
            version,
          }
        : order,
    )
    void queryClient.invalidateQueries({ queryKey: queryKeys.private.activeOrders(userId) })
    if (data.status === 'confirmed') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all })
    }
  }

  const offEvent = realtimeClient.onEvent((event) => {
    if (judgeEvent(event) !== 'apply') return
    if (event.type === 'nft.updated') onNft(event)
    else onOrder(event)
  })

  const offReconnect = realtimeClient.onReconnect(() => {
    // Eventos podem ter sido perdidos durante a queda: o REST é a fonte de verdade.
    void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all, refetchType: 'active' })
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all, refetchType: 'active' })
    const userId = getUserId()
    if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.private.user(userId), refetchType: 'active' })
  })

  return () => {
    offEvent()
    offReconnect()
  }
}
