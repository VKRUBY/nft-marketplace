import type { Collection, Creator, Edition, EditionKind, Network, Nft, NftCategory, NftImage, Review } from '@/contracts/domain'
import { NETWORKS } from '@/contracts/networks'
import { fromWei, minEth, toWei } from '@/shared/eth'
import { createRng } from '../rng'

/**
 * Catálogo determinístico: 48 NFTs (4 páginas de 12) com variedade de
 * coleção, rede, preço, disponibilidade, edições e avaliações — suficiente
 * para exercitar busca, filtros combinados, ordenação e paginação.
 *
 * Os 10 primeiros reproduzem os itens desenhados no Figma (nomes, preços,
 * tokens). As imagens são os assets exportados do Figma e ficam em
 * /public/assets/nfts; só este arquivo conhece os caminhos.
 */

type Art = 'emerald' | 'sage' | 'ivory' | 'golden'

const ART: Record<Art, { file: string; subject: string }> = {
  emerald: { file: 'emerald', subject: 'macaco de óculos redondos e jaqueta varsity verde' },
  sage: { file: 'sage', subject: 'gorila de chapéu bucket e moletom lilás' },
  ivory: { file: 'ivory', subject: 'chimpanzé de blazer creme e gola alta verde' },
  golden: { file: 'golden', subject: 'orangotango de fones de ouvido e jaqueta bege' },
}

export function nftImage(art: Art, name: string, variant = 0): NftImage {
  const base = `/assets/nfts/${ART[art].file}`
  return {
    url: `${base}-750.webp`,
    srcSet: `${base}-400.webp 400w, ${base}-750.webp 750w`,
    alt: variant === 0 ? `${name}: ilustração de um ${ART[art].subject}` : `${name}: vista ${variant + 1} da obra`,
    width: 750,
    height: 750,
  }
}

const COLLECTIONS: Collection[] = [
  { id: 'col_kurio_apes', name: 'Kurio Apes' },
  { id: 'col_kurio_editions', name: 'Kurio Editions' },
  { id: 'col_jungle', name: 'Jungle Frequencies' },
  { id: 'col_ivory', name: 'Ivory Court' },
]

const CREATORS: Creator[] = [
  { id: 'cr_nova', name: 'Nova Sato', handle: 'novasato' },
  { id: 'cr_oko', name: 'Okô Studio', handle: 'okostudio' },
  { id: 'cr_rafa', name: 'Rafa Tavares', handle: 'rafatavares' },
  { id: 'cr_nina', name: 'Nina Kode', handle: 'ninakode' },
]

interface Seed {
  stem: string
  number: number
  art: Art
  priceCents: number
  compareAtCents?: number
  attributes: string[]
}

/** Itens do Figma, na ordem em que aparecem no Início. */
const FIGMA_ITEMS: Seed[] = [
  { stem: 'Emerald Ape', number: 42, art: 'emerald', priceCents: 119, attributes: ['Óculos', 'Esmeralda', 'Raro'] },
  { stem: 'Sage Nomad', number: 9, art: 'sage', priceCents: 169, attributes: ['Chapéu bucket', 'Moletom', 'Comum'] },
  { stem: 'Neon Vessel', number: 552, art: 'ivory', priceCents: 199, compareAtCents: 229, attributes: ['Blazer', 'Brinco', 'Raro'] },
  { stem: 'Cosmic Bloom', number: 118, art: 'sage', priceCents: 129, attributes: ['Chapéu bucket', 'Cordão', 'Comum'] },
  { stem: 'Violet Nomad', number: 314, art: 'sage', priceCents: 139, attributes: ['Moletom lilás', 'Sereno', 'Incomum'] },
  { stem: 'Ivory Baron', number: 88, art: 'ivory', priceCents: 179, attributes: ['Gola alta', 'Brinco de ouro', 'Raro'] },
  { stem: 'Golden Beat', number: 207, art: 'golden', priceCents: 99, attributes: ['Fones', 'Jaqueta bege', 'Comum'] },
  { stem: 'Golden Sage', number: 233, art: 'golden', priceCents: 149, attributes: ['Fones', 'Sálvia', 'Incomum'] },
  { stem: 'Golden Signal', number: 160, art: 'golden', priceCents: 39, attributes: ['Fones', 'Fundo menta', 'Comum'] },
  { stem: 'Velvet Monk', number: 71, art: 'sage', priceCents: 259, compareAtCents: 299, attributes: ['Moletom', 'Contemplativo', 'Épico'] },
]

const MORE_STEMS: Array<[string, Art]> = [
  ['Jade Hustler', 'emerald'],
  ['Copper Drift', 'golden'],
  ['Mint Sentinel', 'emerald'],
  ['Amber Rogue', 'golden'],
  ['Silent Tempo', 'ivory'],
  ['Urban Elder', 'sage'],
  ['Onyx Dandy', 'ivory'],
  ['Lilac Drifter', 'sage'],
]

const CATEGORY_CYCLE: NftCategory[] = [
  'digital_art',
  'digital_art',
  'collectible',
  'music',
  'art_3d',
  'digital_art',
  'photography',
  'generative',
  'gaming',
  'subscription',
  'utility',
  'collectible',
]
const NETWORK_CYCLE: Network[] = ['ethereum', 'ethereum', 'polygon', 'solana', 'ethereum', 'polygon']

const REVIEW_TEMPLATES = [
  { rating: 5, comment: 'Arte impecável e entrega instantânea na carteira. Já é a peça favorita da coleção.' },
  { rating: 5, comment: 'Os detalhes em alta resolução são ainda melhores do que na prévia.' },
  { rating: 4, comment: 'Ótima obra; só queria que a edição 1/10 tivesse mais unidades.' },
  { rating: 5, comment: 'Procedência clara e metadados completos. Recomendo.' },
  { rating: 4, comment: 'Bonito e bem acabado. A comunidade da coleção é muito ativa.' },
  { rating: 3, comment: 'Gostei, mas a taxa de rede no dia da compra estava alta.' },
]
const REVIEWERS = ['Lia M.', 'Caio R.', 'Bea S.', 'Theo P.', 'Duda A.', 'Rui F.']

function editionsFor(index: number, seed: Seed, rng: ReturnType<typeof createRng>): Edition[] {
  const base = BigInt(seed.priceCents) * 10n ** 16n
  const plan: Array<{ label: string; kind: EditionKind; supply: number; maxPerOrder: number; mult: bigint }> = [
    { label: '1/1', kind: 'unique', supply: 1, maxPerOrder: 1, mult: 400n },
    { label: '1/10', kind: 'limited', supply: 10, maxPerOrder: 5, mult: 160n },
    { label: '1/50', kind: 'limited', supply: 50, maxPerOrder: 10, mult: 100n },
    { label: 'ABERTA', kind: 'open', supply: 999, maxPerOrder: 20, mult: 110n },
  ]
  return plan.map((p, e) => {
    // Variedade de estados: algumas edições esgotadas e alguns NFTs inteiros esgotados.
    const wholeSoldOut = index % 13 === 11
    const editionSoldOut = wholeSoldOut || (p.kind === 'unique' && index % 3 === 0) || (p.label === '1/10' && index % 5 === 4)
    const available = editionSoldOut
      ? 0
      : p.kind === 'open'
        ? 999
        : p.kind === 'unique'
          ? 1
          : Math.max(1, Math.round(p.supply * (0.3 + rng.next() * 0.7)))
    // A edição 1/50 usa o número do Figma (#0042); as demais derivam dele.
    const tokenNumber = p.label === '1/50' ? seed.number : (seed.number + (e + 1) * 250) % 10_000
    return {
      id: `ed_${index}_${e}`,
      label: p.label,
      kind: p.kind,
      tokenId: `#${String(tokenNumber).padStart(4, '0')}`,
      priceEth: fromWei((base * p.mult) / 100n),
      supply: p.supply,
      available,
      maxPerOrder: p.maxPerOrder,
      status: available > 0 ? 'available' : 'sold_out',
    }
  })
}

export function buildCatalog(): Nft[] {
  const rng = createRng(2026)
  const baseTime = Date.parse('2026-10-15T12:00:00Z')
  const seeds: Seed[] = [...FIGMA_ITEMS]
  for (let i = seeds.length; i < 48; i++) {
    const [stem, art] = MORE_STEMS[i % MORE_STEMS.length]!
    seeds.push({
      stem,
      number: 100 + ((i * 37) % 800),
      art,
      priceCents: rng.int(4, 1230),
      compareAtCents: i % 9 === 0 ? undefined : undefined,
      attributes: [rng.pick(['Óculos', 'Fones', 'Chapéu', 'Blazer', 'Moletom']), rng.pick(['Sereno', 'Confiante', 'Curioso']), rng.pick(['Comum', 'Incomum', 'Raro', 'Épico'])],
    })
  }

  return seeds.map((seed, i) => {
    const name = `${seed.stem} #${String(seed.number).padStart(3, '0')}`
    const slug = `${seed.stem.toLowerCase().replace(/\s+/g, '-')}-${String(seed.number).padStart(3, '0')}`
    const network = i === 0 ? 'ethereum' : NETWORK_CYCLE[i % NETWORK_CYCLE.length]!
    const collection = i < 10 ? (i % 2 === 0 ? COLLECTIONS[0]! : COLLECTIONS[1]!) : COLLECTIONS[i % COLLECTIONS.length]!
    const creator = i === 0 ? CREATORS[0]! : CREATORS[(i * 3) % CREATORS.length]!
    const reviewCount = i === 0 ? 19 : rng.int(0, 42)
    const reviews: Review[] = Array.from({ length: Math.min(reviewCount, 6) }, (_, r) => {
      const t = REVIEW_TEMPLATES[(i + r) % REVIEW_TEMPLATES.length]!
      return {
        id: `rv_${i}_${r}`,
        author: REVIEWERS[(i + r) % REVIEWERS.length]!,
        rating: t.rating,
        comment: t.comment,
        createdAt: new Date(baseTime - (r + 1) * 86_400_000 * 3).toISOString(),
      }
    })
    const rating = reviews.length ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10 : 0
    const likes = i < 10 ? 900 - i * 37 : rng.int(3, 700)
    const createdAt = new Date(baseTime - i * 30 * 60 * 60 * 1000).toISOString()
    const images = [0, 1, 2, 3].map((v) => nftImage(seed.art, name, v))
    const net = NETWORKS[network].label

    const nft: Nft = {
      id: `nft_${String(i + 1).padStart(3, '0')}`,
      slug,
      name,
      image: images[0]!,
      images,
      category: CATEGORY_CYCLE[i % CATEGORY_CYCLE.length]!,
      network,
      collection,
      creator,
      floorPriceEth: '0',
      compareAtPriceEth: seed.compareAtCents ? fromWei(BigInt(seed.compareAtCents) * 10n ** 16n) : null,
      totalAvailable: 0,
      status: 'available',
      rare: seed.attributes.includes('Raro') || seed.attributes.includes('Épico'),
      isNewRelease: i < 8,
      isTrending: likes >= 600,
      likes,
      rating,
      reviewCount,
      createdAt,
      version: 1,
      description: `Um colecionável digital finalizado à mão da coleção ${collection.name}, verificado na ${net}, com arte desbloqueável e acesso para colecionadores.`,
      longDescription: [
        `${name} é uma obra digital finalizada à mão da coleção ${collection.name}. Cada atributo fica armazenado nos metadados do token e verificado na ${net}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
        `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. ${creator.name} recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
      ],
      editions: editionsFor(i, seed, rng),
      attributes: seed.attributes,
      contractAddress: `0x${rng.hex(40)}`,
      royaltyPercent: 5,
      reviews,
    }
    return recomputeAggregates(nft)
  })
}

/**
 * Recalcula preço exibido, disponibilidade total e status a partir das
 * edições. O preço exibido no card é o da edição padrão (1/50, como no
 * Figma) quando disponível; senão, o menor entre as disponíveis.
 */
export function recomputeAggregates(nft: Nft): Nft {
  const editions = nft.editions.map((e) => ({ ...e, status: e.available > 0 ? ('available' as const) : ('sold_out' as const) }))
  const available = editions.filter((e) => e.available > 0)
  const preferred = available.find((e) => e.label === '1/50')
  const pool = available.length > 0 ? available : editions
  const floor = preferred?.priceEth ?? pool.reduce((acc, e) => minEth(acc, e.priceEth), pool[0]!.priceEth)
  const totalAvailable = editions.reduce((acc, e) => acc + e.available, 0)
  return {
    ...nft,
    editions,
    floorPriceEth: fromWei(toWei(floor)),
    totalAvailable,
    status: totalAvailable > 0 ? 'available' : 'sold_out',
  }
}
