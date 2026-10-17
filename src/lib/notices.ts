import { useSyncExternalStore } from 'react'

/**
 * Fila de avisos para o usuário (toasts + região aria-live). Usada para
 * resultados de mutations e para mudanças recebidas em tempo real.
 */
export type NoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface Notice {
  id: string
  tone: NoticeTone
  title: string
  description?: string
  /** Avisos com a mesma chave substituem o anterior em vez de empilhar. */
  dedupeKey?: string
  createdAt: number
}

type Listener = () => void
let notices: Notice[] = []
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

export const noticeStore = {
  push(notice: Omit<Notice, 'id' | 'createdAt'>): string {
    const id = crypto.randomUUID()
    const next: Notice = { ...notice, id, createdAt: Date.now() }
    notices = [
      ...notices.filter((n) => !notice.dedupeKey || n.dedupeKey !== notice.dedupeKey),
      next,
    ].slice(-5)
    emit()
    return id
  },
  dismiss(id: string) {
    notices = notices.filter((n) => n.id !== id)
    emit()
  },
  clear() {
    notices = []
    emit()
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get: () => notices,
}

export function useNotices(): Notice[] {
  return useSyncExternalStore(noticeStore.subscribe, noticeStore.get, noticeStore.get)
}

export const notify = {
  success: (title: string, description?: string, dedupeKey?: string) =>
    noticeStore.push({ tone: 'success', title, description, dedupeKey }),
  info: (title: string, description?: string, dedupeKey?: string) =>
    noticeStore.push({ tone: 'info', title, description, dedupeKey }),
  warning: (title: string, description?: string, dedupeKey?: string) =>
    noticeStore.push({ tone: 'warning', title, description, dedupeKey }),
  error: (title: string, description?: string, dedupeKey?: string) =>
    noticeStore.push({ tone: 'error', title, description, dedupeKey }),
}
