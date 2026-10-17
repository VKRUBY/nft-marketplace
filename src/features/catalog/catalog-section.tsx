import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Price } from '@/components/nft/price'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { CatalogTab, NftSort, NftSummary, Page } from '@/contracts/domain'
import { CATEGORIES, NETWORKS } from '@/contracts/networks'
import { ApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import { CatalogFilters, formatEthBr } from './catalog-filters'
import { highlightsQuery, nftListQuery } from './queries'
import { type CatalogSearch, toListParams, withFilters } from './search'

const TABS: Array<{ id: CatalogTab; label: string }> = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
]

const SORTS: Array<{ id: NftSort; label: string }> = [
  { id: 'recent', label: 'Listados recentemente' },
  { id: 'price_asc', label: 'Menor preço' },
  { id: 'price_desc', label: 'Maior preço' },
  { id: 'popular', label: 'Mais populares' },
]

/**
 * Catálogo do Início. Busca, aba, filtros, ordenação e página vivem na URL;
 * a consulta usa exatamente esses parâmetros (chave do TanStack Query), então
 * refresh e voltar/avançar restauram o mesmo estado.
 */
export function CatalogSection({ search }: { search: CatalogSearch }) {
  const navigate = useNavigate({ from: '/' })
  const params = toListParams(search)
  const query = useQuery(nftListQuery(params))
  const headingRef = useRef<HTMLHeadingElement>(null)
  const resultsId = useId()

  const update = (patch: Partial<Omit<CatalogSearch, 'page'>>) =>
    void navigate({ search: (prev) => withFilters(prev, patch), resetScroll: false })

  // Ao trocar de página, leva o foco e a rolagem para o início dos resultados.
  const page = search.page ?? 1
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus({ preventScroll: true })
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [page])

  const activeFilters = [
    ...(search.q ? [{ key: 'q', label: `“${search.q}”`, clear: () => update({ q: undefined }) }] : []),
    ...(search.category ?? []).map((c) => ({
      key: `c-${c}`,
      label: CATEGORIES[c],
      clear: () => update({ category: search.category?.filter((x) => x !== c) }),
    })),
    ...(search.network ?? []).map((n) => ({
      key: `n-${n}`,
      label: NETWORKS[n].label,
      clear: () => update({ network: search.network?.filter((x) => x !== n) }),
    })),
    ...(search.minPrice || search.maxPrice
      ? [
          {
            key: 'price',
            label: `${search.minPrice ? formatEthBr(search.minPrice) : '0,00'} – ${search.maxPrice ? formatEthBr(search.maxPrice) : '∞'} ETH`,
            clear: () => update({ minPrice: undefined, maxPrice: undefined }),
          },
        ]
      : []),
  ]

  return (
    <section id="catalogo" aria-labelledby={resultsId} className="container-page scroll-mt-6 pt-6 md:pt-24">
      <div className="grid gap-8 md:grid-cols-[minmax(0,240px)_1fr] lg:grid-cols-[310px_1fr] lg:gap-12">
        <aside aria-label="Filtros do catálogo" className="hidden md:block">
          <div className="bg-surface px-3 py-6 lg:px-5">
            <CatalogFilters search={search} onChange={update} />
          </div>
          <FeaturedCard />
        </aside>

        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 md:mb-7">
            <nav aria-label="Seções do catálogo">
              <ul className="flex gap-4 md:gap-5">
                {TABS.map((tab) => {
                  const active = (search.tab ?? 'all') === tab.id
                  return (
                    <li key={tab.id}>
                      <Link
                        to="/"
                        search={(prev) => withFilters(prev, { tab: tab.id === 'all' ? undefined : tab.id })}
                        resetScroll={false}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'block border-b-2 border-transparent pb-0.5 text-sm font-medium whitespace-nowrap md:text-base',
                          active ? 'border-accent text-accent-strong' : 'hover:text-accent-strong',
                        )}
                      >
                        {tab.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
            <div className="hidden md:block">
              <SortSelect value={search.sort ?? 'recent'} onChange={(sort) => update({ sort })} inline />
            </div>
          </div>

          <h2 id={resultsId} ref={headingRef} tabIndex={-1} className="sr-only">
            {query.data ? `${query.data.total} NFTs encontrados, página ${query.data.page} de ${query.data.totalPages}` : 'Resultados'}
          </h2>

          {activeFilters.length > 0 && (
            <ul aria-label="Filtros ativos" className="mb-5 flex flex-wrap gap-2">
              {activeFilters.map((f) => (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={f.clear}
                    className="inline-flex items-center gap-1 rounded-full border border-accent px-3 py-1 text-xs text-accent-strong hover:bg-accent/10"
                  >
                    {f.label}
                    <XIcon className="size-3" aria-hidden />
                    <span className="sr-only">(remover filtro)</span>
                  </button>
                </li>
              ))}
              <li>
                <Button variant="link" size="sm" className="text-xs" onClick={() => void navigate({ search: {}, resetScroll: false })}>
                  Limpar tudo
                </Button>
              </li>
            </ul>
          )}

          <Results query={query} search={search} onClear={() => void navigate({ search: {}, resetScroll: false })} />
        </div>
      </div>
    </section>
  )
}

function Results({
  query,
  search,
  onClear,
}: {
  query: UseQueryResult<Page<NftSummary>>
  search: CatalogSearch
  onClear: () => void
}) {
  if (query.isPending) {
    return (
      <div role="status" aria-label="Carregando NFTs">
        <Grid>
          {Array.from({ length: 12 }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </Grid>
      </div>
    )
  }
  if (query.isError && !query.data) {
    const error = ApiError.from(query.error)
    return (
      <div role="alert" className="flex flex-col items-start gap-4 rounded-md border border-line bg-surface p-6">
        <p className="font-bold">Não foi possível carregar o catálogo.</p>
        <p className="text-sm text-sand">{error.message}</p>
        <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? 'Tentando novamente…' : 'Tentar novamente'}
        </Button>
      </div>
    )
  }
  const data = query.data!
  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md border border-line bg-surface p-6">
        <p className="font-bold">Nenhum NFT encontrado.</p>
        <p className="text-sm text-sand">
          {search.q ? `Nada corresponde a “${search.q}” com os filtros atuais.` : 'Nenhum item corresponde aos filtros escolhidos.'}
        </p>
        <Button variant="outline" onClick={onClear}>
          Limpar busca e filtros
        </Button>
      </div>
    )
  }
  return (
    <>
      {query.isError && (
        <p role="alert" className="mb-4 text-sm text-danger">
          Não foi possível atualizar a lista. Mostrando o último resultado carregado.
        </p>
      )}
      <div aria-busy={query.isFetching} className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')}>
        <Grid>
          {data.items.map((nft, i) => (
            <NftCard key={nft.id} nft={nft} priority={i < 3} showFavorite className={cn(i % 2 === 1 && 'max-md:mt-8')} />
          ))}
        </Grid>
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} />
    </>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-2 md:gap-x-6 lg:grid-cols-3 lg:gap-x-[34px] lg:gap-y-[50px]">{children}</div>
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1 || (page <= 3 && p <= 4),
  )
  const cell = 'grid size-[35px] place-items-center rounded-sm border border-line text-lg'
  return (
    <nav aria-label="Paginação" className="mt-16 flex justify-center md:justify-end">
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <Link to="/" search={(prev) => ({ ...prev, page: page - 1 === 1 ? undefined : page - 1 })} resetScroll={false} className={cn(cell, 'hover:border-accent')} aria-label="Página anterior">
              <ChevronLeftIcon className="size-4" aria-hidden />
            </Link>
          </li>
        )}
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            {i > 0 && p - pages[i - 1]! > 1 && <span aria-hidden>…</span>}
            <Link
              to="/"
              search={(prev) => ({ ...prev, page: p === 1 ? undefined : p })}
              resetScroll={false}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              className={cn(cell, p === page ? 'border-accent bg-accent font-bold text-ink' : 'hover:border-accent')}
            >
              {p}
            </Link>
          </li>
        ))}
        {page < totalPages && (
          <li>
            <Link to="/" search={(prev) => ({ ...prev, page: page + 1 })} resetScroll={false} className={cn(cell, 'hover:border-accent')} aria-label="Próxima página">
              <ChevronRightIcon className="size-4" aria-hidden />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}

function SortSelect({ value, onChange, inline }: { value: NftSort; onChange: (v: NftSort) => void; inline?: boolean }) {
  const id = useId()
  return (
    <div className={cn('flex items-center gap-1', inline ? '' : 'mt-6 flex-col items-stretch gap-2')}>
      <label htmlFor={id} className={cn('text-base whitespace-nowrap', !inline && 'font-bold')}>
        Ordenar por:
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as NftSort)}>
        <SelectTrigger id={id} className={cn(inline && 'h-auto w-auto border-0 px-0 text-base focus-visible:ring-0')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {SORTS.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function MobileSearch({ defaultValue, onSearch }: { defaultValue?: string; onSearch: (q: string | undefined) => void }) {
  const id = useId()
  return (
    <form
      role="search"
      className="relative flex-1"
      onSubmit={(e) => {
        e.preventDefault()
        const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
        onSearch(q || undefined)
      }}
    >
      <label htmlFor={id} className="sr-only">
        Explorar coleções
      </label>
      <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-sand" />
      <input
        id={id}
        key={defaultValue}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Explorar coleções"
        enterKeyHint="search"
        className="h-[45px] w-full rounded-xl bg-surface pr-3 pl-10 text-sm outline-none placeholder:text-sand focus-visible:ring-2 focus-visible:ring-accent"
      />
    </form>
  )
}

/** "NFT em destaque — oferta limitada" da barra lateral. */
function FeaturedCard() {
  const { data, isPending } = useQuery(highlightsQuery())
  const nft = data?.featured
  return (
    <section aria-labelledby="featured-title" className="mt-6 bg-gradient-to-b from-[#3b2414] to-surface pt-7 text-center">
      <h2 id="featured-title" className="text-2xl font-bold text-accent-strong">
        NFT EM DESTAQUE
      </h2>
      <p className="mt-2 text-xl font-bold">OFERTA LIMITADA</p>
      {isPending ? (
        <Skeleton className="mt-4 aspect-[310/400] w-full rounded-none" />
      ) : nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.slug }} className="group mt-4 block">
          <img
            src={nft.image.url}
            srcSet={nft.image.srcSet}
            sizes="310px"
            alt={nft.image.alt}
            width={310}
            height={310}
            loading="lazy"
            className="aspect-square w-full rounded-[20px] object-cover"
          />
          <span className="block px-4 py-4">
            <span className="block group-hover:text-accent-strong">{nft.name}</span>
            <Price value={nft.floorPriceEth} compareAt={nft.compareAtPriceEth} className="justify-center" />
          </span>
        </Link>
      ) : null}
    </section>
  )
}

/**
 * Barra mobile do Início (frame Mobile / Início): busca "Explorar coleções"
 * e botão de filtros, acima do destaque. Usa o mesmo estado de URL do catálogo.
 */
export function MobileCatalogBar({ search }: { search: CatalogSearch }) {
  const navigate = useNavigate({ from: '/' })
  const update = (patch: Partial<Omit<CatalogSearch, 'page'>>) =>
    void navigate({ search: (prev) => withFilters(prev, patch), hash: 'catalogo', resetScroll: false })
  const count =
    (search.category?.length ?? 0) + (search.network?.length ?? 0) + (search.minPrice || search.maxPrice ? 1 : 0)
  return (
    <div className="container-page flex gap-2 pt-6 md:hidden">
      <MobileSearch defaultValue={search.q} onSearch={(q) => update({ q })} />
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" className="relative size-[45px] shrink-0 rounded-xl" aria-label={count ? `Filtros (${count} ativos)` : 'Filtros'}>
            <SlidersHorizontalIcon className="size-5" aria-hidden />
            {count > 0 && (
              <span aria-hidden className="absolute -top-1 -right-1 rounded-full bg-cream px-1.5 text-[10px] text-ink">
                {count}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="px-5 pt-6 pb-10">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription className="sr-only">Coleções, faixa de preço, rede e ordenação</SheetDescription>
          <CatalogFilters search={search} onChange={update} />
          <SortSelect value={search.sort ?? 'recent'} onChange={(sort) => update({ sort })} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
