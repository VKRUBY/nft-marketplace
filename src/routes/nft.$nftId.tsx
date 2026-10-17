import { useQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFound } from '@/app/not-found'
import { nftDetailQuery } from '@/features/catalog/queries'
import { ApiError } from '@/lib/api/errors'
import { formatEth } from '@/shared/eth'

export const Route = createFileRoute('/nft/$nftId')({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(nftDetailQuery(params.nftId))
    } catch (error) {
      if (ApiError.from(error).code === 'NOT_FOUND') throw notFound()
      // Outras falhas são exibidas pelo componente com opção de nova tentativa.
    }
  },
  notFoundComponent: () => <NotFound title="NFT não encontrado" />,
  component: NftDetailPage,
})

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const query = useQuery(nftDetailQuery(nftId))
  if (query.isPending) return <p role="status">Carregando…</p>
  if (query.isError) return <p role="alert">{ApiError.from(query.error).message}</p>
  const nft = query.data
  return (
    <article aria-labelledby="nft-title">
      <h1 id="nft-title" className="text-2xl font-bold">
        {nft.name}
      </h1>
      <ul>
        {nft.editions.map((e) => (
          <li key={e.id} data-edition={e.id}>
            {e.label} {e.tokenId} — {formatEth(e.priceEth)} ETH — {e.available > 0 ? `${e.available} disponíveis` : 'Esgotada'}
          </li>
        ))}
      </ul>
    </article>
  )
}
