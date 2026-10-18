import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

/**
 * Navegação client-side acessível: ao mudar de página (pathname), move o
 * foco para o conteúdo principal e anuncia o título da nova página.
 * Mudanças só de search params (filtros, paginação) não roubam o foco —
 * o catálogo trata isso no próprio componente. Rotas que abrem diálogo
 * (login/cadastro) deixam o foco com o diálogo.
 */
export function RouteAnnouncer() {
  const router = useRouter()
  const [message, setMessage] = useState('')

  useEffect(() => {
    return router.subscribe('onResolved', ({ fromLocation, toLocation, pathChanged }) => {
      if (!fromLocation || !pathChanged) return
      if (/^\/(login|cadastro)$/.test(toLocation.pathname)) return
      // Aguarda o título da página ser atualizado pelo componente da rota.
      requestAnimationFrame(() =>
        setTimeout(() => {
          const main = document.getElementById('conteudo')
          if (main && (!main.contains(document.activeElement) || document.activeElement === document.body)) {
            main.focus({ preventScroll: true })
          }
          setMessage(document.title.replace(/ — Kurio$/, ''))
        }, 60),
      )
    })
  }, [router])

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}
