import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/api/resources'
import { ApiError } from '@/lib/api/errors'
import { completeAuthentication } from '@/lib/auth/session'
import { safeRedirect } from '@/lib/auth/redirect'

/** Login (versão de integração da etapa 1; o formulário final vem com o layout). */
export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
    reason: z.enum(['expired', 'required']).optional().catch(undefined),
  }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const router = useRouter()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (response) => {
      await completeAuthentication(queryClient, response)
      await router.navigate({ to: safeRedirect(search.redirect), replace: true })
    },
  })
  const error = mutation.error ? ApiError.from(mutation.error) : null

  return (
    <section aria-labelledby="login-title" className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 id="login-title" className="text-2xl font-bold">
        Entrar
      </h1>
      {search.reason === 'expired' && <p role="status">Sua sessão expirou. Entre novamente para continuar.</p>}
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          mutation.mutate({ email: String(data.get('email')), password: String(data.get('password')) })
        }}
      >
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" className="h-10 rounded border border-input bg-transparent px-3" />
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="h-10 rounded border border-input bg-transparent px-3" />
        {error && <p role="alert">{error.message}</p>}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </section>
  )
}
