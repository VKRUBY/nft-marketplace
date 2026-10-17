import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { nftDetailQuery } from '@/features/catalog/queries'
import { NftDetailPage } from '@/features/nft-detail/nft-detail-page'

/**
 * Detalhe do NFT. O loader só pré-busca (não bloqueia a navegação), então o
 * skeleton aparece em redes lentas; NFT inexistente é tratado no componente
 * a partir do 404 da API.
 */
export const Route = createFileRoute('/nft/$nftId')({
  validateSearch: z.object({ edicao: z.string().optional().catch(undefined) }),
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId))
  },
  component: function NftRoute() {
    const { nftId } = Route.useParams()
    const { edicao } = Route.useSearch()
    return <NftDetailPage slug={nftId} editionParam={edicao} />
  },
})
