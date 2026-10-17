import type { Edition } from '@/contracts/domain'

/** Edição selecionada por padrão no detalhe: 1/50 (como no Figma), senão a primeira disponível. */
export function defaultEdition<T extends Pick<Edition, 'id' | 'label' | 'available'>>(editions: T[]): T | undefined {
  return editions.find((e) => e.label === '1/50' && e.available > 0) ?? editions.find((e) => e.available > 0) ?? editions[0]
}
