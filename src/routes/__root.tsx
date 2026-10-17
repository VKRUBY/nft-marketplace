import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { AuthBridge } from '@/app/auth-bridge'
import { NotFound } from '@/app/not-found'
import { RealtimeIndicator } from '@/app/realtime-indicator'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => <NotFound />,
})

function RootLayout() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <AuthBridge />
      <header className="border-b border-border">
        <nav aria-label="Principal" className="mx-auto flex max-w-[1200px] items-center gap-6 px-4 py-4">
          <Link to="/" className="font-bold">
            GreenMint
          </Link>
          <Link to="/login">Entrar</Link>
          <RealtimeIndicator />
        </nav>
      </header>
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-[1200px] px-4 py-8 outline-none">
        <Outlet />
      </main>
    </>
  )
}
