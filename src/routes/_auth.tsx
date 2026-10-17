import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { sessionQuery } from '@/lib/auth/session'

/**
 * Layout sem caminho que protege as rotas privadas (checkout, perfil,
 * carteiras, pedidos). Sem sessão válida → login com `redirect` para voltar
 * exatamente à URL pedida (inclusive search params).
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href, reason: 'required' },
        replace: true,
      })
    }
    return { session }
  },
  component: Outlet,
})
