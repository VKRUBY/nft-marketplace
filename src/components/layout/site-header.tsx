import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogInIcon, SearchIcon, ShoppingCartIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCart } from '@/features/cart/use-cart'
import { useSession } from '@/lib/auth/session'
import { cn } from '@/lib/utils'
import { UserAvatar } from '../user-avatar'
import { Logo } from './logo'

const NAV = [
  { label: 'Início', to: '/', match: (p: string) => p === '/' },
  { label: 'Mercado', to: '/mercado', match: (p: string) => p.startsWith('/mercado') || p.startsWith('/nft') || p.startsWith('/carrinho') || p.startsWith('/pagamento') },
  { label: 'Criadores', to: '/em-breve/$secao', params: { secao: 'criadores' }, match: (p: string) => p === '/em-breve/criadores' },
  { label: 'Aprenda', to: '/em-breve/$secao', params: { secao: 'aprenda' }, match: (p: string) => p === '/em-breve/aprenda' },
] as const

/** Cabeçalho desktop/tablet (frames Desktop). No mobile é substituído pela barra inferior. */
export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { user } = useSession()
  const { data: cart } = useCart()
  const count = cart?.summary.itemCount ?? 0
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header className="container-page hidden md:block">
      <div className="flex h-[68px] items-center gap-6 border-b border-line">
        <Logo />
        <nav aria-label="Principal" className="mx-auto">
          <ul className="flex items-center gap-10">
            {NAV.map((item) => {
              const active = item.match(pathname)
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    params={'params' in item ? item.params : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative block pt-1 pb-[22px] text-base text-cream transition-colors hover:text-accent-strong',
                      active && 'font-bold text-accent-strong after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-accent',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-sm p-1 text-cream hover:text-accent-strong"
            aria-label="Buscar NFTs"
          >
            <SearchIcon className="size-6" aria-hidden />
          </button>
          <Link to="/carrinho" className="relative rounded-sm p-1 text-cream hover:text-accent-strong" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <ShoppingCartIcon className="size-6" aria-hidden />
            {count > 0 && (
              <span aria-hidden className="absolute -top-0.5 -right-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] leading-4 font-bold text-ink">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
          {user ? (
            <Link
              to="/perfil"
              className="flex items-center gap-2 rounded-md border border-accent px-2 py-1 text-sm font-bold text-accent-strong hover:bg-accent/10"
            >
              <UserAvatar user={user} className="size-7" />
              <span className="max-w-[10ch] truncate">{user.name.split(' ')[0]}</span>
              <span className="sr-only">— abrir perfil</span>
            </Link>
          ) : (
            <Button asChild size="sm" className="h-[35px] gap-1 px-2.5 text-base">
              <Link to="/login" search={{ redirect: undefined, reason: undefined }}>
                <LogInIcon className="size-5" aria-hidden />
                Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const id = useId()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 translate-y-0 p-6" accentBar={false}>
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription className="mb-3">Pesquise por nome, coleção ou criador.</DialogDescription>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
            onOpenChange(false)
            void navigate({ to: '/', search: q ? { q } : {}, hash: 'catalogo' })
          }}
        >
          <label htmlFor={id} className="sr-only">
            Termo de busca
          </label>
          <Input id={id} name="q" type="search" placeholder="Ex.: Emerald Ape" autoFocus />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
