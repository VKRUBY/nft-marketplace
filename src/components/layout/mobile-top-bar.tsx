import { useRouter } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Cabeçalho mobile das telas internas: voltar + título (frames Mobile). */
export function MobileTopBar({ title, action }: { title?: string; action?: ReactNode }) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-4 pt-4 pb-3 md:hidden">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: '/' }))}
        className="grid size-9 place-items-center rounded-full bg-surface text-cream"
        aria-label="Voltar"
      >
        <ChevronLeftIcon className="size-5" aria-hidden />
      </button>
      {title && <h1 className="flex-1 text-center text-xl font-bold pr-9">{title}</h1>}
      {action}
    </div>
  )
}
