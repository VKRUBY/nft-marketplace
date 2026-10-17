import type { EthString } from '@/shared/eth'
import { formatEth } from '@/shared/eth'
import { cn } from '@/lib/utils'

/** Preço em ETH com precisão decimal; preço anterior riscado quando houver. */
export function Price({
  value,
  compareAt,
  className,
  size = 'md',
}: {
  value: EthString
  compareAt?: EthString | null
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-3', className)}>
      <span
        className={cn(
          'font-bold text-accent-strong',
          size === 'sm' && 'text-sm',
          size === 'md' && 'text-lg',
          size === 'lg' && 'text-xl',
          size === 'xl' && 'text-2xl',
        )}
      >
        {formatEth(value)} ETH
      </span>
      {compareAt && (
        <span className={cn('text-dust line-through decoration-dust/70', size === 'sm' ? 'text-xs' : 'text-lg')}>
          <span className="sr-only">Preço anterior: </span>
          {formatEth(compareAt)} ETH
        </span>
      )}
    </span>
  )
}
