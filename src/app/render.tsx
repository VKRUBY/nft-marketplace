import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, parseSearchWith, RouterProvider, stringifySearchWith } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createQueryClient } from '@/lib/query/client'
import { routeTree } from '@/routeTree.gen'
import '@/index.css'

const queryClient = createQueryClient()

/**
 * Listas de filtros viram `?network=ethereum,polygon` em vez do JSON padrão
 * (`?network=%5B%22ethereum%22%5D`): links legíveis e compartilháveis. Os
 * schemas de busca aceitam tanto a lista separada por vírgula quanto array,
 * e os valores das listas são enums sem vírgula.
 */
const stringifyValue = (value: unknown) =>
  Array.isArray(value) && value.every((v) => typeof v === 'string') ? value.join(',') : JSON.stringify(value)

/**
 * O router é criado só na hora de renderizar: o módulo é baixado em paralelo
 * com os mocks (main.tsx), e a camada de mocks ajusta a URL no boot (remove
 * `?scenario`/`?mock-reset`). Criá-lo no topo do módulo leria a URL antiga.
 */
function createAppRouter() {
  return createRouter({
    routeTree,
    parseSearch: parseSearchWith(JSON.parse),
    stringifySearch: stringifySearchWith(stringifyValue, JSON.parse),
    context: { queryClient },
    defaultPreload: 'intent',
    // O TanStack Query é o cache; o router não guarda dados de loader por conta própria.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}

export function renderApp(container: HTMLElement) {
  const router = createAppRouter()
  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
