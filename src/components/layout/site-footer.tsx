import { Link } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CATEGORIES } from '@/contracts/networks'
import type { NftCategory } from '@/contracts/domain'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const FOOTER_COLLECTIONS: NftCategory[] = ['digital_art', 'photography', 'music', 'art_3d', 'utility']

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com', path: 'M14 8h3V4h-3c-2.2 0-4 1.8-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z' },
  { label: 'Instagram', href: 'https://www.instagram.com', path: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm5.5-1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z' },
  { label: 'X (Twitter)', href: 'https://x.com', path: 'M22 5.9c-.7.3-1.5.5-2.3.6.8-.5 1.5-1.3 1.8-2.2-.8.5-1.7.8-2.6 1A4.1 4.1 0 0 0 12 9.1 11.6 11.6 0 0 1 3.4 4.8a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5 0 2 1.4 3.7 3.3 4.1-.6.2-1.2.2-1.9.1.5 1.6 2 2.8 3.9 2.9A8.3 8.3 0 0 1 2 18.6 11.6 11.6 0 0 0 8.3 20.4c7.5 0 11.7-6.2 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.3z' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', path: 'M5 8h3v12H5V8zm1.5-5a1.7 1.7 0 1 1 0 3.5 1.7 1.7 0 0 1 0-3.5zM10 8h3v1.7c.5-.9 1.7-1.9 3.5-1.9 3.7 0 4.5 2.4 4.5 5.6V20h-3v-5.8c0-1.4 0-3.1-1.9-3.1s-2.1 1.5-2.1 3V20h-3V8z' },
  { label: 'YouTube', href: 'https://www.youtube.com', path: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z' },
]

export function SiteFooter() {
  return (
    <footer className="container-page mt-16 pb-24 md:mt-24 md:pb-0">
      <div className="bg-surface">
        <section aria-label="Benefícios" className="grid gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:px-12">
          {FEATURES.map((f) => (
            <div key={f.letter} className="lg:border-r lg:border-accent lg:pr-6 lg:pl-0 [&:not(:first-child)]:lg:pl-4">
              <span aria-hidden className="mb-4 grid size-[74px] place-items-center rounded-full bg-accent text-2xl font-bold text-ink">
                {f.letter}
              </span>
              <h2 className="mb-2 text-lg font-bold">{f.title}</h2>
              <p className="text-sm leading-[22px] text-sand">{f.text}</p>
            </div>
          ))}
          <NewsletterForm />
        </section>
        <div className="grid gap-3 bg-band px-6 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <p className="font-bold tracking-[0.12em]">KURIO</p>
          <p className="max-w-[28ch]">Feito para colecionadores, criadores e cultura</p>
          <a href="mailto:contato@email.com" className="hover:text-accent-strong">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-accent-strong">
            +55 11 4002 8922
          </a>
        </div>
        <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <FooterColumn title="Meu perfil">
            <FooterLink to="/perfil">Meu perfil</FooterLink>
            <FooterSoon section="colecao">Minha coleção</FooterSoon>
            <FooterSoon section="atividade">Atividade</FooterSoon>
            <FooterSoon section="estudio">Estúdio do criador</FooterSoon>
            <FooterLink to="/perfil/interesses">Lista de interesse</FooterLink>
          </FooterColumn>
          <FooterColumn title="Central de ajuda">
            <FooterSoon section="ajuda">Central de ajuda</FooterSoon>
            <FooterSoon section="como-comprar">Como comprar NFTs</FooterSoon>
            <FooterSoon section="seguranca">Carteira e segurança</FooterSoon>
            <FooterSoon section="politica">Política do mercado</FooterSoon>
            <FooterSoon section="denunciar">Denunciar item</FooterSoon>
          </FooterColumn>
          <FooterColumn title="Coleções">
            {FOOTER_COLLECTIONS.map((c) => (
              <li key={c}>
                <Link to="/" search={{ category: [c] }} hash="catalogo" className="hover:text-accent-strong">
                  {CATEGORIES[c]}
                </Link>
              </li>
            ))}
          </FooterColumn>
          <div>
            <h2 className="mb-3 text-lg font-bold">Redes sociais</h2>
            <ul className="mb-6 flex gap-2">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid size-8 place-items-center rounded-sm border border-accent text-accent-strong hover:bg-accent/10"
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                      <path d={s.path} />
                    </svg>
                    <span className="sr-only">{s.label} (abre em nova aba)</span>
                  </a>
                </li>
              ))}
            </ul>
            <h2 className="mb-2 text-lg font-bold">Carteiras compatíveis</h2>
            <WalletChip />
          </div>
        </div>
      </div>
      <p className="py-4 text-center text-sm">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

export function WalletChip() {
  return (
    <p className="inline-flex items-center gap-2 rounded-sm border border-line bg-band px-2.5 py-1.5 text-[9px] font-bold tracking-wide text-accent-strong">
      METAMASK <span aria-hidden>•</span> WALLETCONNECT <span aria-hidden>•</span> COINBASE
    </p>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <ul className="flex flex-col gap-2 text-sm">{children}</ul>
    </div>
  )
}

function FooterLink({ to, children }: { to: '/perfil' | '/perfil/interesses'; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="hover:text-accent-strong">
        {children}
      </Link>
    </li>
  )
}

function FooterSoon({ section, children }: { section: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to="/em-breve/$secao" params={{ secao: section }} className="hover:text-accent-strong">
        {children}
      </Link>
    </li>
  )
}

/**
 * "Antecipe-se ao próximo lançamento". A inscrição não faz parte desta
 * entrega: o formulário valida o e-mail e informa isso claramente, sem
 * fingir que a inscrição foi feita.
 */
function NewsletterForm() {
  const id = useId()
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  return (
    <form
      noValidate
      className="lg:pl-4"
      onSubmit={(e) => {
        e.preventDefault()
        const email = String(new FormData(e.currentTarget).get('email') ?? '').trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setMessage({ tone: 'error', text: 'Informe um e-mail válido.' })
          return
        }
        setMessage({ tone: 'info', text: 'A newsletter ainda não está disponível nesta versão — nenhuma inscrição foi feita.' })
      }}
    >
      <h2 className="mb-4 text-lg leading-5 font-bold">
        <label htmlFor={id}>Antecipe-se ao próximo lançamento</label>
      </h2>
      <div className="mb-3 flex">
        <input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          aria-invalid={message?.tone === 'error' || undefined}
          aria-describedby={`${id}-msg`}
          className="h-10 min-w-0 flex-1 rounded-l-sm bg-band px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button type="submit" className="h-10 rounded-l-none text-lg">
          Enviar
        </Button>
      </div>
      <p id={`${id}-msg`} role="status" className={message?.tone === 'error' ? 'text-sm text-danger' : 'text-sm leading-[22px] text-sand'}>
        {message?.text ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </form>
  )
}
