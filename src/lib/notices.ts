import { toast } from 'sonner'

/**
 * Avisos ao usuário (toasts do sonner, anunciados por leitores de tela via
 * região aria-live). Usado para resultados de mutations e para mudanças
 * recebidas em tempo real. `dedupeKey` substitui o aviso anterior com a
 * mesma chave em vez de empilhar.
 */
type Notify = (title: string, description?: string, dedupeKey?: string) => string | number

const make =
  (kind: 'success' | 'info' | 'warning' | 'error'): Notify =>
  (title, description, dedupeKey) =>
    toast[kind](title, {
      description,
      id: dedupeKey,
      duration: kind === 'error' || kind === 'warning' ? 7000 : 4000,
    })

export const notify = {
  success: make('success'),
  info: make('info'),
  warning: make('warning'),
  error: make('error'),
  dismiss: (id?: string | number) => toast.dismiss(id),
}
