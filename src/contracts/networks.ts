import type { Network } from './domain'

export const NETWORKS: Record<Network, { label: string; chainId: number; explorer: string }> = {
  ethereum: { label: 'Ethereum', chainId: 1, explorer: 'https://etherscan.io' },
  polygon: { label: 'Polygon', chainId: 137, explorer: 'https://polygonscan.com' },
  arbitrum: { label: 'Arbitrum One', chainId: 42161, explorer: 'https://arbiscan.io' },
  base: { label: 'Base', chainId: 8453, explorer: 'https://basescan.org' },
}

export const NETWORK_LIST = Object.keys(NETWORKS) as Network[]
