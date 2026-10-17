import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Button } from '@/components/ui/button'
import { nftDetailQuery } from '@/features/catalog/queries'
import { useFavorites } from '@/features/favorites/use-favorites'
import { ApiError } from '@/lib/api/errors'
import { useDocumentTitle } from '@/lib/use-document-title'

/** "Lista de interesse": favoritos persistidos do usuário. */
export function FavoritesPage() {
  useDocumentTitle('Lista de interesse — Kurio')
  const favorites = useFavorites()
  const ids = favorites.data?.nftIds ?? []
  const nfts = useQueries({ queries: ids.map((id) => nftDetailQuery(id)) })

  return (
    <section aria-labelledby="fav-title">
      <h1 id="fav-title" className="mb-6 text-lg font-bold">
        Lista de interesse
      </h1>
      {favorites.isPending ? (
        <div role="status" aria-label="Carregando favoritos" className="grid grid-cols-2 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      ) : favorites.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>{ApiError.from(favorites.error).message}</p>
          <Button onClick={() => void favorites.refetch()}>Tentar novamente</Button>
        </div>
      ) : ids.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-6">
          <p className="font-bold">Você ainda não favoritou nenhum NFT.</p>
          <Button asChild>
            <Link to="/" hash="catalogo">
              Explorar o catálogo
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-8">
          {nfts.map((q, i) => (
            <li key={ids[i]}>{q.data ? <NftCard nft={q.data} showFavorite /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
