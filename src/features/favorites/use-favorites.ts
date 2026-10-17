import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import type { Favorites } from '@/contracts/domain'
import { ApiError } from '@/lib/api/errors'
import { favoritesApi } from '@/lib/api/resources'
import { useSession } from '@/lib/auth/session'
import { notify } from '@/lib/notices'
import { queryKeys } from '@/lib/query/keys'

/** Favoritos do usuário autenticado (persistidos na API). */
export function useFavorites() {
  const { user } = useSession()
  const query = useQuery({
    queryKey: queryKeys.private.favorites(user?.id ?? 'anon'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: Boolean(user),
  })
  const ids = new Set(query.data?.nftIds ?? [])
  return { ...query, isFavorite: (nftId: string) => ids.has(nftId), ids }
}

/**
 * Alterna favorito com atualização otimista: o coração muda na hora, a
 * mutation confirma no servidor e, se falhar, o cache volta ao estado
 * anterior e o usuário é avisado. Visitante é levado ao login e volta à
 * mesma página depois.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user } = useSession()

  const mutation = useMutation({
    mutationKey: ['favorite-toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      const key = queryKeys.private.favorites(user!.id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Favorites>(key)
      queryClient.setQueryData<Favorites>(key, (current) => {
        const set = new Set(current?.nftIds ?? [])
        if (favorite) set.add(nftId)
        else set.delete(nftId)
        return { nftIds: [...set] }
      })
      return { previous, key }
    },
    onError: (error, { favorite, name }, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
      const apiError = ApiError.from(error)
      if (apiError.isAuthError) return
      notify.error(
        favorite ? `Não foi possível favoritar ${name}` : `Não foi possível remover ${name} dos favoritos`,
        `${apiError.message} O estado anterior foi restaurado.`,
        `fav:${name}`,
      )
    },
    onSuccess: (data, { favorite, name }, context) => {
      queryClient.setQueryData(context.key, data)
      notify.success(favorite ? `${name} adicionado à lista de interesse` : `${name} removido da lista de interesse`, undefined, `fav:${name}`)
    },
    onSettled: (_d, _e, _v, context) => {
      if (context) void queryClient.invalidateQueries({ queryKey: context.key })
    },
  })

  return {
    ...mutation,
    toggle(nftId: string, name: string, favorite: boolean) {
      if (!user) {
        const { pathname, searchStr } = router.state.location
        void router.navigate({ to: '/login', search: { redirect: `${pathname}${searchStr}`, reason: 'required' } })
        return
      }
      mutation.mutate({ nftId, favorite, name })
    },
  }
}
