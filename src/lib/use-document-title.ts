import { useEffect } from 'react'

/** Título da aba por página (anunciado pelo RouteAnnouncer ao navegar). `null` não altera o título. */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (title !== null) document.title = title
  }, [title])
}
