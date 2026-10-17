import { useEffect } from 'react'

/** Título da aba por página (anunciado por leitores de tela ao navegar). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
