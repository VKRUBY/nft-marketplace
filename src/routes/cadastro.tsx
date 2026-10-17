import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthDialog } from '@/features/auth/auth-dialog'
import { HomePage } from '@/features/catalog/home-page'
import { safeRedirect } from '@/lib/auth/redirect'
import { sessionQuery } from '@/lib/auth/session'
import { useDocumentTitle } from '@/lib/use-document-title'
import { authSearchSchema } from './login'

/** Cadastro: modal sobre o Início (frame Desktop / Cadastro). */
export const Route = createFileRoute('/cadastro')({
  validateSearch: authSearchSchema,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (session) throw redirect({ to: safeRedirect(search.redirect), replace: true })
  },
  component: function RegisterRoute() {
    useDocumentTitle('Criar conta — Kurio')
    const search = Route.useSearch()
    return (
      <>
        <div aria-hidden inert>
          <HomePage search={{}} />
        </div>
        <AuthDialog mode="register" search={search} />
      </>
    )
  },
})
