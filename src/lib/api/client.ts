import axios, { type AxiosRequestConfig } from 'axios'
import { sessionStore } from '../session-store'
import { ApiError } from './errors'

export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
export const HTTP_TIMEOUT_MS = Number(import.meta.env.VITE_HTTP_TIMEOUT_MS ?? 10_000)

/**
 * Único cliente HTTP da aplicação. Responsabilidades:
 *  - anexar `Authorization` e `X-Guest-Cart`;
 *  - normalizar qualquer falha em `ApiError`;
 *  - avisar a camada de sessão quando a API recusar o token (sessão expirada).
 * Não contém respostas simuladas nem desvios de negócio.
 */
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: HTTP_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = sessionStore.getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Guest-Cart', sessionStore.getGuestCartId())
  return config
})

type AuthFailureListener = (error: ApiError) => void
const authFailureListeners = new Set<AuthFailureListener>()

/** Notificado quando uma requisição autenticada recebe 401. */
export function onAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.add(listener)
  return () => authFailureListeners.delete(listener)
}

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = ApiError.from(error)
    const sentToken = axios.isAxiosError(error) && Boolean(error.config?.headers?.Authorization)
    if (apiError.isAuthError && sentToken) {
      for (const listener of authFailureListeners) listener(apiError)
    }
    return Promise.reject(apiError)
  },
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<T>(config)
  return response.data
}
