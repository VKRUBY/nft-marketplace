import type { Collection, Creator, Edition, Nft, NftCategory, NftImage, NftRarity, Network } from '@/contracts/domain'
import { fromWei, minEth, toWei } from '@/shared/eth'
import { createRng } from '../rng'

/**
 * Catálogo determinístico: 48 NFTs com variedade de categoria, raridade,
 * preço, disponibilidade e edições, suficiente para exercitar busca,
 * filtros combinados, ordenação e paginação (4 páginas de 12).
 *
 * As imagens ficam em /public/assets/nfts e são resolvidas só aqui,
 * para que a troca de assets não toque no restante dos mocks.
 */

export const NFT_IMAGE_COUNT = 12

export function nftImage(index: number, name: string): NftImage {
  const n = (index % NFT_IMAGE_COUNT) + 1
  return {
    url: `/assets/nfts/nft-${String(n).padStart(2, '0')}.webp`,
    alt: `Ilustração do NFT ${name}`,
    width: 800,
    height: 800,
  }
}

const COLLECTIONS: Collection[] = [
  { id: 'col_golden', name: 'Golden Primates', verified: true },
  { id: 'col_ivory', name: 'Ivory Court', verified: true },
  { id: 'col_jungle', name: 'Jungle Frequencies', verified: false },
  { id: 'col_mint', name: 'GreenMint Genesis', verified: true },
]

const CREATORS: Creator[] = [
  { id: 'cr_lumi', name: 'Lumi Arts', handle: 'lumiarts', avatarUrl: '/assets/avatars/creator-1.webp', verified: true },
  { id: 'cr_oko', name: 'Okô Studio', handle: 'okostudio', avatarUrl: '/assets/avatars/creator-2.webp', verified: true },
  { id: 'cr_rafa', name: 'Rafa Tavares', handle: 'rafatavares', avatarUrl: '/assets/avatars/creator-3.webp', verified: false },
  { id: 'cr_nina', name: 'Nina Kode', handle: 'ninakode', avatarUrl: '/assets/avatars/creator-4.webp', verified: true },
]

const STEMS = [
  'Golden Beat',
  'Golden Signal',
  'Ivory Baron',
  'Jade Hustler',
  'Velvet Monk',
  'Neon Shaman',
  'Copper Drift',
  'Mint Sentinel',
  'Amber Rogue',
  'Silent Tempo',
  'Cosmic Banter',
  'Urban Elder',
]

const CATEGORIES: NftCategory[] = ['art', 'collectible', 'music', 'photography', 'gaming', 'pfp']
const RARITIES: NftRarity[] = ['common', 'common', 'rare', 'rare', 'epic', 'legendary']
const NETWORKS: Network[] = ['ethereum', 'ethereum', 'polygon', 'base']
const EDITION_LABELS = ['Edição Gênesis', 'Edição Ouro', 'Edição Prata']
const TRAITS = {
  Fundo: ['Creme', 'Sálvia', 'Menta', 'Areia'],
  Acessório: ['Fones', 'Chapéu bucket', 'Óculos redondos', 'Brinco de ouro', 'Nenhum'],
  Traje: ['Jaqueta varsity', 'Moletom', 'Gola alta', 'Blazer'],
  Humor: ['Sereno', 'Confiante', 'Curioso', 'Sonhador'],
}

const DESCRIPTION =
  'Parte de uma série de retratos digitais de primatas com personalidade própria. Cada edição dá ao colecionador a posse verificável do token na rede indicada e acesso a lançamentos futuros da coleção.'

export function buildCatalog(): Nft[] {
  const rng = createRng(2026)
  const baseTime = Date.parse('2026-09-30T12:00:00Z')
  const nfts: Nft[] = []

  for (let i = 0; i < 48; i++) {
    const stem = STEMS[i % STEMS.length]!
    const number = 100 + ((i * 37) % 300)
    const name = `${stem} #${number}`
    const slug = `${stem.toLowerCase().replace(/\s+/g, '-')}-${number}`
    const category = CATEGORIES[(i * 5) % CATEGORIES.length]!
    const rarity = RARITIES[rng.int(0, RARITIES.length - 1)]!

    // Preço base entre 0.05 e 2.40 ETH, com centésimos — sempre string decimal.
    const baseCents = rng.int(5, 240)
    const editionCount = i % 7 === 0 ? 1 : rng.int(1, 3)
    const editions: Edition[] = Array.from({ length: editionCount }, (_, e) => {
      const supply = [1, 5, 10, 25][rng.int(0, 3)]!
      // Alguns NFTs esgotados e algumas edições esgotadas para exercitar estados.
      const soldOut = i % 11 === 5 || (e > 0 && rng.next() < 0.2)
      const available = soldOut ? 0 : Math.max(1, Math.round(supply * (0.2 + rng.next() * 0.8)))
      const priceWei = (BigInt(baseCents) * 10n ** 16n * BigInt(100 + e * 35)) / 100n
      const tokenNumber = (i * 13 + e * 101) % 999
      return {
        id: `ed_${i}_${e}`,
        label: EDITION_LABELS[e] ?? `Edição ${e + 1}`,
        tokenId: `#${String(tokenNumber).padStart(4, '0')}`,
        priceEth: fromWei(priceWei),
        supply,
        available,
        maxPerOrder: Math.min(supply, 5),
        status: available > 0 ? 'available' : 'sold_out',
      }
    })

    const images = [0, 1, 2, 3].map((k) => nftImage(i + k * 3, name))
    const nft: Nft = {
      id: `nft_${String(i + 1).padStart(3, '0')}`,
      slug,
      name,
      image: images[0]!,
      images,
      category,
      rarity,
      collection: COLLECTIONS[i % COLLECTIONS.length]!,
      creator: CREATORS[(i * 3) % CREATORS.length]!,
      floorPriceEth: '0',
      totalAvailable: 0,
      status: 'available',
      likes: rng.int(3, 980),
      createdAt: new Date(baseTime - i * 36 * 60 * 60 * 1000).toISOString(),
      version: 1,
      description: DESCRIPTION,
      editions,
      contractAddress: `0x${rng.hex(40)}`,
      blockchain: NETWORKS[i % NETWORKS.length]!,
      properties: Object.entries(TRAITS).map(([trait, values]) => ({ trait, value: rng.pick(values) })),
    }
    nfts.push(recomputeAggregates(nft))
  }
  return nfts
}

/** Recalcula preço mínimo, disponibilidade total e status a partir das edições. */
export function recomputeAggregates(nft: Nft): Nft {
  const available = nft.editions.filter((e) => e.available > 0)
  const pool = available.length > 0 ? available : nft.editions
  const floor = pool.reduce((acc, e) => minEth(acc, e.priceEth), pool[0]!.priceEth)
  const totalAvailable = nft.editions.reduce((acc, e) => acc + e.available, 0)
  return {
    ...nft,
    editions: nft.editions.map((e) => ({ ...e, status: e.available > 0 ? 'available' : 'sold_out' })),
    floorPriceEth: fromWei(toWei(floor)),
    totalAvailable,
    status: totalAvailable > 0 ? 'available' : 'sold_out',
  }
}
