import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { HourglassIcon, Loader2Icon, XCircleIcon, XIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { NotFound } from '@/app/not-found'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Order } from '@/contracts/domain'
import { NETWORKS, WALLET_PROVIDERS } from '@/contracts/networks'
import { orderAttempts } from '@/features/checkout/order-attempt'
import { orderQuery } from '@/features/checkout/use-checkout'
import { ApiError } from '@/lib/api/errors'
import { useRealtimeStatus } from '@/lib/realtime/socket'
import { useDocumentTitle } from '@/lib/use-document-title'
import { cn } from '@/lib/utils'
import { formatEth } from '@/shared/eth'

const POLL_WHILE_PENDING_MS = 4_000

/**
 * Status e recibo do pedido. A tela é renderizada só a partir do snapshot
 * do pedido retornado pela API — mudanças posteriores no catálogo não
 * alteram estes valores. A confirmação só aparece com status `confirmed`.
 *
 * Pendente: atualiza por `order.updated` (Socket.IO) e, como garantia, por
 * polling enquanto pendente; após refresh ou reconexão, o GET recupera o
 * estado atual sem criar outra compra.
 */
export function OrderStatusPage({ userId, orderId }: { userId: string; orderId: string }) {
  const query = useQuery({
    ...orderQuery(userId, orderId),
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? POLL_WHILE_PENDING_MS : false),
  })
  const order = query.data
  useDocumentTitle(
    order?.status === 'confirmed' ? 'Pedido confirmado — Kurio' : order?.status === 'declined' ? 'Pagamento recusado — Kurio' : 'Pedido em processamento — Kurio',
  )

  // Pedido terminal: a tentativa de envio pode ser descartada.
  useEffect(() => {
    if (order && order.status !== 'pending') orderAttempts.clear(userId)
  }, [order, userId])

  if (query.isPending) {
    return (
      <Shell>
        <div role="status" aria-label="Carregando pedido" className="flex flex-col items-center gap-4 p-10">
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Shell>
    )
  }
  if (query.isError && !order) {
    const error = ApiError.from(query.error)
    if (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN') return <NotFound title="Pedido não encontrado" />
    return (
      <Shell>
        <div role="alert" className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-bold">Não foi possível consultar o pedido.</p>
          <p className="text-sm text-sand">{error.message}</p>
          <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
        </div>
      </Shell>
    )
  }
  return <Receipt order={order!} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page py-10 md:py-[166px] md:pb-24">
      <div className="relative mx-auto max-w-[578px] border-b-[10px] border-accent bg-surface">{children}</div>
    </div>
  )
}

function Receipt({ order }: { order: Order }) {
  const navigate = useNavigate()
  const realtime = useRealtimeStatus()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const network = NETWORKS[order.network]

  // Anuncia e foca a mudança de status (pendente → confirmado/recusado).
  useEffect(() => {
    headingRef.current?.focus()
  }, [order.status])

  const title =
    order.status === 'confirmed'
      ? 'Seus NFTs agora estão na sua carteira'
      : order.status === 'declined'
        ? 'Pagamento recusado'
        : 'Aguardando confirmação na rede'

  return (
    <Shell>
      <button
        type="button"
        onClick={() => void navigate({ to: '/' })}
        className="absolute top-5 right-5 rounded-sm p-1 text-accent-strong hover:bg-band"
        aria-label="Fechar e voltar ao início"
      >
        <XIcon className="size-5" aria-hidden />
      </button>
      <div className="flex flex-col items-center gap-4 px-6 pt-5 pb-6 text-center" data-order-status={order.status}>
        <StatusIcon status={order.status} />
        <h1 ref={headingRef} tabIndex={-1} aria-live="polite" className="text-lg font-bold text-sand outline-none">
          {title}
        </h1>
        {order.status === 'pending' && (
          <p className="text-sm text-sand">
            {realtime === 'connected'
              ? 'Você pode sair desta página: o pedido segue sendo processado e o status aparece aqui assim que a rede confirmar.'
              : 'Sem conexão em tempo real no momento. Continuamos verificando o status periodicamente.'}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-y border-accent px-6 py-4 text-sm sm:grid-cols-[auto_auto_auto_auto] sm:justify-between sm:px-9">
        <Meta label="ID da transação" strong>
          {order.txHash ? `${order.txHash.slice(0, 6)}…${order.txHash.slice(-4)}` : order.status === 'pending' ? 'Pendente' : '—'}
        </Meta>
        <Meta label="Data">{formatReceiptDate(order.createdAt)}</Meta>
        <Meta label="Total">{formatEth(order.totalEth, { maxDecimals: 5, minDecimals: 3 })} ETH</Meta>
        <Meta label="Carteira" strong last>
          {WALLET_PROVIDERS[order.wallet.provider]}
        </Meta>
      </dl>

      <div className="px-6 pt-7 pb-8 sm:px-11">
        <h2 className="text-base font-bold">Detalhes da transação</h2>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">Itens do pedido</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="pb-2 font-medium">
                NFTs
              </th>
              <th scope="col" className="pb-2 text-center font-medium">
                Edições
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.itemId}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <img src={line.image.url} alt="" width={65} height={65} className="size-12 shrink-0 rounded-md object-cover sm:size-[65px]" />
                    <div>
                      <p className="text-sm font-bold sm:text-base">{line.name}</p>
                      <p className="text-xs text-dust sm:text-sm">Token {line.tokenId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-2 text-center text-sm whitespace-nowrap text-sand">(x {line.quantity})</td>
                <td className="text-right text-base font-bold whitespace-nowrap text-accent-strong sm:text-lg">{formatEth(line.lineTotalEth)} ETH</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 ml-auto flex max-w-[320px] flex-col gap-2 border-b border-line pb-3">
          {order.discountEth !== '0' && (
            <div className="flex justify-between">
              <dt>Desconto ({order.coupon?.code})</dt>
              <dd>(-) {formatEth(order.discountEth)} ETH</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Taxa de rede</dt>
            <dd className="text-lg">{formatEth(order.networkFeeEth, { maxDecimals: 5, minDecimals: 3 })} ETH</dd>
          </div>
          <div className="flex justify-between font-bold">
            <dt>Total</dt>
            <dd className="text-lg text-accent-strong">{formatEth(order.totalEth, { maxDecimals: 5, minDecimals: 3 })} ETH</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col items-center gap-4 text-center text-sm text-sand">
          {order.status === 'confirmed' && (
            <>
              <p>Transação confirmada na {network.label}. A propriedade foi transferida para sua carteira conectada e registrada na rede.</p>
              {order.explorerUrl && (
                <Button asChild className="h-12 px-4 text-base">
                  <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer">
                    Ver no {network.explorerName}
                    <span className="sr-only"> (link simulado, abre em nova aba)</span>
                  </a>
                </Button>
              )}
            </>
          )}
          {order.status === 'declined' && (
            <>
              <p>{order.declineReason ?? 'A transação não foi concluída.'} Nenhum valor foi cobrado e seus itens continuam no carrinho.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/pagamento">Tentar novamente</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/carrinho">Ver carrinho</Link>
                </Button>
              </div>
            </>
          )}
          {order.status === 'pending' && (
            <p className="flex items-center gap-2">
              <Loader2Icon className="size-4 animate-spin" aria-hidden /> Processando na rede {network.label}…
            </p>
          )}
        </div>
      </div>
    </Shell>
  )
}

/** "29 Jul, 2026" como no Figma (mês abreviado em português). */
function formatReceiptDate(iso: string): string {
  const d = new Date(iso)
  const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return `${String(d.getDate()).padStart(2, '0')} ${month.charAt(0).toUpperCase()}${month.slice(1)}, ${d.getFullYear()}`
}

function Meta({ label, children, strong, last }: { label: string; children: React.ReactNode; strong?: boolean; last?: boolean }) {
  return (
    <div className={last ? 'sm:pl-4' : 'sm:border-r sm:border-accent sm:pr-4 [&:not(:first-child)]:sm:pl-4'}>
      <dt className={cn('whitespace-nowrap', strong ? 'font-bold text-sand' : 'text-sand')}>{label}</dt>
      <dd className="text-sand">{children}</dd>
    </div>
  )
}

function StatusIcon({ status }: { status: Order['status'] }) {
  if (status === 'declined') return <XCircleIcon className="size-16 text-danger" aria-hidden />
  if (status === 'pending') return <HourglassIcon className="size-16 animate-pulse text-accent" aria-hidden />
  return (
    <svg viewBox="0 0 70 84" className="h-20 w-[66px] text-accent" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M3 34 35 58l32-24v46H3V34Z" />
      <path d="m3 80 24-20M67 80 43 60" />
      <rect x="11" y="8" width="48" height="40" rx="2" />
      <path d="M27 8a8 8 0 0 1 16 0" />
      <text x="35" y="25" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Roboto Mono">
        THANK
      </text>
      <text x="35" y="37" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Roboto Mono">
        YOU
      </text>
    </svg>
  )
}
