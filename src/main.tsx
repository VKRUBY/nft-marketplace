/**
 * Ponto de entrada.
 *
 * A camada de mocks é ativada por configuração (`VITE_ENABLE_MOCKS`, padrão
 * ligado — inclusive no build de demonstração) e precisa estar ativa antes de
 * o app RENDERIZAR (primeiras requisições) e antes de o socket abrir. Os dois
 * chunks são baixados em paralelo: o app não captura `WebSocket` no import
 * (o socket.io-client é carregado sob demanda em lib/realtime/socket.ts),
 * então basta adiar o `renderApp` até `startMocks()` terminar.
 *
 * Renderizar antes de os mocks ficarem prontos (e segurar só as requisições)
 * foi medido e piora o Lighthouse mobile: a avaliação do MSW vira uma tarefa
 * longa depois do primeiro paint e aumenta o TBT sem adiantar o LCP, que
 * depende dos dados. Ver ARCHITECTURE.md › Performance.
 */
async function bootstrap() {
  const app = import('./app/render')
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { renderApp } = await app
  renderApp(document.getElementById('root')!)
}

void bootstrap()
