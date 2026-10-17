import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPage } from '@/features/account/favorites-page'

export const Route = createFileRoute('/_auth/perfil/interesses')({
  component: FavoritesPage,
})
