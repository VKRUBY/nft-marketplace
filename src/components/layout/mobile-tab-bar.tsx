import { Link, useRouterState } from '@tanstack/react-router'
import { HeartIcon, HomeIcon, ScanSearchIcon, ShoppingCartIcon, UserIcon } from 'lucide-react'
import { useCart } from '@/features/cart/use-cart'
import { cn } from '@/lib/utils'

/** Barra de navegação inferior do mobile (frame Mobile / Início). */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data: cart } = useCart()
  const count = cart?.summary.itemCount ?? 0
  // Telas com ações próprias no rodapé (frames Mobile de detalhe, carrinho e pagamento) não mostram a barra.
  if (/^\/(nft|carrinho|pagamento|pedido|login|cadastro)(\/|$)/.test(pathname)) return null
  const item = (active: boolean) =>
    cn('grid size-12 place-items-center rounded-full text-cream transition-colors', active ? 'text-accent-strong' : 'hover:text-accent-strong')

  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto flex h-[72px] max-w-[480px] items-center justify-between rounded-t-[28px] bg-surface px-6 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
        <Link to="/" aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined} className={item(pathname === '/')}>
          <HomeIcon className="size-5" aria-hidden />
        </Link>
        <Link
          to="/perfil/interesses"
          aria-label="Lista de interesse"
          aria-current={pathname === '/perfil/interesses' ? 'page' : undefined}
          className={item(pathname === '/perfil/interesses')}
        >
          <HeartIcon className="size-5" aria-hidden />
        </Link>
        <Link
          to="/"
          hash="catalogo"
          aria-label="Explorar catálogo"
          className="-mt-10 grid size-16 place-items-center rounded-full border-[6px] border-ink bg-accent text-ink"
        >
          <ScanSearchIcon className="size-6" aria-hidden />
        </Link>
        <Link
          to="/carrinho"
          aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
          aria-current={pathname === '/carrinho' ? 'page' : undefined}
          className={cn(item(pathname === '/carrinho'), 'relative')}
        >
          <ShoppingCartIcon className="size-5" aria-hidden />
          {count > 0 && (
            <span aria-hidden className="absolute top-1 right-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-bold text-ink">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
        <Link to="/perfil" aria-label="Perfil" aria-current={pathname.startsWith('/perfil') && pathname !== '/perfil/interesses' ? 'page' : undefined} className={item(pathname.startsWith('/perfil') && pathname !== '/perfil/interesses')}>
          <UserIcon className="size-5" aria-hidden />
        </Link>
      </div>
    </nav>
  )
}
