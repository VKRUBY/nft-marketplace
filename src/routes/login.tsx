import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { AuthDialog } from '@/features/auth/auth-dialog'
import { HomePage } from '@/features/catalog/home-page'
import { safeRedirect } from '@/lib/auth/redirect'
import { sessionQuery } from '@/lib/auth/session'
import { useDocumentTitle } from '@/lib/use-document-title'

export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(['expired', 'required']).optional().catch(undefined),
})

/** Login: modal sobre o Início (frame Desktop / Login). Usuário já logado volta ao destino. */
export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (session) throw redirect({ to: safeRedirect(search.redirect), replace: true })
  },
  component: function LoginRoute() {
    useDocumentTitle('Entrar — Kurio')
    const search = Route.useSearch()
    return (
      <>
        <div aria-hidden inert>
          <HomePage search={{}} title={false} />
        </div>
        <AuthDialog mode="login" search={search} />
      </>
    )
  },
})
