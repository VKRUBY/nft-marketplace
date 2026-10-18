import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const PROMOS = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    img: 'emerald',
    alt: 'Macaco de óculos redondos e jaqueta varsity verde',
    search: { tab: 'new' as const },
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    img: 'ivory',
    alt: 'Chimpanzé de blazer creme e gola alta verde',
    search: { category: ['digital_art' as const] },
  },
]

export function HomePromos() {
  return (
    <section aria-label="Coleções em destaque" className="container-page mt-20 grid grid-cols-1 gap-6 md:mt-24 lg:grid-cols-2 lg:gap-7">
      {PROMOS.map((p) => (
        <article key={p.title} className="grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] items-center sm:grid-cols-[minmax(0,287px)_minmax(0,1fr)] gap-2 bg-surface">
          <img
            src={`/assets/nfts/${p.img}-400.webp`}
            srcSet={`/assets/nfts/${p.img}-400.webp 400w, /assets/nfts/${p.img}-750.webp 750w`}
            sizes="(min-width: 1024px) 287px, 40vw"
            alt={p.alt}
            width={287}
            height={250}
            loading="lazy"
            className="aspect-[287/250] h-full w-full rounded-[20px] object-cover"
          />
          <div className="flex flex-col items-end gap-3 p-4 text-right sm:p-6">
            <h2 className="text-base font-bold sm:text-lg">{p.title}</h2>
            <p className="text-xs leading-6 text-sand sm:text-sm">{p.text}</p>
            <Button asChild className="w-[140px]">
              <Link to="/" search={p.search} hash="catalogo" aria-label={`Explorar: ${p.title}`}>
                Explorar <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', img: 'ivory' },
  { date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', img: 'emerald' },
  { date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', img: 'sage' },
  { date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', img: 'golden' },
]

/** "Diário da Cunhagem": conteúdo editorial fora do escopo — os links dizem isso claramente. */
export function MintJournal() {
  return (
    <section aria-labelledby="journal-title" className="container-page mt-24 md:mt-32">
      <h2 id="journal-title" className="text-center text-2xl font-bold md:text-[28px]">
        Diário da Cunhagem
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-sand">
        Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
      </p>
      <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-surface">
              <img
                src={`/assets/nfts/${post.img}-400.webp`}
                alt=""
                width={268}
                height={195}
                loading="lazy"
                className="aspect-[268/195] w-full object-cover"
              />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-xs text-sand">
                  <time>{post.date}</time> <span aria-hidden>|</span> Leitura de {post.read} min
                </p>
                <h3 className="text-base font-bold">{post.title}</h3>
                <p className="text-xs leading-4 text-sand">{post.text}</p>
                <Link
                  to="/em-breve/$secao"
                  params={{ secao: 'diario' }}
                  className="mt-auto pt-1 text-xs font-bold text-accent-strong after:absolute after:inset-0"
                >
                  Ler mais <span aria-hidden>→</span>
                  <span className="sr-only">: {post.title}</span>
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
