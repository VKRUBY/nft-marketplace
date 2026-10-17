import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { onAuthFailure } from '@/lib/api/client'
import { clearPrivateState } from '@/lib/auth/session'
import { notify } from '@/lib/notices'
import { queryKeys } from '@/lib/query/keys'
import { installRealtimeSync } from '@/lib/realtime/sync'
import { realtimeClient } from '@/lib/realtime/socket'
import type { Session } from '@/contracts/domain'
import { sessionStore } from '@/lib/session-store'

/**
 * Liga sessão, socket e cache:
 *  - abre o socket com o token atual e o reabre quando a sessão muda
 *    (inclusive em outra aba);
 *  - aplica eventos ao cache e reconcilia após reconexão;
 *  - em 401, encerra a sessão local e leva ao login preservando a rota atual.
 */
export function AuthBridge() {
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    const getUserId = () => queryClient.getQueryData<Session | null>(queryKeys.session)?.user.id ?? null
    const uninstall = installRealtimeSync(queryClient, getUserId)
    realtimeClient.start(sessionStore.getToken())

    let expiring = false
    const expire = (message: string) => {
      if (expiring || !sessionStore.getToken()) return
      expiring = true
      sessionStore.setToken(null)
      clearPrivateState(queryClient)
      queryClient.setQueryData(queryKeys.session, null)
      notify.warning('Sessão encerrada', message, 'session-expired')
      const { pathname, searchStr } = router.state.location
      if (pathname !== '/login') {
        void router.navigate({
          to: '/login',
          search: { redirect: `${pathname}${searchStr}`, reason: 'expired' },
          replace: true,
        })
      }
      expiring = false
    }

    const offAuth = onAuthFailure((error) => expire(error.message))
    const offRejected = realtimeClient.onRejected(() => expire('Sua sessão expirou. Faça login novamente.'))

    // Login/logout em outra aba: sincroniza identidade, cache e socket.
    const offStore = sessionStore.subscribe((token) => {
      const current = getUserId()
      if (token === null && current) {
        clearPrivateState(queryClient)
        queryClient.setQueryData(queryKeys.session, null)
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.session })
      realtimeClient.start(token)
    })

    return () => {
      offAuth()
      offRejected()
      offStore()
      uninstall()
      realtimeClient.stop()
    }
  }, [queryClient, router])

  return null
}
