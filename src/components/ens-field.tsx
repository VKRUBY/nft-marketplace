import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Field } from '@/components/form-field'
import { Input } from '@/components/ui/input'

/**
 * "Nome ENS": o Figma mostra um seletor ".eth", mas ENS só tem esse sufixo —
 * o sufixo fica fixo e só o nome é editável (decisão registrada em ARCHITECTURE.md).
 */
export function EnsField({ form }: { form: { register: UseFormRegister<{ ensName?: string | null }>; formState: { errors: FieldErrors<{ ensName?: string | null }> } } }) {
  return (
    <Field label="Nome ENS (opcional)" error={form.formState.errors.ensName?.message} hint="Apenas o nome; o sufixo .eth é fixo.">
      {(p) => (
        <div className="flex gap-2.5">
          <span aria-hidden className="grid h-10 shrink-0 place-items-center rounded-sm border border-field px-3 text-base">
            .eth
          </span>
          <Input {...p} {...form.register('ensName')} spellCheck={false} autoCapitalize="none" />
        </div>
      )}
    </Field>
  )
}
