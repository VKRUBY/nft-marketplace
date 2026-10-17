import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'
import type { AuthResponse, Session } from '@/contracts/domain'
import { ApiError } from '../api/errors'
import { authApi, cartApi } from '../api/resources'
import { queryKeys } from '../query/keys'
import { forgetPrivateVersions } from '../realtime/versions'
import { sessionStore } from '../session-store'

/**
 * Política de sessão:
 *  - o token persiste em localStorage; no boot, GET /auth/session valida e
 *    recupera o usuário (sobrevive a refresh);
 *  - 401 em qualquer chamada autenticada encerra a sessão local e leva ao
 *    login com `redirect` para retomar o fluxo (ver AuthBridge);
 *  - login/troca de usuário: mescla o carrinho do visitante e remove o cache
 *    privado do usuário anterior; o AuthBridge reabre o socket ao ver o novo token;
 *  - logout: avisa a API, limpa token, cache privado, carrinho e socket.
 */

export const sessionQuery = queryOptions({
  queryKey: queryKeys.session,
  queryFn: async ({ signal }): Promise<Session | null> => {
    if (!sessionStore.getToken()) return null
    try {
      return await authApi.session({ signal })
    } catch (error) {
      const apiError = ApiError.from(error)
      if (apiError.isAuthError) {
        sessionStore.setToken(null)
        return null
      }
      throw apiError
    }
  },
  staleTime: 60_000,
  retry: (count, error) => count < 2 && ApiError.from(error).retryable,
})

export function useSession() {
  const query = useQuery(sessionQuery)
  return { session: query.data ?? null, user: query.data?.user ?? null, ...query }
}

/** Remove tudo que pertence à sessão anterior: cache privado, carrinho e versões de pedidos. */
export function clearPrivateState(queryClient: QueryClient): void {
  void queryClient.cancelQueries({ queryKey: queryKeys.private.all })
  queryClient.removeQueries({ queryKey: queryKeys.private.all })
  queryClient.removeQueries({ queryKey: queryKeys.cart.all })
  forgetPrivateVersions()
}

export async function completeAuthentication(queryClient: QueryClient, response: AuthResponse): Promise<void> {
  const previousUserId = queryClient.getQueryData<Session | null>(queryKeys.session)?.user.id ?? null
  const guestCartId = sessionStore.getGuestCartId()
  clearPrivateState(queryClient)
  sessionStore.setToken(response.token)
  queryClient.setQueryData(queryKeys.session, response.session)
  // Itens do visitante passam para a conta; falha aqui não impede o login.
  if (previousUserId === null) {
    try {
      await cartApi.merge(guestCartId)
      sessionStore.rotateGuestCartId()
    } catch {
      /* o carrinho do visitante continua disponível para nova tentativa */
    }
  }
  await queryClient.invalidateQueries({ queryKey: queryKeys.cart.all })
}

export async function signOut(queryClient: QueryClient, { callApi = true } = {}): Promise<void> {
  if (callApi && sessionStore.getToken()) {
    try {
      await authApi.logout()
    } catch {
      /* o logout local acontece de qualquer forma */
    }
  }
  sessionStore.setToken(null)
  clearPrivateState(queryClient)
  queryClient.setQueryData(queryKeys.session, null)
}
