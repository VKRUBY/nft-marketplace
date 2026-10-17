import { isAxiosError } from 'axios'
import { isApiErrorBody, type ApiErrorCode } from '@/contracts/errors'

/**
 * Erro normalizado de qualquer chamada REST. A UI e o TanStack Query só
 * lidam com esta forma — nunca com AxiosError cru.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELED'
  readonly fieldErrors: Record<string, string>
  readonly details: unknown
  readonly retryable: boolean

  constructor(init: {
    status: number
    code: ApiError['code']
    message: string
    fieldErrors?: Record<string, string>
    details?: unknown
    retryable: boolean
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors ?? {}
    this.details = init.details
    this.retryable = init.retryable
  }

  get isAuthError(): boolean {
    return this.code === 'UNAUTHENTICATED' || this.code === 'SESSION_EXPIRED'
  }

  get isConnectivity(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT'
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error
    if (isAxiosError(error)) {
      if (error.code === 'ERR_CANCELED') {
        return new ApiError({ status: 0, code: 'CANCELED', message: 'Requisição cancelada.', retryable: false })
      }
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return new ApiError({
          status: 0,
          code: 'TIMEOUT',
          message: 'O servidor demorou para responder. Verifique sua conexão e tente novamente.',
          retryable: true,
        })
      }
      const data = error.response?.data
      if (error.response && isApiErrorBody(data)) {
        return new ApiError({ status: error.response.status, ...data.error })
      }
      if (!error.response) {
        return new ApiError({
          status: 0,
          code: 'NETWORK_ERROR',
          message: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
          retryable: true,
        })
      }
      return new ApiError({
        status: error.response.status,
        code: error.response.status >= 500 ? 'INTERNAL' : 'VALIDATION_ERROR',
        message: 'Não foi possível concluir a operação.',
        retryable: error.response.status >= 500,
      })
    }
    return new ApiError({
      status: 0,
      code: 'INTERNAL',
      message: error instanceof Error ? error.message : 'Erro inesperado.',
      retryable: false,
    })
  }
}
