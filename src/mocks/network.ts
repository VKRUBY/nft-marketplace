import { delay, HttpResponse } from 'msw'
import { createRng } from './rng'
import { failureCounters, getScenario, type FailureRule } from './scenarios'

/**
 * Condições de rede simuladas, aplicadas antes de qualquer handler:
 * offline, falhas por rota (HTTP, erro de rede, timeout), latência
 * determinística e respostas fora de ordem.
 */

/** Timeout do cliente Axios; o cenário de timeout responde depois dele. */
export const CLIENT_TIMEOUT_MS = Number(import.meta.env.VITE_HTTP_TIMEOUT_MS ?? 10_000)

let listSeq = 0
const rng = createRng(42)

export function resetNetworkState(): void {
  listSeq = 0
}

function matches(rule: FailureRule, method: string, pathname: string): boolean {
  if (rule.method && !new RegExp(`^(${rule.method})$`, 'i').test(method)) return false
  return new RegExp(rule.path).test(pathname)
}

function failureBody(status: number) {
  const transient = status >= 500
  return {
    error: {
      code: status === 503 ? 'TRANSIENT' : transient ? 'INTERNAL' : 'VALIDATION_ERROR',
      message:
        status === 503
          ? 'Serviço temporariamente indisponível. Tente novamente.'
          : transient
            ? 'Erro inesperado no servidor.'
            : 'Requisição recusada.',
      retryable: transient,
    },
  }
}

/**
 * Retorna uma resposta de falha se o cenário mandar, ou `null` para seguir.
 * Também aplica a latência sorteada.
 */
export async function applyNetworkConditions(request: Request): Promise<Response | null> {
  const scenario = getScenario()
  const url = new URL(request.url)

  if (scenario.offline) return HttpResponse.error()

  for (const rule of scenario.failures) {
    if (!matches(rule, request.method, url.pathname)) continue
    const used = failureCounters.get(rule) ?? 0
    if (rule.times !== undefined && used >= rule.times) continue
    failureCounters.set(rule, used + 1)
    if (rule.mode === 'network') return HttpResponse.error()
    if (rule.mode === 'timeout') {
      await delay(CLIENT_TIMEOUT_MS + 5_000)
      return HttpResponse.error()
    }
    await delay(scenario.latency.min)
    return HttpResponse.json(failureBody(rule.mode), { status: rule.mode })
  }

  let ms = scenario.latency.min + Math.round(rng.next() * (scenario.latency.max - scenario.latency.min))
  if (scenario.outOfOrder && request.method === 'GET' && url.pathname.endsWith('/nfts')) {
    listSeq++
    ms = listSeq % 2 === 1 ? 1800 : 200
  }
  if (ms > 0) await delay(ms)
  return null
}
