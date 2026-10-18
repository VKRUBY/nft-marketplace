import { AlertTriangleIcon, Loader2Icon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { BuyerInfo, Order, Quote, WalletView } from '@/contracts/domain'
import { NETWORKS, WALLET_PROVIDERS } from '@/contracts/networks'
import type { buyerSchema } from '@/contracts/schemas'
import { SummaryValues } from '@/features/cart/cart-summary'
import { ApiError } from '@/lib/api/errors'
import { formatEth } from '@/shared/eth'
import type { z } from 'zod'
import { useConnectWallet, usePlaceOrder } from './use-checkout'

type Phase = 'review' | 'connecting' | 'submitting' | 'done'

/**
 * Revisão antes do envio. O usuário vê exatamente a cotação que será
 * enviada (linhas, taxas, total, carteira e rede) e confirma. A confirmação
 * conecta a carteira (simulada) e cria o pedido com chave de idempotência.
 * Se o servidor recusar por valores desatualizados, a cotação nova aparece
 * aqui e a compra só segue com uma nova confirmação.
 */
export function ReviewDialog({
  open,
  onOpenChange,
  userId,
  quote,
  wallet,
  buyer,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  quote: Quote
  wallet: WalletView
  buyer: z.input<typeof buyerSchema>
  onCreated: (order: Order) => void
}) {
  const connect = useConnectWallet(userId)
  const place = usePlaceOrder(userId)
  const [phase, setPhase] = useState<Phase>('review')
  const [retrying, setRetrying] = useState(0)
  const [changedFrom, setChangedFrom] = useState<string | null>(null)
  const reviewedQuoteId = useRef(quote.id)

  // A cotação mudou com o diálogo aberto (evento em tempo real ou 409): exige nova confirmação.
  useEffect(() => {
    if (!open) {
      reviewedQuoteId.current = quote.id
      setChangedFrom(null)
      return
    }
    if (quote.id !== reviewedQuoteId.current) setChangedFrom((prev) => prev ?? quote.totalEth)
  }, [quote.id, quote.totalEth, open])

  const error = connect.error ?? place.error
  const apiError = error ? ApiError.from(error) : null
  const busy = phase !== 'review'
  const hasIssues = quote.issues.length > 0

  const confirm = async () => {
    if (busy) return
    reviewedQuoteId.current = quote.id
    setChangedFrom(null)
    connect.reset()
    place.reset()
    try {
      const connected = wallet.connection?.status === 'connected' && wallet.connection.network === quote.network
      if (!connected) {
        setPhase('connecting')
        await connect.mutateAsync({ walletId: wallet.id, network: quote.network })
      }
      setPhase('submitting')
      setRetrying(0)
      const parsed = buyer as BuyerInfo
      const order = await place.mutateAsync({
        quoteId: quote.id,
        walletId: wallet.id,
        network: quote.network,
        buyer: {
          ...parsed,
          secondaryAddress: parsed.secondaryAddress || null,
          referralCode: parsed.referralCode || null,
          ensName: parsed.ensName || null,
          note: parsed.note || null,
        },
        onRetry: setRetrying,
      })
      // Pedido criado: o diálogo fica travado até a navegação. Sem isso, um
      // clique logo depois enviaria a cotação renovada pelo evento de estoque
      // da própria reserva — conteúdo novo, chave nova, segundo pedido.
      setPhase('done')
      onCreated(order)
    } catch {
      /* erro exibido abaixo */
      setPhase('review')
    }
  }

  const stale = apiError?.code === 'QUOTE_STALE' || apiError?.code === 'AVAILABILITY_CONFLICT' || apiError?.code === 'QUOTE_EXPIRED'

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-[578px] px-6 py-8 sm:px-11" showClose={!busy}>
        <DialogTitle className="text-xl">Revise seu pedido</DialogTitle>
        <DialogDescription className="mt-1">Confira os valores. Ao confirmar, sua carteira será conectada e o pedido enviado.</DialogDescription>

        {(changedFrom || stale) && phase !== 'done' && (
          <div role="alert" className="mt-5 flex gap-2 rounded-md border border-accent bg-band p-3 text-sm">
            <AlertTriangleIcon className="size-5 shrink-0 text-accent-strong" aria-hidden />
            <div>
              <p className="font-bold">Os valores foram atualizados.</p>
              <p className="text-sand">
                {apiError?.code === 'QUOTE_EXPIRED' ? 'A cotação expirou. ' : `${apiError?.message ?? ''} `}
                Novo total: <strong className="text-cream">{formatEth(quote.totalEth, { maxDecimals: 5, minDecimals: 3 })} ETH</strong>. Confirme novamente para
                continuar.
              </p>
            </div>
          </div>
        )}

        <ul className="mt-6 flex flex-col gap-3 border-b border-line pb-4">
          {quote.lines.map((line) => (
            <li key={line.itemId} className="flex items-center gap-3">
              <img src={line.image.url} alt="" width={48} height={48} className="size-12 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{line.name}</p>
                <p className="text-xs text-dust">
                  Edição {line.editionLabel} · ID do token: {line.tokenId}
                </p>
              </div>
              <span className="text-sm text-sand">(x {line.quantity})</span>
              <span className="font-bold text-accent-strong">{formatEth(line.lineTotalEth)} ETH</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-sand">Carteira</dt>
          <dd>
            {wallet.nickname} · {WALLET_PROVIDERS[buyer.provider as keyof typeof WALLET_PROVIDERS] ?? WALLET_PROVIDERS[wallet.provider]} ·{' '}
            {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
          </dd>
          <dt className="text-sand">Rede</dt>
          <dd>{NETWORKS[quote.network].label}</dd>
          {quote.coupon && (
            <>
              <dt className="text-sand">Cupom</dt>
              <dd>{quote.coupon.code}</dd>
            </>
          )}
        </dl>
        <div className="mt-5">
          <SummaryValues subtotal={quote.subtotalEth} discount={quote.discountEth} fee={quote.networkFeeEth} total={quote.totalEth} />
        </div>

        <div aria-live="polite" className="mt-4 min-h-6 text-sm">
          {phase === 'connecting' && (
            <p className="flex items-center gap-2 text-sand">
              <Loader2Icon className="size-4 animate-spin" aria-hidden /> Conectando {WALLET_PROVIDERS[wallet.provider]}… aprove a conexão na carteira.
            </p>
          )}
          {phase === 'submitting' && (
            <p className="flex items-center gap-2 text-sand">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              {retrying > 0 ? `A rede está lenta. Verificando o envio (tentativa ${retrying + 1}) sem duplicar o pedido…` : 'Enviando pedido…'}
            </p>
          )}
          {!busy && apiError && !stale && (
            <p role="alert" className="text-danger">
              {apiError.code === 'WALLET_REJECTED'
                ? `${apiError.message} Tente conectar de novo ou escolha outra carteira.`
                : apiError.isConnectivity
                  ? 'Não conseguimos confirmar o envio por falha de conexão. Tentar novamente usa o mesmo pedido, sem cobrar duas vezes.'
                  : apiError.message}
            </p>
          )}
          {hasIssues && !busy && (
            <p role="alert" className="text-danger">
              Há itens com alterações de preço ou disponibilidade. Feche e aceite os novos valores no resumo.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Voltar
          </Button>
          <Button onClick={() => void confirm()} disabled={busy || hasIssues} aria-disabled={busy || hasIssues}>
            {phase === 'done' ? 'Pedido enviado' : busy ? 'Processando…' : changedFrom || stale ? 'Confirmar novos valores' : apiError ? 'Tentar novamente' : 'Confirmar e enviar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
