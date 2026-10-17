import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import type { NftCategory, Network } from '@/contracts/domain'
import { CATEGORIES, CATEGORY_LIST, NETWORKS, NETWORK_LIST } from '@/contracts/networks'
import { cn } from '@/lib/utils'
import { formatEth, fromWei, toWei } from '@/shared/eth'
import { facetsQuery } from './queries'
import type { CatalogSearch } from './search'

const CENTS = 10n ** 16n

/** Converte ETH (string) em centésimos inteiros para o slider, sem float. */
function toCents(value: string, mode: 'floor' | 'ceil'): number {
  const wei = toWei(value)
  const cents = wei / CENTS
  return Number(mode === 'ceil' && wei % CENTS !== 0n ? cents + 1n : cents)
}

function centsToEth(cents: number): string {
  return fromWei(BigInt(cents) * CENTS)
}

export function formatEthBr(value: string): string {
  return formatEth(value, { maxDecimals: 2, minDecimals: 2 }).replace('.', ',')
}

/**
 * Filtros da barra lateral (desktop) e do drawer (mobile): coleções e redes
 * combináveis (seleção múltipla) e faixa de preço aplicada pelo botão. Toda
 * mudança vira estado de URL e reinicia a paginação (ver `withFilters`).
 */
export function CatalogFilters({
  search,
  onChange,
  className,
}: {
  search: CatalogSearch
  onChange: (patch: Partial<Omit<CatalogSearch, 'page'>>) => void
  className?: string
}) {
  const facets = useQuery(facetsQuery())
  const toggle = <T extends string>(list: T[] | undefined, value: T) => {
    const set = new Set(list ?? [])
    if (set.has(value)) set.delete(value)
    else set.add(value)
    return [...set]
  }

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <FilterGroup title="Coleções">
        <ul className="flex flex-col">
          {CATEGORY_LIST.map((id) => {
            const active = search.category?.includes(id) ?? false
            const count = facets.data?.categories.find((c) => c.id === id)?.count
            return (
              <li key={id}>
                <FilterButton
                  active={active}
                  count={count}
                  loading={facets.isPending}
                  onClick={() => onChange({ category: toggle<NftCategory>(search.category, id) })}
                >
                  {CATEGORIES[id]}
                </FilterButton>
              </li>
            )
          })}
        </ul>
      </FilterGroup>

      <PriceFilter search={search} onChange={onChange} range={facets.data?.priceRange} />

      <FilterGroup title="Rede">
        <ul className="flex flex-col">
          {NETWORK_LIST.map((id) => {
            const active = search.network?.includes(id) ?? false
            const count = facets.data?.networks.find((c) => c.id === id)?.count
            return (
              <li key={id}>
                <FilterButton
                  active={active}
                  count={count}
                  loading={facets.isPending}
                  regularCount
                  onClick={() => onChange({ network: toggle<Network>(search.network, id) })}
                >
                  {NETWORKS[id].label}
                </FilterButton>
              </li>
            )
          })}
        </ul>
      </FilterGroup>
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function FilterButton({
  active,
  count,
  loading,
  regularCount,
  onClick,
  children,
}: {
  active: boolean
  count: number | undefined
  loading: boolean
  regularCount?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-sm py-2 pr-3 pl-3 text-left text-base text-sand transition-colors hover:bg-band hover:text-cream',
        active && 'bg-band text-accent-strong',
      )}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className={cn('size-1.5 rounded-full', active ? 'bg-accent' : 'bg-transparent')} />
        {children}
      </span>
      {loading ? (
        <Skeleton className="h-4 w-8" />
      ) : (
        <span className={cn(regularCount ? 'font-normal' : 'font-bold', active ? 'text-accent-strong' : 'text-sand')}>
          ({count ?? 0})
        </span>
      )}
    </button>
  )
}

function PriceFilter({
  search,
  onChange,
  range,
}: {
  search: CatalogSearch
  onChange: (patch: Partial<Omit<CatalogSearch, 'page'>>) => void
  range: { min: string; max: string } | undefined
}) {
  const id = useId()
  const bounds = range ? [toCents(range.min, 'floor'), toCents(range.max, 'ceil')] : [0, 0]
  const current = [
    search.minPrice ? toCents(search.minPrice, 'floor') : bounds[0]!,
    search.maxPrice ? toCents(search.maxPrice, 'ceil') : bounds[1]!,
  ]
  const [value, setValue] = useState(current)
  // Sincroniza quando a URL muda (histórico, limpar filtros) ou os limites chegam.
  const key = `${current[0]}-${current[1]}`
  useEffect(() => setValue(current), [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const label = `${formatEthBr(centsToEth(value[0]!))} - ${formatEthBr(centsToEth(value[1]!))} ETH`
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-lg font-bold">
        Faixa de preço
      </h2>
      {range ? (
        <>
          <Slider
            min={bounds[0]}
            max={bounds[1]}
            step={1}
            minStepsBetweenThumbs={1}
            value={value}
            onValueChange={setValue}
            thumbLabels={['Preço mínimo', 'Preço máximo']}
            aria-describedby={`${id}-value`}
            className="px-3"
          />
          <p id={`${id}-value`} className="mt-4 px-3 text-sm" aria-live="polite">
            Preço: {label}
          </p>
          <Button
            size="sm"
            className="mt-3 ml-3 text-base"
            onClick={() =>
              onChange({
                minPrice: value[0]! > bounds[0]! ? centsToEth(value[0]!) : undefined,
                maxPrice: value[1]! < bounds[1]! ? centsToEth(value[1]!) : undefined,
              })
            }
          >
            Aplicar
          </Button>
        </>
      ) : (
        <Skeleton className="mx-3 h-16" />
      )}
    </section>
  )
}
