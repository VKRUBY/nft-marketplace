import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangleIcon, Trash2Icon } from 'lucide-react'
import { useId } from 'react'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import { NftRail } from '@/components/nft/nft-rail'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Cart, CartItem } from '@/contracts/domain'
import { highlightsQuery } from '@/features/catalog/queries'
import { QuantityStepper } from '@/features/nft-detail/quantity-stepper'
import { ApiError } from '@/lib/api/errors'
import { useDocumentTitle } from '@/lib/use-document-title'
import { cn } from '@/lib/utils'
import { formatEth } from '@/shared/eth'
import { CartSummaryCard } from './cart-summary'
import { useAcknowledgeCart, useCart, useRemoveCartItem, useUpdateCartItem } from './use-cart'

export function CartPage() {
  useDocumentTitle('Carrinho — Kurio')
  const { data: cart, isPending, isError, error, refetch, isFetching } = useCart()
  const navigate = useNavigate()
  const highlights = useQuery(highlightsQuery())

  return (
    <div className="container-page pb-10 md:pt-8">
      <MobileTopBar title="Carrinho de NFTs" />
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Carrinho' }]} />
      <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>

      {isError && !cart ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-line bg-surface p-6">
          <p className="font-bold">Não foi possível carregar o carrinho.</p>
          <p className="text-sm text-sand">{ApiError.from(error).message}</p>
          <Button onClick={() => void refetch()} disabled={isFetching}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,782px)_332px] lg:justify-between">
          <section aria-labelledby="cart-items-title">
            <h2 id="cart-items-title" className="sr-only">
              Itens do carrinho
            </h2>
            {isPending ? <ItemsSkeleton /> : <CartItems cart={cart!} />}
          </section>
          <CartSummaryCard
            cart={cart}
            loading={isPending}
            title="Resumo da carteira"
            action={
              <>
                <Button
                  className="h-10 w-full text-base"
                  disabled={!cart || cart.items.length === 0 || hasBlockingIssues(cart)}
                  onClick={() => void navigate({ to: '/pagamento' })}
                >
                  Conectar e finalizar
                </Button>
                {cart && hasBlockingIssues(cart) && (
                  <p className="text-center text-xs text-danger">Revise as alterações do carrinho antes de finalizar.</p>
                )}
                <Link to="/" hash="catalogo" className="block text-center text-base text-accent-strong hover:underline">
                  Continuar explorando
                </Link>
              </>
            }
          />
        </div>
      )}

      <section aria-labelledby="also-title" className="mt-16 md:mt-[110px]">
        <h2 id="also-title" className="border-b border-line pb-3 text-lg font-bold text-accent-strong">
          Colecionadores também viram
        </h2>
        <NftRail items={highlights.data?.trending} loading={highlights.isPending} error={highlights.isError} />
      </section>
    </div>
  )
}

export function hasBlockingIssues(cart: Cart): boolean {
  return cart.items.some((i) => i.issues.length > 0)
}

function CartItems({ cart }: { cart: Cart }) {
  const acknowledge = useAcknowledgeCart()
  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-6">
        <p className="font-bold">Seu carrinho está vazio.</p>
        <p className="text-sm text-sand">Explore o catálogo e adicione NFTs para continuar.</p>
        <Button asChild>
          <Link to="/" hash="catalogo">
            Explorar NFTs
          </Link>
        </Button>
      </div>
    )
  }
  const changed = cart.items.filter((i) => i.issues.length > 0)
  return (
    <>
      {changed.length > 0 && (
        <div role="alert" className="mb-5 flex flex-col gap-3 rounded-md border border-accent bg-band/60 p-4">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangleIcon className="size-5 text-accent-strong" aria-hidden />
            Alguns itens mudaram enquanto você navegava
          </p>
          <ul className="list-disc pl-6 text-sm text-sand">
            {changed.map((item) => (
              <li key={item.id}>{describeIssues(item)}</li>
            ))}
          </ul>
          <Button className="self-start" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
            {acknowledge.isPending ? 'Atualizando…' : 'Aceitar valores atuais'}
          </Button>
        </div>
      )}

      {/* Desktop: tabela */}
      <table className="hidden w-full border-separate border-spacing-y-3 md:table">
        <caption className="sr-only">NFTs no carrinho, com preço, quantidade de edições e total</caption>
        <thead>
          <tr className="text-left text-lg font-medium">
            <th scope="col" className="border-b border-line pb-2 font-medium">
              NFTs
            </th>
            <th scope="col" className="border-b border-line pb-2 font-medium">
              Preço
            </th>
            <th scope="col" className="border-b border-line pb-2 font-medium">
              Edições
            </th>
            <th scope="col" className="border-b border-line pb-2 font-medium">
              Total
            </th>
            <th scope="col" className="border-b border-line pb-2">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cart.items.map((item) => (
            <CartRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>

      {/* Mobile: cards */}
      <ul className="flex flex-col gap-5 md:hidden">
        {cart.items.map((item) => (
          <CartCard key={item.id} item={item} />
        ))}
      </ul>
    </>
  )
}

function describeIssues(item: CartItem): string {
  const parts: string[] = []
  if (item.issues.includes('SOLD_OUT')) parts.push(`${item.name} (${item.editionLabel}) esgotou e será removido`)
  else if (item.issues.includes('QUANTITY_REDUCED')) parts.push(`${item.name}: restam apenas ${item.available} unidade(s)`)
  if (item.issues.includes('PRICE_CHANGED')) {
    parts.push(`preço de ${item.name} mudou de ${formatEth(item.acknowledgedPriceEth)} para ${formatEth(item.unitPriceEth)} ETH`)
  }
  return parts.join('; ')
}

function useItemActions(item: CartItem) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const max = Math.max(item.quantity, Math.min(item.available, item.maxPerOrder))
  return {
    max,
    busy: update.isPending || remove.isPending,
    setQuantity: (quantity: number) => update.mutate({ itemId: item.id, quantity }),
    remove: () => remove.mutate({ itemId: item.id, name: item.name }),
  }
}

function IssueTag({ item }: { item: CartItem }) {
  if (item.issues.length === 0) return null
  return (
    <span className="mt-1 inline-block rounded-sm bg-accent/15 px-1.5 text-xs text-accent-strong">
      {item.issues.includes('SOLD_OUT') ? 'Esgotado' : item.issues.includes('PRICE_CHANGED') ? 'Preço alterado' : 'Estoque reduzido'}
    </span>
  )
}

function CartRow({ item }: { item: CartItem }) {
  const actions = useItemActions(item)
  const cell = 'bg-surface py-0 align-middle'
  return (
    <tr className={cn(item.issues.includes('SOLD_OUT') && 'opacity-70')} data-testid="cart-row" data-item-id={item.id}>
      <td className={cn(cell, 'w-[300px]')}>
        <div className="flex items-center gap-4">
          <img src={item.image.url} srcSet={item.image.srcSet} sizes="70px" alt="" width={70} height={70} className="size-[70px] object-cover" />
          <div>
            <Link to="/nft/$nftId" params={{ nftId: item.slug }} search={{ edicao: item.editionLabel }} className="text-base font-bold hover:text-accent-strong">
              {item.name}
            </Link>
            <p className="text-sm text-dust">
              ID do token: {item.tokenId}
              <span className="sr-only">, edição {item.editionLabel}</span>
            </p>
            <IssueTag item={item} />
          </div>
        </div>
      </td>
      <td className={cn(cell, 'text-base font-bold text-sand')}>
        {formatEth(item.unitPriceEth)} ETH
        {item.issues.includes('PRICE_CHANGED') && (
          <span className="block text-xs font-normal text-dust line-through">{formatEth(item.acknowledgedPriceEth)} ETH</span>
        )}
      </td>
      <td className={cell}>
        <QuantityStepper size="sm" value={item.quantity} max={actions.max} onChange={actions.setQuantity} disabled={actions.busy} label={`Quantidade de ${item.name}`} />
      </td>
      <td className={cn(cell, 'text-base font-bold text-accent-strong')}>{formatEth(item.lineTotalEth)} ETH</td>
      <td className={cn(cell, 'w-14 pr-4 text-right')}>
        <button
          type="button"
          onClick={actions.remove}
          disabled={actions.busy}
          className="rounded-sm p-1 text-sand hover:text-danger disabled:opacity-50"
          aria-label={`Remover ${item.name} do carrinho`}
        >
          <Trash2Icon className="size-5" aria-hidden />
        </button>
      </td>
    </tr>
  )
}

function CartCard({ item }: { item: CartItem }) {
  const actions = useItemActions(item)
  return (
    <li className="flex overflow-hidden rounded-md bg-surface" data-testid="cart-row" data-item-id={item.id}>
      <img src={item.image.url} srcSet={item.image.srcSet} sizes="100px" alt="" width={100} height={100} className="size-[100px] object-cover" />
      <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to="/nft/$nftId" params={{ nftId: item.slug }} className="block truncate text-base font-bold">
              {item.name}
            </Link>
            <p className="text-sm text-sand">Edição: {item.editionLabel}</p>
          </div>
          <button type="button" onClick={actions.remove} disabled={actions.busy} className="p-1 text-sand hover:text-danger" aria-label={`Remover ${item.name} do carrinho`}>
            <Trash2Icon className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-lg font-bold text-accent-strong">{formatEth(item.lineTotalEth)} ETH</p>
            <IssueTag item={item} />
          </div>
          <QuantityStepper size="sm" value={item.quantity} max={actions.max} onChange={actions.setQuantity} disabled={actions.busy} label={`Quantidade de ${item.name}`} />
        </div>
      </div>
    </li>
  )
}

function ItemsSkeleton() {
  const id = useId()
  return (
    <div role="status" aria-labelledby={id} className="flex flex-col gap-3">
      <span id={id} className="sr-only">
        Carregando carrinho
      </span>
      <Skeleton className="mb-1 hidden h-8 w-full md:block" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-[100px] w-full rounded-md md:h-[70px] md:rounded-none" />
      ))}
    </div>
  )
}
