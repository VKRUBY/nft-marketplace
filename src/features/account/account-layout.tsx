import { useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import {
  ActivityIcon,
  AlertTriangleIcon,
  DownloadIcon,
  HeartIcon,
  LogOutIcon,
  MapPinIcon,
  ShoppingCartIcon,
  UserIcon,
} from 'lucide-react'
import { signOut } from '@/lib/auth/session'
import { notify } from '@/lib/notices'
import { cn } from '@/lib/utils'

const ITEMS = [
  { label: 'Dados do perfil', to: '/perfil', icon: UserIcon, exact: true },
  { label: 'Carteiras', to: '/perfil/carteiras', icon: MapPinIcon },
  { label: 'Atividade', to: '/em-breve/$secao', params: { secao: 'atividade' }, icon: ShoppingCartIcon },
  { label: 'Lista de interesse', to: '/perfil/interesses', icon: HeartIcon },
  { label: 'Ofertas', to: '/em-breve/$secao', params: { secao: 'ofertas' }, icon: ActivityIcon },
  { label: 'Arquivos baixados', to: '/em-breve/$secao', params: { secao: 'downloads' }, icon: DownloadIcon },
  { label: 'Suporte', to: '/em-breve/$secao', params: { secao: 'suporte' }, icon: AlertTriangleIcon },
] as const

/** Área "Meu perfil" (frames Perfil do Colecionador e Carteiras). */
export function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const queryClient = useQueryClient()
  const router = useRouter()

  return (
    <div className="container-page grid gap-8 pt-6 pb-10 md:grid-cols-[220px_1fr] md:pt-8 lg:grid-cols-[310px_1fr] lg:gap-7">
      <nav aria-label="Meu perfil" className="self-start bg-surface pt-6 pb-3 max-md:-mx-4 max-md:overflow-x-auto max-md:pt-3 max-md:pb-0">
        <h2 className="mb-2 px-2.5 text-xl font-bold max-md:sr-only">Meu perfil</h2>
        <ul className="flex md:flex-col">
          {ITEMS.map((item) => {
            const href = 'params' in item ? `/em-breve/${item.params.secao}` : item.to
            const active = 'exact' in item && item.exact ? pathname === href || pathname === `${href}/` : pathname.startsWith(href)
            const Icon = item.icon
            return (
              <li key={item.label} className="shrink-0">
                <Link
                  to={item.to}
                  params={'params' in item ? item.params : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 border-l-[6px] border-transparent px-2.5 py-3 text-base whitespace-nowrap text-accent-strong hover:bg-band max-md:border-b-2 max-md:border-l-0',
                    active && 'border-accent text-accent-strong',
                  )}
                >
                  <Icon className="size-5 text-sand" aria-hidden />
                  {item.label}
                </Link>
              </li>
            )
          })}
          <li className="shrink-0 md:mt-1 md:border-t md:border-line">
            <button
              type="button"
              onClick={async () => {
                await signOut(queryClient)
                notify.info('Você saiu da sua conta', undefined, 'auth')
                await router.navigate({ to: '/' })
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-base font-bold text-accent-strong hover:bg-band"
            >
              <LogOutIcon className="size-5" aria-hidden />
              Sair
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
