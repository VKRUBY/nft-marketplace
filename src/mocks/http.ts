import { HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { z } from 'zod'
import { toFieldErrors } from '@/contracts/schemas'
import { MockApiError } from './errors'
import { applyNetworkConditions } from './network'
import { getScenario } from './scenarios'
import { optionalSession, requireSession } from './services/auth'
import type { CartOwner } from './services/cart'

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

/** Caminho completo para o handler MSW (aceita base relativa ou absoluta). */
export function apiPath(path: string): string {
  if (/^https?:\/\//.test(API_BASE)) return `${API_BASE}${path}`
  // Ancorado na origem: um curinga solto (`*/api/*`) capturaria arquivos como /src/lib/api/*.ts.
  const origin = typeof location === 'undefined' ? '' : location.origin
  return `${origin}${API_BASE}${path}`
}

export interface RouteContext<P extends PathParams> {
  request: Request
  params: P
  userId: () => string
  owner: () => CartOwner
  body: <S extends z.ZodType>(schema: S) => Promise<z.infer<S>>
}

/**
 * Envolve um handler: aplica condições de rede, converte erros de domínio no
 * envelope padrão e oferece utilitários de sessão e validação.
 */
export function route<P extends PathParams = PathParams>(
  handler: (ctx: RouteContext<P>) => Promise<Response> | Response,
  options: { private?: boolean } = {},
): HttpResponseResolver<P, DefaultBodyType> {
  return async ({ request, params }) => {
    const failure = await applyNetworkConditions(request)
    if (failure) return failure
    try {
      const authorization = request.headers.get('authorization')
      if (options.private) {
        requireSession(authorization)
        if (getScenario().forbidden) {
          throw new MockApiError('FORBIDDEN', 'Você não tem permissão para acessar este recurso.')
        }
      }
      const ctx: RouteContext<P> = {
        request,
        params: params as P,
        userId: () => requireSession(authorization).userId,
        owner: () => {
          const session = optionalSession(authorization)
          if (session) return { kind: 'user', userId: session.userId }
          const guestId = request.headers.get('x-guest-cart')
          if (!guestId || !/^[\w-]{8,64}$/.test(guestId)) {
            throw new MockApiError('VALIDATION_ERROR', 'Cabeçalho X-Guest-Cart ausente ou inválido.')
          }
          return { kind: 'guest', guestId }
        },
        body: async (schema) => {
          let raw: unknown
          try {
            raw = await request.clone().json()
          } catch {
            throw new MockApiError('VALIDATION_ERROR', 'Corpo da requisição inválido.')
          }
          const parsed = schema.safeParse(raw)
          if (!parsed.success) {
            throw new MockApiError('VALIDATION_ERROR', 'Verifique os campos destacados.', toFieldErrors(parsed.error))
          }
          return parsed.data
        },
      }
      return await handler(ctx)
    } catch (error) {
      if (error instanceof MockApiError) {
        return HttpResponse.json(error.toBody(), { status: error.status })
      }
      console.error('[mock] erro inesperado', error)
      return HttpResponse.json(
        { error: { code: 'INTERNAL', message: 'Erro inesperado no servidor simulado.', retryable: true } },
        { status: 500 },
      )
    }
  }
}

export const json = <T extends DefaultBodyType>(data: T, status = 200) => HttpResponse.json(data, { status })
export const noContent = () => new HttpResponse(null, { status: 204 })
