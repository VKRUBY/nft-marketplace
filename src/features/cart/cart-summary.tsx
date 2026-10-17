import { XIcon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Cart } from '@/contracts/domain'
import { ApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import { formatEth } from '@/shared/eth'
import { useCoupon } from './use-cart'

/**
 * Resumo de valores. Todos os números vêm da resposta da API (subtotal,
 * desconto, taxa de rede e total) — o cliente não recalcula nada.
 */
export function CartSummaryCard({
  cart,
  loading,
  title,
  action,
  showCoupon = true,
  className,
}: {
  cart: Cart | undefined
  loading: boolean
  title?: string
  action?: ReactNode
  showCoupon?: boolean
  className?: string
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : 'Resumo de valores'} className={cn('flex flex-col gap-5', className)}>
      {title && (
        <h2 id={titleId} className="border-b border-line pb-3 text-lg font-bold">
          {title}
        </h2>
      )}
      {showCoupon && <CouponForm cart={cart} disabled={loading || !cart?.items.length} />}
      {loading || !cart ? (
        <div role="status" aria-label="Carregando resumo" className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
          <Skeleton className="mt-4 h-7 w-full" />
        </div>
      ) : (
        <SummaryValues
          subtotal={cart.summary.subtotalEth}
          discount={cart.summary.discountEth}
          fee={cart.summary.networkFeeEth}
          total={cart.summary.totalEth}
        />
      )}
      {action && <div className="flex flex-col gap-3">{action}</div>}
    </section>
  )
}

export function SummaryValues({ subtotal, discount, fee, total }: { subtotal: string; discount: string; fee: string; total: string }) {
  const hasDiscount = discount !== '0'
  return (
    <dl aria-live="polite" className="flex flex-col gap-3 text-base">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="text-lg" data-testid="summary-subtotal">
          {formatEth(subtotal)} ETH
        </dd>
      </div>
      <div className="flex justify-between">
        <dt>Desconto do lançamento</dt>
        <dd className="text-base" data-testid="summary-discount">
          (-) {hasDiscount ? `${formatEth(discount)} ETH` : '00.00'}
        </dd>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-between">
          <dt>Taxa de rede</dt>
          <dd className="text-lg" data-testid="summary-fee">
            {formatEth(fee, { maxDecimals: 5, minDecimals: 3 })} ETH
          </dd>
        </div>
        <p className="text-right text-xs text-accent-strong">Taxa estimada</p>
      </div>
      <div className="mt-3 flex justify-between border-t border-line pt-4 text-lg font-bold">
        <dt>Total</dt>
        <dd className="text-accent-strong" data-testid="summary-total">
          {formatEth(total, { maxDecimals: 5, minDecimals: 3 })} ETH
        </dd>
      </div>
    </dl>
  )
}

function CouponForm({ cart, disabled }: { cart: Cart | undefined; disabled: boolean }) {
  const { applyCoupon, removeCoupon } = useCoupon()
  const id = useId()
  const [code, setCode] = useState('')
  const error = applyCoupon.error ? ApiError.from(applyCoupon.error) : null
  const message = error?.fieldErrors.code ?? error?.message

  if (cart?.coupon) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-sm border border-accent px-3 py-2 text-sm">
        <span>
          Cupom <strong className="text-accent-strong">{cart.coupon.code}</strong> — {cart.coupon.description}
        </span>
        <button
          type="button"
          onClick={() => removeCoupon.mutate()}
          disabled={removeCoupon.isPending}
          className="rounded-sm p-1 text-sand hover:text-cream"
          aria-label={`Remover cupom ${cart.coupon.code}`}
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!code.trim()) return
        applyCoupon.mutate(code.trim(), { onSuccess: () => setCode('') })
      }}
    >
      <label htmlFor={id} className="mb-2 block text-sm font-bold">
        Código promocional
      </label>
      <div className="flex max-md:rounded-full max-md:bg-surface">
        <input
          id={id}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (applyCoupon.isError) applyCoupon.reset()
          }}
          placeholder="Digite o código promocional..."
          aria-invalid={Boolean(message) || undefined}
          aria-describedby={message ? `${id}-error` : undefined}
          disabled={disabled}
          autoCapitalize="characters"
          className="h-10 min-w-0 flex-1 rounded-l-sm border border-accent bg-transparent px-2 text-xs uppercase placeholder:normal-case outline-none focus-visible:ring-2 focus-visible:ring-accent/50 aria-invalid:border-danger max-md:h-12 max-md:rounded-l-full max-md:border-0 max-md:px-5"
        />
        <Button type="submit" className="h-10 rounded-l-none px-5 text-base max-md:h-12 max-md:rounded-full" disabled={disabled || applyCoupon.isPending || !code.trim()}>
          {applyCoupon.isPending ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
      {message && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-danger">
          {message}
        </p>
      )}
    </form>
  )
}
