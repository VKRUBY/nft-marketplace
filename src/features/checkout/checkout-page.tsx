import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangleIcon, ChevronDownIcon, MoreVerticalIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { EnsField } from '@/components/ens-field'
import { Field } from '@/components/form-field'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import { WalletChip } from '@/components/layout/site-footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { Network, Quote, Session, User, WalletProvider, WalletView } from '@/contracts/domain'
import { NETWORK_LIST, NETWORKS, WALLET_PROVIDER_LIST, WALLET_PROVIDERS } from '@/contracts/networks'
import { buyerSchema } from '@/contracts/schemas'
import { SummaryValues } from '@/features/cart/cart-summary'
import { useAcknowledgeCart } from '@/features/cart/use-cart'
import { ApiError } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query/keys'
import { useDocumentTitle } from '@/lib/use-document-title'
import { cn } from '@/lib/utils'
import { formatEth } from '@/shared/eth'
import { checkoutDraft } from './order-attempt'
import { ReviewDialog } from './review-dialog'
import { useActiveOrders, useProfile, useQuote, useWallets } from './use-checkout'

type BuyerForm = z.input<typeof buyerSchema>

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function defaultsFrom(user: User, wallet: WalletView | undefined): BuyerForm {
  return {
    displayName: wallet?.displayName ?? user.name,
    username: user.username,
    network: wallet?.network ?? 'ethereum',
    profileName: wallet?.profileName ?? user.username,
    address: wallet?.address ?? '',
    secondaryAddress: wallet?.secondaryAddress ?? '',
    provider: wallet?.provider ?? 'metamask',
    referralCode: wallet?.referralCode ?? '',
    email: wallet?.email ?? user.email,
    ensName: wallet?.ensName ?? user.ensName ?? '',
    note: '',
  }
}

/**
 * Pagamento (frames Desktop/Mobile Pagamento): dados do colecionador,
 * carteira e rede, resumo pela cotação da API e revisão antes do envio.
 */
export function CheckoutPage({ session }: { session: Session }) {
  useDocumentTitle('Pagamento — Kurio')
  const userId = session.user.id
  const wallets = useWallets(userId)
  const profile = useProfile(userId)
  const active = useActiveOrders(userId)
  const pendingOrder = active.data?.[0]

  if (wallets.isPending || profile.isPending) return <CheckoutSkeleton />
  if (wallets.isError || profile.isError) {
    const error = ApiError.from(wallets.error ?? profile.error)
    return (
      <div role="alert" className="container-page flex flex-col items-start gap-3 py-12">
        <p className="font-bold">Não foi possível carregar seus dados de pagamento.</p>
        <p className="text-sm text-sand">{error.message}</p>
        <Button onClick={() => void Promise.all([wallets.refetch(), profile.refetch()])}>Tentar novamente</Button>
      </div>
    )
  }
  return (
    <>
      {pendingOrder && (
        <div role="status" className="container-page mt-4">
          <p className="flex flex-wrap items-center gap-3 rounded-md border border-accent bg-band px-4 py-3 text-sm">
            Você tem um pedido aguardando confirmação na rede.
            <Link to="/pedido/$orderId" params={{ orderId: pendingOrder.id }} className="font-bold text-accent-strong underline">
              Acompanhar pedido
            </Link>
          </p>
        </div>
      )}
      <CheckoutForm userId={userId} user={profile.data} wallets={wallets.data} />
    </>
  )
}

function CheckoutForm({ userId, user, wallets }: { userId: string; user: User; wallets: WalletView[] }) {
  const navigate = useNavigate()
  const primary = wallets.find((w) => w.role === 'primary') ?? wallets[0]
  const secondary = wallets.find((w) => w.role === 'secondary')
  const draft = useMemo(() => checkoutDraft.load<BuyerForm & { walletId: string }>(userId), [userId])
  const [walletId, setWalletId] = useState<string | undefined>(draft?.walletId ?? primary?.id)
  const wallet = wallets.find((w) => w.id === walletId)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [formOpenMobile, setFormOpenMobile] = useState(false)

  const form = useForm<BuyerForm>({
    resolver: zodResolver(buyerSchema),
    defaultValues: { ...defaultsFrom(user, wallet), ...draft },
    mode: 'onTouched',
  })
  const network = useWatch({ control: form.control, name: 'network' }) as Network
  const values = useWatch({ control: form.control })

  // Rascunho preservado para retomada após expiração de sessão ou refresh.
  useEffect(() => {
    checkoutDraft.save(userId, { ...values, walletId })
  }, [values, walletId, userId])

  const quote = useQuote(userId, network, Boolean(walletId))

  const chooseWallet = (id: string) => {
    setWalletId(id)
    const next = wallets.find((w) => w.id === id)
    if (next) form.reset({ ...defaultsFrom(user, next), note: form.getValues('note') })
  }

  const onSubmit = form.handleSubmit(
    () => setReviewOpen(true),
    () => {
      setFormOpenMobile(true)
      // Leva o foco ao primeiro campo inválido.
      requestAnimationFrame(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus())
    },
  )

  if (!wallet) {
    return (
      <div className="container-page flex flex-col items-start gap-3 py-12">
        <h1 className="text-xl font-bold">Cadastre uma carteira para continuar</h1>
        <p className="text-sand">As carteiras cadastradas ficam disponíveis no pagamento e recebem os NFTs comprados.</p>
        <Button asChild>
          <Link to="/perfil/carteiras">Cadastrar carteira</Link>
        </Button>
      </div>
    )
  }

  const blocked = !quote.data || quote.data.issues.length > 0 || quote.data.lines.length === 0
  const networkMismatch = wallet.network !== network

  return (
    <div className="container-page pb-12 md:pt-8">
      <MobileTopBar title="Pagamento com carteira" />
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Pagamento' }]} />
      <h1 className="sr-only max-md:hidden">Pagamento</h1>

      <form noValidate onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between">
        {/* Coluna esquerda: perfil do colecionador */}
        <section aria-labelledby="buyer-title" className="order-2 lg:order-none">
          <button
            type="button"
            className="mb-2 flex w-full items-center justify-between text-left md:pointer-events-none"
            aria-expanded={formOpenMobile}
            aria-controls="buyer-fields"
            onClick={() => setFormOpenMobile((v) => !v)}
          >
            <h2 id="buyer-title" className="text-lg font-bold">
              Perfil do colecionador
            </h2>
            <ChevronDownIcon aria-hidden className={cn('size-5 transition-transform md:hidden', formOpenMobile && 'rotate-180')} />
          </button>
          <p className="mb-4 text-sm text-sand md:hidden">Pré-preenchido com a carteira selecionada. Toque para revisar.</p>
          <div id="buyer-fields" className={cn('grid gap-x-6 gap-y-5 md:grid md:grid-cols-2', formOpenMobile ? 'grid' : 'hidden')}>
            <BuyerFields form={form} />
            <div className="flex items-center gap-2 md:col-span-2">
              <input
                id="use-other"
                type="checkbox"
                className="size-4 appearance-none rounded-full border border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-accent-strong"
                checked={walletId === secondary?.id && Boolean(secondary)}
                disabled={!secondary}
                onChange={(e) => chooseWallet(e.target.checked && secondary ? secondary.id : primary!.id)}
              />
              <label htmlFor="use-other" className="text-base">
                Usar outra carteira?
                {!secondary && (
                  <span className="ml-2 text-sm text-sand">
                    (
                    <Link to="/perfil/carteiras" className="text-accent-strong underline">
                      cadastre uma carteira secundária
                    </Link>
                    )
                  </span>
                )}
              </label>
            </div>
            <Field label="Observação do colecionador (opcional)" error={form.formState.errors.note?.message} className="md:col-span-1">
              {(p) => <Textarea {...p} {...form.register('note')} rows={6} />}
            </Field>
          </div>
        </section>

        {/* Coluna direita: NFTs, valores, carteira e rede */}
        <aside aria-label="Resumo do pedido" className="order-1 flex flex-col gap-5 lg:order-none">
          <MobileWallets wallets={wallets} walletId={walletId} onChoose={chooseWallet} />
          <QuoteSummary quote={quote.data} loading={quote.isPending} error={quote.error} onRetry={() => void quote.refetch()} fetching={quote.isFetching} />

          <fieldset>
            <legend className="mb-4 w-full text-center text-lg font-bold max-md:text-left">Carteira e rede</legend>
            <Controller
              control={form.control}
              name="provider"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={(v) => field.onChange(v as WalletProvider)} aria-label="Tipo de carteira">
                  {WALLET_PROVIDER_LIST.map((p) => (
                    <label
                      key={p}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-4 rounded-sm border px-5 py-3 max-md:rounded-xl max-md:border-0 max-md:bg-surface',
                        field.value === p ? 'border-cream' : 'border-line',
                      )}
                    >
                      <RadioGroupItem value={p} className="max-md:order-2 max-md:ml-auto" />
                      <span aria-hidden className="grid size-10 place-items-center rounded-full border border-line text-sm font-bold text-accent-strong md:hidden">
                        {WALLET_PROVIDERS[p][0]}
                      </span>
                      <span>{WALLET_PROVIDERS[p]}</span>
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
            <div className="mt-3 max-md:hidden">
              <WalletChip />
            </div>
          </fieldset>

          <p className="flex items-center justify-end gap-6 text-lg font-bold md:hidden">
            Total: <span className="text-accent-strong">{quote.data ? `${formatEth(quote.data.totalEth, { maxDecimals: 5, minDecimals: 3 })} ETH` : '—'}</span>
          </p>

          {networkMismatch && (
            <p role="alert" className="text-sm text-danger">
              A carteira “{wallet.nickname}” está na rede {NETWORKS[wallet.network].label}. Escolha essa rede ou outra carteira.
            </p>
          )}
          <Button type="submit" className="h-[45px] text-base max-md:h-[60px] max-md:rounded-full" disabled={blocked || networkMismatch}>
            Confirmar compra
          </Button>
          <p className="text-center text-xs text-sand">Você revisa todos os valores antes do envio.</p>
        </aside>
      </form>

      {quote.data && (
        <ReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          userId={userId}
          quote={quote.data}
          wallet={wallet}
          buyer={form.getValues()}
          onCreated={(order) => {
            checkoutDraft.clear(userId)
            void navigate({ to: '/pedido/$orderId', params: { orderId: order.id } })
          }}
        />
      )}
    </div>
  )
}

function BuyerFields({ form }: { form: ReturnType<typeof useForm<BuyerForm>> }) {
  const { errors } = form.formState
  return (
    <>
      <Field label="Nome de exibição" required error={errors.displayName?.message}>
        {(p) => <Input {...p} {...form.register('displayName')} autoComplete="name" />}
      </Field>
      <Field label="Nome de usuário" required error={errors.username?.message}>
        {(p) => <Input {...p} {...form.register('username')} autoComplete="username" />}
      </Field>
      <Field label="Rede" required error={errors.network?.message}>
        {(p) => (
          <Controller
            control={form.control}
            name="network"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...p} onBlur={field.onBlur}>
                  <SelectValue placeholder="Selecione uma rede" />
                </SelectTrigger>
                <SelectContent>
                  {NETWORK_LIST.map((n) => (
                    <SelectItem key={n} value={n}>
                      {NETWORKS[n].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>
      <Field label="Nome do perfil" required error={errors.profileName?.message}>
        {(p) => <Input {...p} {...form.register('profileName')} />}
      </Field>
      <Field label="Endereço da carteira" required error={errors.address?.message}>
        {(p) => <Input {...p} {...form.register('address')} placeholder="Endereço 0x da carteira" spellCheck={false} autoComplete="off" />}
      </Field>
      <Field label="ENS ou carteira secundária (opcional)" error={errors.secondaryAddress?.message} labelClassName="md:invisible">
        {(p) => <Input {...p} {...form.register('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} />}
      </Field>
      <Field label="Tipo de carteira" required error={errors.provider?.message}>
        {(p) => (
          <Controller
            control={form.control}
            name="provider"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...p} onBlur={field.onBlur}>
                  <SelectValue placeholder="Selecione uma carteira" />
                </SelectTrigger>
                <SelectContent>
                  {WALLET_PROVIDER_LIST.map((w) => (
                    <SelectItem key={w} value={w}>
                      {WALLET_PROVIDERS[w]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>
      <Field label="Código de indicação (opcional)" error={errors.referralCode?.message}>
        {(p) => <Input {...p} {...form.register('referralCode')} autoCapitalize="characters" />}
      </Field>
      <Field label="E-mail" required error={errors.email?.message}>
        {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" />}
      </Field>
      <EnsField form={form as never} />
    </>
  )
}

function MobileWallets({ wallets, walletId, onChoose }: { wallets: WalletView[]; walletId?: string; onChoose: (id: string) => void }) {
  return (
    <fieldset className="md:hidden">
      <div className="mb-3 flex items-center justify-between">
        <legend className="text-lg font-bold">Carteira conectada</legend>
        <Link to="/perfil/carteiras" className="text-sm font-bold text-accent-strong">
          Trocar carteira
        </Link>
      </div>
      <RadioGroup value={walletId} onValueChange={onChoose} aria-label="Carteira conectada">
        {wallets.map((w) => (
          <label key={w.id} className="flex cursor-pointer items-center gap-4 rounded-xl bg-surface px-5 py-4">
            <RadioGroupItem value={w.id} />
            <span className="flex-1">
              <span className="block font-bold">{w.nickname}</span>
              <span className="block text-sm text-sand">{w.ensName ? `${w.ensName}.kurio.eth` : shortAddress(w.address)}</span>
              <span className="block text-sm text-sand">Rede {NETWORKS[w.network].label}</span>
            </span>
            <MoreVerticalIcon className="size-5 text-sand" aria-hidden />
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

function QuoteSummary({
  quote,
  loading,
  error,
  fetching,
  onRetry,
}: {
  quote: Quote | undefined
  loading: boolean
  error: unknown
  fetching: boolean
  onRetry: () => void
}) {
  const acknowledge = useAcknowledgeCart()
  const queryClient = useQueryClient()
  if (loading) {
    return (
      <div role="status" aria-label="Calculando valores" className="flex flex-col gap-3">
        <Skeleton className="h-6 w-1/3" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[70px] w-full" />
        ))}
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (!quote) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-md border border-line bg-surface p-4">
        <p className="font-bold">Não foi possível calcular os valores.</p>
        <p className="text-sm text-sand">{error ? ApiError.from(error).message : ''}</p>
        <Button size="sm" onClick={onRetry} disabled={fetching}>
          Tentar novamente
        </Button>
      </div>
    )
  }
  if (quote.lines.length === 0 && quote.issues.length === 0) {
    return (
      <div className="rounded-md bg-surface p-4">
        <p className="font-bold">Seu carrinho está vazio.</p>
        <Link to="/" hash="catalogo" className="text-sm text-accent-strong underline">
          Explorar NFTs
        </Link>
      </div>
    )
  }
  return (
    <section aria-labelledby="your-nfts">
      <h2 id="your-nfts" className="text-lg font-bold max-md:sr-only">
        Seus NFTs
      </h2>
      {quote.issues.length > 0 && (
        <div role="alert" className="mt-3 flex flex-col gap-2 rounded-md border border-accent bg-band/60 p-3 text-sm">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangleIcon className="size-4 text-accent-strong" aria-hidden />
            Os valores mudaram. Revise antes de continuar.
          </p>
          <ul className="list-disc pl-5 text-sand">
            {quote.issues.map((i) => (
              <li key={`${i.code}-${i.itemId ?? ''}`}>{i.message}</li>
            ))}
          </ul>
          <Button
            size="sm"
            className="self-start"
            disabled={acknowledge.isPending}
            onClick={() =>
              acknowledge.mutate(undefined, {
                onSuccess: () => void queryClient.invalidateQueries({ queryKey: [...queryKeys.private.all], predicate: (q) => q.queryKey[2] === 'quote' }),
              })
            }
          >
            {acknowledge.isPending ? 'Atualizando…' : 'Aceitar novos valores'}
          </Button>
        </div>
      )}
      <div className="mt-3 flex justify-between border-b border-line pb-2 text-base font-medium max-md:hidden">
        <span>NFTs</span>
        <span>Subtotal</span>
      </div>
      <ul aria-busy={fetching} className="mt-3 flex flex-col gap-3 max-md:hidden">
        {quote.lines.map((line) => (
          <li key={line.itemId} className="flex items-center gap-3 bg-surface py-1 pr-4 pl-1">
            <img src={line.image.url} srcSet={line.image.srcSet} sizes="65px" alt="" width={65} height={65} className="size-[65px] rounded-md object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{line.name}</p>
              <p className="text-sm text-dust">ID do token: {line.tokenId}</p>
            </div>
            <span className="text-sm text-sand">(x {line.quantity})</span>
            <span className="text-lg font-bold text-accent-strong">{formatEth(line.lineTotalEth)} ETH</span>
          </li>
        ))}
      </ul>
      <p className="my-4 text-center text-sm max-md:hidden">
        Tem um código promocional?{' '}
        <Link to="/carrinho" className="text-accent-strong underline">
          Aplique aqui
        </Link>
      </p>
      <div className="max-md:hidden">
        <SummaryValues subtotal={quote.subtotalEth} discount={quote.discountEth} fee={quote.networkFeeEth} total={quote.totalEth} />
      </div>
    </section>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="container-page grid gap-10 py-8 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between" role="status" aria-label="Carregando pagamento">
      <div className="grid grid-cols-2 gap-6">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-[70px]" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[70px]" />
        ))}
      </div>
    </div>
  )
}
