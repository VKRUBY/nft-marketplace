import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth/session'

/** Perfil (versão de integração da etapa 1). */
export const Route = createFileRoute('/_auth/perfil')({
  component: ProfilePage,
})

function ProfilePage() {
  const { session } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const router = useRouter()
  return (
    <section aria-labelledby="profile-title" className="flex flex-col gap-4">
      <h1 id="profile-title" className="text-2xl font-bold">
        {session.user.name}
      </h1>
      <p>{session.user.email}</p>
      <Button
        variant="outline"
        className="self-start"
        onClick={async () => {
          await signOut(queryClient)
          await router.navigate({ to: '/' })
        }}
      >
        Sair
      </Button>
    </section>
  )
}
