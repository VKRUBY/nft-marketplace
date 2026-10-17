import { ERROR_STATUS, type ApiErrorBody, type ApiErrorCode } from '@/contracts/errors'

const RETRYABLE: ApiErrorCode[] = ['TRANSIENT', 'RATE_LIMITED', 'INTERNAL']

/** Erro de domínio lançado pelos serviços simulados e convertido no envelope REST. */
export class MockApiError extends Error {
  readonly code: ApiErrorCode
  readonly fieldErrors?: Record<string, string>
  readonly details?: unknown

  constructor(code: ApiErrorCode, message: string, fieldErrors?: Record<string, string>, details?: unknown) {
    super(message)
    this.code = code
    this.fieldErrors = fieldErrors
    this.details = details
  }

  get status(): number {
    return ERROR_STATUS[this.code]
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
        ...(this.details !== undefined ? { details: this.details } : {}),
        retryable: RETRYABLE.includes(this.code),
      },
    }
  }
}
