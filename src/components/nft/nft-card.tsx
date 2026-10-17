import { Link } from '@tanstack/react-router'
import { HeartIcon } from 'lucide-react'
import type { NftSummary } from '@/contracts/domain'
import { Skeleton } from '@/components/ui/skeleton'
import { useFavorites, useToggleFavorite } from '@/features/favorites/use-favorites'
import { cn } from '@/lib/utils'
import { Price } from './price'

/**
 * Card do catálogo (Figma: imagem com cantos arredondados sobre fundo
 * surface, nome e preço abaixo). O card inteiro é um link; o coração é um
 * botão irmão, para não aninhar elementos interativos.
 */
export function NftCard({
  nft,
  priority = false,
  showFavorite = false,
  className,
}: {
  nft: NftSummary
  priority?: boolean
  showFavorite?: boolean
  className?: string
}) {
  const soldOut = nft.status === 'sold_out'
  return (
    <article className={cn('group relative flex flex-col', className)} data-testid="nft-card" data-nft-id={nft.id}>
      <div className="relative aspect-[258/300] w-full bg-surface">
        <img
          src={nft.image.url}
          srcSet={nft.image.srcSet}
          sizes="(min-width: 1024px) 258px, (min-width: 768px) 30vw, 45vw"
          alt={nft.image.alt}
          width={nft.image.width}
          height={nft.image.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={cn(
            'absolute inset-x-1 top-[8%] aspect-square w-[calc(100%-0.5rem)] rounded-[20px] object-cover transition-transform duration-300 group-hover:scale-[1.02]',
            soldOut && 'opacity-60 grayscale-[35%]',
          )}
        />
        {nft.rare && (
          <span className="absolute top-[6%] left-0 bg-accent px-3.5 py-1 text-sm font-bold text-ink">RARO</span>
        )}
        {soldOut && (
          <span className="absolute right-2 bottom-3 rounded-sm bg-ink/85 px-2 py-0.5 text-xs font-bold text-cream">Esgotado</span>
        )}
      </div>
      <h3 className="mt-3 text-base leading-tight">
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.slug }}
          className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-has-[a:focus-visible]:outline-2"
        >
          {nft.name}
        </Link>
      </h3>
      <Price value={nft.floorPriceEth} compareAt={nft.compareAtPriceEth} className="mt-0.5" />
      {/* Contorno de foco do card inteiro (o link cobre o card). */}
      <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-md ring-accent-strong group-has-[a:focus-visible]:ring-2" />
      {showFavorite && <FavoriteToggle nftId={nft.id} name={nft.name} />}
    </article>
  )
}

function FavoriteToggle({ nftId, name }: { nftId: string; name: string }) {
  const { isFavorite } = useFavorites()
  const { toggle } = useToggleFavorite()
  const active = isFavorite(nftId)
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remover ${name} da lista de interesse` : `Adicionar ${name} à lista de interesse`}
      onClick={() => toggle(nftId, name, !active)}
      className="absolute top-[9%] right-3 z-10 grid size-8 place-items-center rounded-full bg-ink/70 text-accent-strong hover:bg-ink md:hidden"
    >
      <HeartIcon className={cn('size-4', active && 'fill-current')} aria-hidden />
    </button>
  )
}

export function NftCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="relative aspect-[258/300] w-full bg-surface">
        <Skeleton className="absolute inset-x-1 top-[8%] aspect-square w-[calc(100%-0.5rem)] rounded-[20px]" />
      </div>
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-5 w-1/3" />
    </div>
  )
}
