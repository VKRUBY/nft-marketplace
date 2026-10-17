import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Carrossel do topo. O primeiro slide reproduz o Figma e usa um asset
 * estático (não depende da API), para o LCP não esperar requisições.
 * Sem rotação automática: o usuário troca de slide pelos indicadores.
 */
const SLIDES = [
  {
    title: ['SEJA DONO DO FUTURO', 'DA ARTE DIGITAL'],
    mobileTitle: 'SEJA DONO DA CULTURA DIGITAL',
    text: 'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
    image: { src: '/assets/nfts/hero-emerald-900.webp', srcSet: '/assets/nfts/hero-emerald-480.webp 480w, /assets/nfts/hero-emerald-900.webp 900w' },
    alt: 'Emerald Ape #042: macaco de óculos redondos e jaqueta varsity verde',
    search: {},
  },
  {
    title: ['EDIÇÕES GÊNESIS', 'DE TIRAGEM LIMITADA'],
    mobileTitle: 'EDIÇÕES GÊNESIS LIMITADAS',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública, com procedência registrada na rede.',
    image: { src: '/assets/nfts/sage-750.webp', srcSet: '/assets/nfts/sage-400.webp 400w, /assets/nfts/sage-750.webp 750w' },
    alt: 'Sage Nomad #009: gorila de chapéu bucket e moletom lilás',
    search: { tab: 'new' as const },
  },
  {
    title: ['ARTE QUE TOCA', 'NA SUA CARTEIRA'],
    mobileTitle: 'ARTE QUE TOCA NA SUA CARTEIRA',
    text: 'Coleções de música, arte 3D e generativa verificadas em Ethereum, Polygon e Solana.',
    image: { src: '/assets/nfts/golden-750.webp', srcSet: '/assets/nfts/golden-400.webp 400w, /assets/nfts/golden-750.webp 750w' },
    alt: 'Golden Beat #207: orangotango de fones de ouvido e jaqueta bege',
    search: { category: ['music' as const] },
  },
]

export function HomeHero() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]!
  const id = useId()

  const dots = (
    <div role="group" aria-label="Escolher destaque" className="flex gap-2">
      {SLIDES.map((s, i) => (
        <button
          key={s.alt}
          type="button"
          onClick={() => setIndex(i)}
          aria-label={`Destaque ${i + 1} de ${SLIDES.length}`}
          aria-current={i === index ? 'true' : undefined}
          aria-controls={id}
          className={cn('size-2 rounded-full bg-accent transition-opacity', i === index ? 'opacity-100' : 'opacity-50 hover:opacity-80')}
        />
      ))}
    </div>
  )

  return (
    <section aria-roledescription="carrossel" aria-label="Destaques" className="container-page">
      {/* Desktop/tablet */}
      <div id={id} aria-live="polite" className="hidden min-h-[450px] grid-cols-[1fr_minmax(0,450px)] items-center gap-10 pt-8 md:grid lg:pt-8">
        <div className="relative flex h-full flex-col justify-center lg:pl-10">
          <p className="mb-4 text-base font-medium">Bem-vindo à Kurio</p>
          <h1 className="text-[clamp(1.9rem,3.4vw,2.69rem)] leading-[1.63] font-bold">
            {slide.title[0]}
            <br />
            {slide.title[1]}
          </h1>
          <p className="mt-3 mb-8 max-w-[550px] text-sm leading-6 text-sand">{slide.text}</p>
          <Button asChild className="h-10 w-[140px] text-base font-medium">
            <Link to="/" search={slide.search} hash="catalogo">
              EXPLORAR
            </Link>
          </Button>
          <div className="absolute bottom-10 left-[52%]">{dots}</div>
        </div>
        <img
          src={slide.image.src}
          srcSet={slide.image.srcSet}
          sizes="(min-width: 1024px) 450px, 40vw"
          alt={slide.alt}
          width={450}
          height={450}
          fetchPriority={index === 0 ? 'high' : 'auto'}
          className="aspect-square w-full rounded-[20px] object-cover"
        />
      </div>

      {/* Mobile */}
      <div className="relative mt-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#6b4a35] via-[#3a2618] to-[#2a1b13] p-4 md:hidden">
        <div aria-hidden className="absolute -top-10 left-24 size-56 rounded-full bg-white/5" />
        <div className="relative grid grid-cols-[1fr_140px] gap-3">
          <div>
            <p className="text-xs">Bem-vindo à Kurio</p>
            <h1 className="mt-2 text-lg leading-8 font-bold">{slide.mobileTitle}</h1>
            <p className="mt-1 text-xs leading-[18px] text-sand">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <Link to="/" search={slide.search} hash="catalogo" className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-accent-strong">
              EXPLORAR <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
          <img
            src={slide.image.src}
            srcSet={slide.image.srcSet}
            sizes="140px"
            alt={slide.alt}
            width={140}
            height={140}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            className="aspect-square w-full self-center rounded-2xl object-cover"
          />
        </div>
        <div className="mt-3 flex justify-center">{dots}</div>
      </div>
    </section>
  )
}
