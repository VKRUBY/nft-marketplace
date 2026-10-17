import { MinusIcon, PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Seletor de quantidade (botões laranja do Figma). Mesmo componente no
 * detalhe e no carrinho, desktop e mobile.
 */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled,
  label,
  size = 'md',
}: {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  /** Nome acessível, ex.: "Quantidade de Emerald Ape #042". */
  label: string
  size?: 'sm' | 'md'
}) {
  const btn = cn(
    'grid place-items-center rounded-full bg-accent text-ink transition-opacity hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40',
    size === 'md' ? 'h-11 w-[30px] md:h-11' : 'h-6 w-[18px]',
  )
  return (
    <div role="group" aria-label={label} className={cn('flex items-center', size === 'md' ? 'gap-3' : 'gap-2')}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="Diminuir quantidade"
      >
        <MinusIcon className={size === 'md' ? 'size-5' : 'size-3'} aria-hidden />
      </button>
      <output aria-live="polite" aria-label="Quantidade" className={cn('min-w-[2ch] text-center', size === 'md' ? 'text-lg' : 'text-base')}>
        {value}
      </output>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="Aumentar quantidade"
      >
        <PlusIcon className={size === 'md' ? 'size-5' : 'size-3'} aria-hidden />
      </button>
    </div>
  )
}
