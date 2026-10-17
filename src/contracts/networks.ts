import type { NftCategory, Network, WalletProvider } from './domain'

export const NETWORKS: Record<Network, { label: string; explorer: string; explorerName: string }> = {
  ethereum: { label: 'Ethereum', explorer: 'https://etherscan.io', explorerName: 'Etherscan' },
  polygon: { label: 'Polygon', explorer: 'https://polygonscan.com', explorerName: 'Polygonscan' },
  solana: { label: 'Solana', explorer: 'https://solscan.io', explorerName: 'Solscan' },
}

export const NETWORK_LIST = Object.keys(NETWORKS) as Network[]

/** Ordem e rótulos da barra lateral "Coleções". */
export const CATEGORIES: Record<NftCategory, string> = {
  digital_art: 'Arte digital',
  photography: 'Fotografia',
  music: 'Música',
  art_3d: 'Arte 3D',
  collectible: 'Colecionáveis',
  generative: 'Generativa',
  gaming: 'Jogos',
  subscription: 'Assinaturas',
  utility: 'Utilidade',
}

export const CATEGORY_LIST = Object.keys(CATEGORIES) as NftCategory[]

export const WALLET_PROVIDERS: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

export const WALLET_PROVIDER_LIST = Object.keys(WALLET_PROVIDERS) as WalletProvider[]
