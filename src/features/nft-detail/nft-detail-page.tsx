import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { HeartIcon, MailIcon, SearchIcon, ShoppingCartIcon, StarIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import { NftRail } from '@/components/nft/nft-rail'
import { Price } from '@/components/nft/price'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Edition, Nft } from '@/contracts/domain'
import { NETWORKS } from '@/contracts/networks'
import { nftDetailQuery, nftListQuery } from '@/features/catalog/queries'
import { useAddToCart } from '@/features/cart/use-cart'
import { useFavorites, useToggleFavorite } from '@/features/favorites/use-favorites'
import { NotFound } from '@/app/not-found'
import { ApiError } from '@/lib/api/errors'
import { useDocumentTitle } from '@/lib/use-document-title'
import { cn } from '@/lib/utils'
import { defaultEdition } from '@/shared/editions'
import { QuantityStepper } from './quantity-stepper'

export function NftDetailPage({ slug, editionParam }: { slug: string; editionParam?: string }) {
  const query = useQuery(nftDetailQuery(slug))
  useDocumentTitle(query.data ? `${query.data.name} — Kurio` : query.isError ? 'NFT não encontrado — Kurio' : 'Carregando NFT — Kurio')
  if (query.isPending) return <DetailSkeleton />
  if (query.isError && !query.data && ApiError.from(query.error).code === 'NOT_FOUND') {
    return <NotFound title="NFT não encontrado" />
  }
  if (query.isError && !query.data) {
    return (
      <div role="alert" className="container-page flex flex-col items-start gap-4 py-16">
        <p className="font-bold">Não foi possível carregar este NFT.</p>
        <p className="text-sm text-sand">{ApiError.from(query.error).message}</p>
        <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? 'Tentando novamente…' : 'Tentar novamente'}
        </Button>
      </div>
    )
  }
  return <Detail nft={query.data!} editionParam={editionParam} />
}

function Detail({ nft, editionParam }: { nft: Nft; editionParam?: string }) {
  const navigate = useNavigate({ from: '/nft/$nftId' })
  const selected = nft.editions.find((e) => e.label === editionParam || e.id === editionParam) ?? defaultEdition(nft.editions)!
  const [requestedQuantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const addToCart = useAddToCart()
  const { isFavorite } = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const favorite = isFavorite(nft.id)
  const limit = Math.max(1, Math.min(selected.available, selected.maxPerOrder))
  const unavailable = selected.available === 0
  const errorId = useId()

  // Disponibilidade pode cair em tempo real: a quantidade efetiva nunca passa do limite.
  const quantity = Math.min(requestedQuantity, limit)

  const selectEdition = (edition: Edition) => {
    setQuantity(1)
    void navigate({ search: { edicao: edition.label }, replace: true, resetScroll: false })
  }

  const buy = (goToCart: boolean) =>
    addToCart.mutate(
      { nftId: nft.id, editionId: selected.id, quantity, name: nft.name },
      { onSuccess: () => goToCart && void navigate({ to: '/carrinho' }) },
    )
  const addError = addToCart.error ? ApiError.from(addToCart.error) : null
  const image = nft.images[imageIndex] ?? nft.image

  const favoriteButton = (
    <Button
      variant="outline"
      className="h-10 gap-2 px-3 text-base font-medium text-cream"
      aria-pressed={favorite}
      onClick={() => toggleFavorite.toggle(nft.id, nft.name, !favorite)}
    >
      <HeartIcon className={cn('size-5 text-accent-strong', favorite && 'fill-current')} aria-hidden />
      {favorite ? 'Favoritado' : 'Favoritar'}
    </Button>
  )

  return (
    <div className="container-page pb-28 md:pt-8 md:pb-0">
      <MobileTopBar
        action={
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? 'Remover da lista de interesse' : 'Adicionar à lista de interesse'}
            onClick={() => toggleFavorite.toggle(nft.id, nft.name, !favorite)}
            className="ml-auto grid size-9 place-items-center rounded-full bg-surface text-accent-strong"
          >
            <HeartIcon className={cn('size-5', favorite && 'fill-current')} aria-hidden />
          </button>
        }
      />
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: nft.name }]} />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[100px_444px_1fr] lg:gap-7 xl:gap-[28px_33px]">
        {/* Miniaturas: vistas da mesma obra */}
        <ul aria-label="Miniaturas" className="order-2 hidden gap-3 md:flex lg:order-none lg:flex-col lg:gap-4">
          {nft.images.map((img, i) => (
            <li key={img.alt}>
              <button
                type="button"
                onClick={() => setImageIndex(i)}
                aria-current={i === imageIndex ? 'true' : undefined}
                aria-label={`Mostrar vista ${i + 1}`}
                className={cn(
                  'block size-[72px] overflow-hidden rounded-md border-2 lg:size-[100px]',
                  i === imageIndex ? 'border-accent' : 'border-transparent opacity-80 hover:opacity-100',
                )}
              >
                <img src={img.url} srcSet={img.srcSet} sizes="100px" alt="" width={100} height={100} loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>

        <div className="relative order-1 bg-surface p-5 max-md:bg-transparent max-md:p-0 max-md:px-4 lg:order-none">
          <img
            src={image.url}
            srcSet={image.srcSet}
            sizes="(min-width: 1024px) 404px, (min-width: 768px) 45vw, 100vw"
            alt={image.alt}
            width={404}
            height={404}
            fetchPriority="high"
            className="aspect-square w-full rounded-[20px] object-cover max-md:rounded-[28px]"
          />
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="absolute top-6 right-6 grid size-8 place-items-center rounded-full bg-ink/85 text-cream hover:bg-ink"
            aria-label="Ampliar imagem"
          >
            <SearchIcon className="size-5" aria-hidden />
          </button>
        </div>

        <div className="order-3 md:col-span-2 lg:col-span-1 lg:order-none">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold md:text-[28px]">{nft.name}</h1>
            <span className="md:hidden">
              <Rating nft={nft} />
            </span>
          </div>
          <div className="mt-3 hidden flex-wrap items-center justify-between gap-3 border-b border-line pb-3 md:flex">
            <Price value={selected.priceEth} size="xl" />
            <Rating nft={nft} />
          </div>

          <h2 className="mt-5 text-base font-bold max-md:sr-only">Sobre este NFT:</h2>
          <p className="mt-2 text-sm leading-6 text-sand">{nft.description}</p>

          <div className="mt-4">
            <p id="edition-label" className="text-base font-bold">
              Edição:
            </p>
            <RadioGroupPrimitive.Root
              aria-labelledby="edition-label"
              value={selected.id}
              onValueChange={(id) => {
                const edition = nft.editions.find((e) => e.id === id)
                if (edition) selectEdition(edition)
              }}
              orientation="horizontal"
              className="mt-2 flex flex-wrap gap-2"
            >
              {nft.editions.map((edition) => {
                const soldOut = edition.available === 0
                return (
                  <RadioGroupPrimitive.Item
                    key={edition.id}
                    value={edition.id}
                    // Padrão ARIA de radio: mover com as setas também seleciona.
                    onFocus={() => edition.id !== selected.id && selectEdition(edition)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-strong',
                      'border-line text-sand hover:border-sand data-[state=checked]:border-accent data-[state=checked]:text-accent-strong',
                      soldOut && 'line-through decoration-sand/70',
                    )}
                  >
                    {edition.label}
                    {soldOut && <span className="sr-only"> (indisponível)</span>}
                  </RadioGroupPrimitive.Item>
                )
              })}
            </RadioGroupPrimitive.Root>
          </div>

          <div className="mt-4 hidden flex-wrap items-center justify-between gap-4 md:flex">
            <QuantityStepper value={quantity} max={limit} onChange={setQuantity} disabled={unavailable} label={`Quantidade de ${nft.name}`} />
            <div className="flex gap-2">
              <Button
                className="h-10 w-[130px]"
                onClick={() => buy(true)}
                disabled={unavailable || addToCart.isPending}
                aria-describedby={errorId}
              >
                {addToCart.isPending ? 'Adicionando…' : 'COMPRAR'}
              </Button>
              {favoriteButton}
            </div>
          </div>

          <div id={errorId} aria-live="polite" className="mt-2 min-h-5 text-sm">
            {unavailable ? (
              <p className="text-danger">A edição {selected.label} está indisponível. Escolha outra edição.</p>
            ) : addError ? (
              <p className="text-danger">{addError.message}</p>
            ) : limit > 1 ? (
              <p className="text-sand">Máximo de {limit} por pedido nesta edição.</p>
            ) : null}
          </div>

          <dl className="mt-3 flex flex-col gap-4 text-base text-sand">
            <div>
              <dt className="inline">ID do token: </dt>
              <dd className="inline">{selected.tokenId}</dd>
            </div>
            <div>
              <dt className="inline">Coleção: </dt>
              <dd className="inline">{nft.collection.name}</dd>
            </div>
            <div>
              <dt className="inline">Atributos: </dt>
              <dd className="inline">{nft.attributes.join(', ')}</dd>
            </div>
          </dl>
          <ShareLinks nft={nft} />
        </div>
      </div>

      <Tabs defaultValue="details" className="mt-12 md:mt-16">
        <TabsList aria-label="Informações do NFT">
          <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
          <TabsTrigger value="reviews">Avaliações de colecionadores ({nft.reviewCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4 flex flex-col gap-4 text-sm leading-6 text-sand">
          {nft.longDescription.map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
          <InfoBlock title="Rede:">
            Cunhado na {NETWORKS[nft.network].label} com procedência imutável e metadados armazenados no IPFS.
          </InfoBlock>
          <InfoBlock title="Contrato:">
            {nft.contractAddress.slice(0, 6)}…{nft.contractAddress.slice(-4)} • Contrato inteligente ERC-721 verificado.
          </InfoBlock>
          <InfoBlock title="Direitos autorais:">
            Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.
          </InfoBlock>
        </TabsContent>
        <TabsContent value="reviews" className="mt-4">
          {nft.reviews.length === 0 ? (
            <p className="text-sand">Este NFT ainda não tem avaliações.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {nft.reviews.map((r) => (
                <li key={r.id} className="rounded-md bg-surface p-4">
                  <p className="flex items-center gap-2 font-bold">
                    {r.author}
                    <Stars value={r.rating} />
                  </p>
                  <p className="mt-1 text-sm text-sand">{r.comment}</p>
                </li>
              ))}
              {nft.reviewCount > nft.reviews.length && (
                <li className="text-sm text-sand">Mostrando {nft.reviews.length} de {nft.reviewCount} avaliações.</li>
              )}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <MoreFromCollection nft={nft} />

      {/* Barra fixa de compra no mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-surface px-6 pt-4 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">Qtd.</span>
            <QuantityStepper size="sm" value={quantity} max={limit} onChange={setQuantity} disabled={unavailable} label={`Quantidade de ${nft.name}`} />
          </div>
          <Price value={selected.priceEth} size="lg" />
        </div>
        <div className="mt-4 flex gap-3">
          <Button className="h-14 flex-1 rounded-full text-base" onClick={() => buy(true)} disabled={unavailable || addToCart.isPending}>
            {addToCart.isPending ? 'Adicionando…' : 'Comprar NFT'}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-14 rounded-full border border-line"
            onClick={() => buy(false)}
            disabled={unavailable || addToCart.isPending}
            aria-label="Adicionar ao carrinho"
          >
            <ShoppingCartIcon className="size-5 text-accent-strong" aria-hidden />
          </Button>
        </div>
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[min(92vw,760px)] p-4" accentBar={false}>
          <DialogTitle className="sr-only">{nft.name} ampliado</DialogTitle>
          <img src={image.url} alt={image.alt} width={750} height={750} className="aspect-square w-full rounded-[20px] object-cover" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-bold text-cream">{title}</h3>
      <p>{children}</p>
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1).replace('.', ',')} de 5 estrelas`} role="img">
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} aria-hidden className={cn('size-4', i < Math.round(value) ? 'fill-accent text-accent' : 'fill-sand/40 text-sand/40')} />
      ))}
    </span>
  )
}

function Rating({ nft }: { nft: Nft }) {
  return (
    <p className="flex items-center gap-2 text-base">
      <span className="md:hidden inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-sm">
        <StarIcon className="size-4 fill-accent text-accent" aria-hidden />
        {nft.rating.toFixed(1)}({nft.reviewCount})
        <span className="sr-only"> avaliações</span>
      </span>
      <span className="hidden items-center gap-2 md:inline-flex">
        <Stars value={nft.rating} />
        {nft.reviewCount} avaliações de colecionadores
      </span>
    </p>
  )
}

function ShareLinks({ nft }: { nft: Nft }) {
  const url = typeof location !== 'undefined' ? `${location.origin}/nft/${nft.slug}` : `/nft/${nft.slug}`
  const text = `${nft.name} na Kurio`
  const links = [
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, icon: 'in' },
    { label: 'e-mail', href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`, icon: 'mail' },
    { label: 'X (Twitter)', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, icon: 'x' },
  ]
  return (
    <div className="mt-4 flex items-center gap-3">
      <p className="text-base font-bold">Compartilhar este NFT:</p>
      <ul className="flex items-center gap-3">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target={l.icon === 'mail' ? undefined : '_blank'}
              rel="noopener noreferrer"
              className="text-cream hover:text-accent-strong"
            >
              {l.icon === 'mail' ? (
                <MailIcon className="size-4" aria-hidden />
              ) : (
                <span aria-hidden className="text-sm font-bold">
                  {l.icon}
                </span>
              )}
              <span className="sr-only">
                Compartilhar por {l.label}
                {l.icon !== 'mail' && ' (abre em nova aba)'}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MoreFromCollection({ nft }: { nft: Nft }) {
  const query = useQuery(nftListQuery({ collection: nft.collection.id, exclude: nft.id, pageSize: 10, sort: 'popular' }))
  return (
    <section aria-labelledby="more-title" className="mt-20">
      <h2 id="more-title" className="border-b border-line pb-3 text-lg font-bold text-accent-strong">
        Mais desta coleção
      </h2>
      <NftRail items={query.data?.items} loading={query.isPending} error={query.isError} />
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page md:pt-8" role="status" aria-label="Carregando NFT">
      <Skeleton className="mb-4 hidden h-6 w-48 md:block" />
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[100px_444px_1fr] lg:gap-7">
        <div className="order-2 flex gap-3 lg:order-none lg:flex-col lg:gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-[72px] lg:size-[100px]" />
          ))}
        </div>
        <div className="order-1 bg-surface p-5 lg:order-none">
          <Skeleton className="aspect-square w-full rounded-[20px]" />
        </div>
        <div className="order-3 flex flex-col gap-4 md:col-span-2 lg:col-span-1">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}
