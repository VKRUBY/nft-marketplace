/**
 * Seções que aparecem no layout, mas não fazem parte desta entrega
 * (páginas editoriais, suporte, atividade, ofertas, downloads). Os links
 * levam a uma página que diz isso claramente, sem simular sucesso.
 */
export const OUT_OF_SCOPE = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  diario: 'Diário da Cunhagem',
  colecao: 'Minha coleção',
  atividade: 'Atividade',
  estudio: 'Estúdio do criador',
  ajuda: 'Central de ajuda',
  'como-comprar': 'Como comprar NFTs',
  seguranca: 'Carteira e segurança',
  politica: 'Política do mercado',
  denunciar: 'Denunciar item',
  ofertas: 'Ofertas',
  downloads: 'Arquivos baixados',
  suporte: 'Suporte',
  'senha-esquecida': 'Recuperação de senha',
} as const

export type OutOfScopeSection = keyof typeof OUT_OF_SCOPE
