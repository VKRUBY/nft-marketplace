import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { AuthBridge } from '@/app/auth-bridge'
import { NotFound } from '@/app/not-found'
import { PendingOrderBanner } from '@/app/pending-order-banner'
import { RealtimeIndicator } from '@/app/realtime-indicator'
import { RouteAnnouncer } from '@/app/route-announcer'
import { lazy, Suspense } from 'react'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Toaster } from '@/components/ui/sonner'

// Carregado à parte: só existe com a camada de mocks ligada.
const ScenarioPanel = lazy(() => import('@/app/scenario-panel').then((m) => ({ default: m.ScenarioPanel })))
const mocksOn = typeof window !== 'undefined' && Boolean(window.__greenmint)

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
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:font-bold focus:text-ink"
      >
        Pular para o conteúdo
      </a>
      <AuthBridge />
      <RouteAnnouncer />
      <SiteHeader />
      <PendingOrderBanner />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileTabBar />
      <RealtimeIndicator />
      <Toaster />
      {mocksOn && (
        <Suspense fallback={null}>
          <ScenarioPanel />
        </Suspense>
      )}
    </>
  )
}
