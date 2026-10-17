import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router'
import { AuthBridge } from '@/app/auth-bridge'
import { NotFound } from '@/app/not-found'
import { RealtimeIndicator } from '@/app/realtime-indicator'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Toaster } from '@/components/ui/sonner'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: 'Kurio — Marketplace de NFTs' }] }),
  component: RootLayout,
  notFoundComponent: () => <NotFound />,
})

function RootLayout() {
  return (
    <>
      <HeadContent />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:font-bold focus:text-ink"
      >
        Pular para o conteúdo
      </a>
      <AuthBridge />
      <SiteHeader />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileTabBar />
      <RealtimeIndicator />
      <Toaster />
    </>
  )
}
