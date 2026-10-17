import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@/features/catalog/home-page'
import { facetsQuery, highlightsQuery, nftListQuery } from '@/features/catalog/queries'
import { catalogSearchSchema, toListParams } from '@/features/catalog/search'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => toListParams(search),
  // Pré-busca sem bloquear a navegação: skeletons cobrem o carregamento.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps))
    void context.queryClient.prefetchQuery(facetsQuery())
    void context.queryClient.prefetchQuery(highlightsQuery())
  },
  component: function Home() {
    return <HomePage search={Route.useSearch()} />
  },
})
