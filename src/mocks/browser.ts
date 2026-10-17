import { setupWorker } from 'msw/browser'
import { installControls, mockControls } from './controls'
import { handlers } from './handlers'
import { resolveScenarioId } from './scenarios'
import { socketHandlers } from './socket'

export const worker = setupWorker(...socketHandlers, ...handlers)

/**
 * Inicia o MSW antes de a aplicação fazer qualquer requisição.
 * `?mock-reset=1` restaura o banco simulado; `?scenario=<id>` seleciona o cenário.
 */
export async function startMocks(): Promise<void> {
  const params = new URLSearchParams(location.search)
  const scenarioId = resolveScenarioId()
  if (params.has('scenario') || params.has('mock-reset')) {
    if (params.get('mock-reset') === '1') mockControls.setScenario(scenarioId)
    // Cenário já persistido em localStorage: limpa a URL para não poluir os search params das rotas.
    params.delete('mock-reset')
    params.delete('scenario')
    const query = params.toString()
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`)
  }
  installControls()
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest(request, print) {
      const url = new URL(request.url)
      // Assets, fontes e o próprio Vite seguem para a rede normalmente.
      if (url.origin !== location.origin || !url.pathname.startsWith('/api')) return
      print.warning()
    },
    quiet: import.meta.env.PROD,
  })
}
