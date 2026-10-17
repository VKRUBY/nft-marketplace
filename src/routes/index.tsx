import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { nftListQuery } from '@/features/catalog/queries'
import { catalogSearchSchema, toListParams, withFilters } from '@/features/catalog/search'
import { ApiError } from '@/lib/api/errors'
import { Button } from '@/components/ui/button'
import { formatEth } from '@/shared/eth'

/**
 * Início (versão de integração da etapa 1). A composição visual do Figma
 * entra na etapa 2; aqui ficam o estado na URL e o fluxo de dados.
 */
export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => toListParams(search),
  loader: ({ context, deps }) => context.queryClient.prefetchQuery(nftListQuery(deps)),
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const params = toListParams(search)
  const query = useQuery(nftListQuery(params))

  return (
    <section aria-labelledby="catalog-title" className="flex flex-col gap-6">
      <h1 id="catalog-title" className="text-2xl font-bold">
        Catálogo
      </h1>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          const q = new FormData(e.currentTarget).get('q')?.toString() ?? ''
          void navigate({ search: (prev) => withFilters(prev, { q }) })
        }}
      >
        <label htmlFor="q" className="sr-only">
          Buscar NFTs
        </label>
        <input
          id="q"
          name="q"
          defaultValue={search.q ?? ''}
          className="h-10 rounded-md border border-input bg-transparent px-3"
          placeholder="Buscar"
        />
      </form>

      {query.isPending ? (
        <p role="status">Carregando…</p>
      ) : query.isError ? (
        <div role="alert" className="flex items-center gap-4">
          <p>{ApiError.from(query.error).message}</p>
          <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
        </div>
      ) : query.data.items.length === 0 ? (
        <p>Nenhum NFT encontrado.</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-busy={query.isFetching}>
            {query.data.items.map((nft) => (
              <li key={nft.id}>
                <Link to="/nft/$nftId" params={{ nftId: nft.slug }} className="block">
                  <span className="block">{nft.name}</span>
                  <span className="text-primary">{formatEth(nft.floorPriceEth)} ETH</span>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginação" className="flex gap-2">
            {Array.from({ length: query.data.totalPages }, (_, i) => i + 1).map((page) => (
              <Link
                key={page}
                to="/"
                search={(prev) => ({ ...prev, page: page === 1 ? undefined : page })}
                aria-current={page === query.data.page ? 'page' : undefined}
                className="rounded px-3 py-1 aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
              >
                {page}
              </Link>
            ))}
          </nav>
        </>
      )}
    </section>
  )
}
