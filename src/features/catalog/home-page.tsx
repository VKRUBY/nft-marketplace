import { CatalogSection, MobileCatalogBar } from './catalog-section'
import { HomeHero } from './home-hero'
import { HomePromos, MintJournal } from './home-promos'
import type { CatalogSearch } from './search'

/** Início (frames Desktop/Mobile Início). Também serve de fundo para Login e Cadastro. */
export function HomePage({ search }: { search: CatalogSearch }) {
  return (
    <>
      <MobileCatalogBar search={search} />
      <HomeHero />
      <CatalogSection search={search} />
      <HomePromos />
      <MintJournal />
    </>
  )
}
