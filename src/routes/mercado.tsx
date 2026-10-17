import { createFileRoute, redirect } from '@tanstack/react-router'

/** "Mercado" não tem frame próprio: leva ao catálogo do Início. */
export const Route = createFileRoute('/mercado')({
  beforeLoad: () => {
    throw redirect({ to: '/', hash: 'catalogo', replace: true })
  },
})
