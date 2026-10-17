import type { NftSummary } from '@/contracts/domain'
import { NftCard, NftCardSkeleton } from './nft-card'

/** Faixa horizontal com rolagem por arraste/teclado (substitui o carrossel com pontos). */
export function NftRail({
  items,
  loading,
  error,
}: {
  items: NftSummary[] | undefined
  loading: boolean
  error: boolean
}) {
  if (error) return <p className="mt-6 text-sm text-sand">Não foi possível carregar sugestões agora.</p>
  return (
    <ul
      className="mt-8 grid snap-x snap-mandatory auto-cols-[minmax(150px,45%)] grid-flow-col gap-6 overflow-x-auto pb-4 sm:auto-cols-[minmax(180px,30%)] lg:auto-cols-[calc((100%-6rem)/5)]"
      tabIndex={0}
      aria-label="Lista rolável de NFTs"
    >
      {loading
        ? Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="snap-start">
              <NftCardSkeleton />
            </li>
          ))
        : items?.map((item) => (
            <li key={item.id} className="snap-start">
              <NftCard nft={item} />
            </li>
          ))}
    </ul>
  )
}
