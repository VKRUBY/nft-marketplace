import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Campo de formulário com label associado, marca de obrigatório (visual e
 * para leitores de tela), dica e mensagem de erro ligada por
 * aria-describedby. O input recebe aria-invalid quando há erro.
 */
export function Field({
  label,
  required,
  error,
  hint,
  className,
  labelClassName,
  hideLabel,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  labelClassName?: string
  hideLabel?: boolean
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string; 'aria-required'?: true }) => ReactNode
}) {
  const id = useId()
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-base text-cream', hideLabel && 'sr-only', labelClassName)}>
        {label}
        {required && (
          <>
            <span aria-hidden className="ml-0.5 text-lg leading-none text-required">
              *
            </span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        )}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required ? true : undefined,
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-dust">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', props.className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-dust hover:text-cream"
      >
        {visible ? <EyeIcon className="size-5" aria-hidden /> : <EyeOffIcon className="size-5" aria-hidden />}
      </button>
    </div>
  )
}

/** Aplica `fieldErrors` da API aos campos do react-hook-form. Retorna se algum campo recebeu erro. */
export function applyServerErrors<F extends FieldValues>(
  fieldErrors: Record<string, string>,
  setError: UseFormSetError<F>,
  fields: ReadonlyArray<Path<F>>,
): boolean {
  let applied = false
  for (const [name, message] of Object.entries(fieldErrors)) {
    const key = name.replace(/^buyer\./, '') as Path<F>
    if (fields.includes(key)) {
      setError(key, { type: 'server', message })
      applied = true
    }
  }
  return applied
}
