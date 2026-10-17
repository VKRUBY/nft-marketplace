/**
 * Envelope de erro único de toda a API REST.
 *
 * Status HTTP ↔ código:
 *  400 VALIDATION_ERROR (fieldErrors por campo)
 *  401 UNAUTHENTICATED | SESSION_EXPIRED | INVALID_CREDENTIALS
 *  403 FORBIDDEN
 *  404 NOT_FOUND
 *  409 EMAIL_TAKEN | USERNAME_TAKEN | AVAILABILITY_CONFLICT | QUOTE_STALE
 *      | IDEMPOTENCY_CONFLICT | WALLET_ROLE_TAKEN
 *  410 QUOTE_EXPIRED
 *  422 COUPON_INVALID | COUPON_EXPIRED | WALLET_REJECTED | INVALID_PASSWORD
 *  429 RATE_LIMITED
 *  503 TRANSIENT (retryable)
 *  500 INTERNAL
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'AVAILABILITY_CONFLICT'
  | 'QUOTE_STALE'
  | 'QUOTE_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'WALLET_ROLE_TAKEN'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'WALLET_REJECTED'
  | 'INVALID_PASSWORD'
  | 'RATE_LIMITED'
  | 'TRANSIENT'
  | 'INTERNAL'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Mensagens por campo (chave = nome do campo no payload). */
    fieldErrors?: Record<string, string>
    /** Dados extras, ex.: a cotação atualizada em QUOTE_STALE. */
    details?: unknown
    retryable: boolean
  }
}

export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  AVAILABILITY_CONFLICT: 409,
  QUOTE_STALE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  WALLET_ROLE_TAKEN: 409,
  QUOTE_EXPIRED: 410,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  WALLET_REJECTED: 422,
  INVALID_PASSWORD: 422,
  RATE_LIMITED: 429,
  TRANSIENT: 503,
  INTERNAL: 500,
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.code === 'string'
  )
}
