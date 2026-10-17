/**
 * Cenários determinísticos da camada de mocks.
 *
 * Seleção (em ordem de prioridade):
 *  1. `?scenario=<id>` na URL (persistido em localStorage para sobreviver a refresh);
 *  2. `localStorage['greenmint:scenario']`;
 *  3. `VITE_MOCK_SCENARIO` no build;
 *  4. `default`.
 * `?mock-reset=1` restaura o banco simulado ao estado inicial conhecido.
 */

export type FailureMode = 'network' | 'timeout' | number

export interface FailureRule {
  /** Método HTTP (padrão: qualquer). */
  method?: string
  /** Expressão regular aplicada ao pathname. */
  path: string
  mode: FailureMode
  /** Quantas vezes falha antes de voltar ao normal (padrão: sempre). */
  times?: number
}

export interface ScenarioConfig {
  id: string
  label: string
  description: string
  /** Latência em ms; sorteada de forma determinística no intervalo. */
  latency: { min: number; max: number }
  /** Requisições ímpares à listagem demoram mais que as pares (respostas fora de ordem). */
  outOfOrder: boolean
  /** Toda requisição falha como erro de rede. */
  offline: boolean
  failures: FailureRule[]
  /** Duração da sessão após login. */
  sessionTtlMs: number
  /** Rotas /me/* respondem 403. */
  forbidden: boolean
  /** Catálogo começa vazio. */
  emptyCatalog: boolean
  payment: {
    outcome: 'confirm' | 'decline'
    /** Tempo até o pedido sair de `pending`. */
    delayMs: number
  }
  /** Primeira criação de pedido responde só depois do timeout do cliente. */
  orderCreateTimeout: boolean
  /** Ms após a primeira cotação em que o preço de um item do carrinho sobe. */
  priceChangeAfterQuoteMs: number | null
  /** A edição do primeiro item esgota no momento da criação do pedido. */
  soldOutOnOrder: boolean
  /** A conexão da carteira é recusada. */
  walletRejects: boolean
  realtime: {
    /** Reenvia cada evento uma segunda vez. */
    duplicateEvents: boolean
    /** Após cada evento, envia uma versão anterior do mesmo recurso. */
    staleEvents: boolean
  }
}

const base: ScenarioConfig = {
  id: 'default',
  label: 'Padrão',
  description: 'Latência realista, pagamentos confirmados em ~3 s.',
  latency: { min: 120, max: 450 },
  outOfOrder: false,
  offline: false,
  failures: [],
  sessionTtlMs: 2 * 60 * 60 * 1000,
  forbidden: false,
  emptyCatalog: false,
  payment: { outcome: 'confirm', delayMs: 3000 },
  orderCreateTimeout: false,
  priceChangeAfterQuoteMs: null,
  soldOutOnOrder: false,
  walletRejects: false,
  realtime: { duplicateEvents: false, staleEvents: false },
}

const define = (overrides: Partial<ScenarioConfig> & Pick<ScenarioConfig, 'id' | 'label' | 'description'>) =>
  ({ ...base, ...overrides }) satisfies ScenarioConfig

export const SCENARIOS: ScenarioConfig[] = [
  base,
  define({
    id: 'fast',
    label: 'Rápido (testes)',
    description: 'Sem latência e pagamento confirmado em 500 ms.',
    latency: { min: 0, max: 0 },
    payment: { outcome: 'confirm', delayMs: 500 },
  }),
  define({
    id: 'slow',
    label: 'Rede lenta',
    description: 'Respostas entre 2 e 3,5 s para observar skeletons.',
    latency: { min: 2000, max: 3500 },
  }),
  define({
    id: 'variable',
    label: 'Latência variável',
    description: 'Respostas entre 50 ms e 2,5 s.',
    latency: { min: 50, max: 2500 },
  }),
  define({
    id: 'out-of-order',
    label: 'Respostas fora de ordem',
    description: 'Na listagem, requisições ímpares demoram 1,8 s e pares 200 ms.',
    outOfOrder: true,
  }),
  define({
    id: 'empty',
    label: 'Catálogo vazio',
    description: 'Nenhum NFT cadastrado.',
    emptyCatalog: true,
  }),
  define({
    id: 'offline',
    label: 'Sem conexão',
    description: 'Toda requisição falha como erro de rede.',
    offline: true,
  }),
  define({
    id: 'flaky',
    label: 'Falha transitória',
    description: 'A primeira chamada à listagem e ao detalhe responde 503; a nova tentativa funciona.',
    failures: [
      { method: 'GET', path: '^/api/nfts$', mode: 503, times: 1 },
      { method: 'GET', path: '^/api/nfts/[^/]+$', mode: 503, times: 1 },
    ],
  }),
  define({
    id: 'server-error',
    label: 'Erro 500 na listagem',
    description: 'GET /nfts responde 500 até o cenário mudar.',
    failures: [{ method: 'GET', path: '^/api/nfts$', mode: 500 }],
  }),
  define({
    id: 'favorite-fails',
    label: 'Falha ao favoritar',
    description: 'A primeira inclusão/remoção de favorito responde 503 (rollback otimista).',
    failures: [{ method: 'PUT|DELETE', path: '^/api/me/favorites/', mode: 503, times: 1 }],
  }),
  define({
    id: 'session-expired',
    label: 'Sessão curta',
    description: 'A sessão expira 45 s após o login.',
    sessionTtlMs: 45_000,
  }),
  define({
    id: 'forbidden',
    label: 'Acesso negado',
    description: 'Rotas /me/* respondem 403.',
    forbidden: true,
  }),
  define({
    id: 'price-change',
    label: 'Preço muda no checkout',
    description: 'O preço do primeiro item do carrinho sobe 3 s após a primeira cotação.',
    priceChangeAfterQuoteMs: 3000,
  }),
  define({
    id: 'sold-out',
    label: 'Edição esgota na compra',
    description: 'A edição do primeiro item esgota no momento do envio do pedido.',
    soldOutOnOrder: true,
  }),
  define({
    id: 'order-timeout',
    label: 'Timeout após criar pedido',
    description: 'O pedido é criado, mas a primeira resposta chega depois do timeout do cliente.',
    orderCreateTimeout: true,
  }),
  define({
    id: 'payment-declined',
    label: 'Pagamento recusado',
    description: 'Todo pedido termina recusado.',
    payment: { outcome: 'decline', delayMs: 3000 },
  }),
  define({
    id: 'slow-payment',
    label: 'Pagamento demorado',
    description: 'O pedido fica pendente por 20 s (para testar refresh e reconexão).',
    payment: { outcome: 'confirm', delayMs: 20_000 },
  }),
  define({
    id: 'wallet-rejected',
    label: 'Carteira recusa conexão',
    description: 'Toda tentativa de conectar a carteira é recusada.',
    walletRejects: true,
  }),
  define({
    id: 'realtime-chaos',
    label: 'Eventos duplicados e antigos',
    description: 'Cada evento é reenviado e seguido de uma versão antiga.',
    realtime: { duplicateEvents: true, staleEvents: true },
  }),
]

const STORAGE_KEY = 'greenmint:scenario'
const OVERRIDES_KEY = 'greenmint:scenario-overrides'

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function resolveScenarioId(): string {
  const storage = safeStorage()
  const fromUrl = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('scenario') : null
  if (fromUrl && SCENARIOS.some((s) => s.id === fromUrl)) {
    storage?.setItem(STORAGE_KEY, fromUrl)
    return fromUrl
  }
  const stored = storage?.getItem(STORAGE_KEY)
  if (stored && SCENARIOS.some((s) => s.id === stored)) return stored
  const fromEnv = import.meta.env.VITE_MOCK_SCENARIO as string | undefined
  if (fromEnv && SCENARIOS.some((s) => s.id === fromEnv)) return fromEnv
  return 'default'
}

let current: ScenarioConfig = loadScenario(resolveScenarioId())

function loadScenario(id: string): ScenarioConfig {
  const scenario = SCENARIOS.find((s) => s.id === id) ?? base
  const raw = safeStorage()?.getItem(OVERRIDES_KEY)
  if (!raw) return structuredClone(scenario)
  try {
    return { ...structuredClone(scenario), ...(JSON.parse(raw) as Partial<ScenarioConfig>), id: scenario.id }
  } catch {
    return structuredClone(scenario)
  }
}

export function getScenario(): ScenarioConfig {
  return current
}

/** Troca o cenário ativo; `overrides` permite ajustes finos (persistidos) para testes. */
export function setScenario(id: string, overrides?: Partial<ScenarioConfig>): ScenarioConfig {
  const storage = safeStorage()
  storage?.setItem(STORAGE_KEY, id)
  if (overrides) storage?.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
  else storage?.removeItem(OVERRIDES_KEY)
  current = loadScenario(id)
  failureCounters.clear()
  return current
}

/** Contagem de falhas já aplicadas por regra (para `times`). */
export const failureCounters = new Map<FailureRule, number>()
