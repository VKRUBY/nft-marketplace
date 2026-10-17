/**
 * Ponto de entrada.
 *
 * A camada de mocks é ativada por configuração (`VITE_ENABLE_MOCKS`, padrão
 * ligado — inclusive no build de demonstração) e precisa iniciar ANTES de a
 * aplicação ser importada: o engine.io-client (usado pelo socket.io-client)
 * guarda a referência de `globalThis.WebSocket` no momento do import. Se o
 * app fosse carregado antes, o socket usaria o WebSocket original e o MSW
 * não conseguiria interceptar a conexão. Por isso o app é importado
 * dinamicamente depois de `startMocks()`.
 */
async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { renderApp } = await import('./app/render')
  renderApp(document.getElementById('root')!)
}

void bootstrap()
