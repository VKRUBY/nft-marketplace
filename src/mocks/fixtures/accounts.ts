import type { User, Wallet } from '@/contracts/domain'

/**
 * Contas fictícias. A senha de ambas é `Mint@2026`, guardada apenas como
 * hash SHA-256 de `${salt}:${senha}` — nunca em claro.
 */
export interface UserRecord extends User {
  passwordSalt: string
  passwordHash: string
}

const created = '2026-03-14T15:00:00.000Z'

export function buildUsers(): UserRecord[] {
  return [
    {
      id: 'usr_ana',
      name: 'Ana Ribeiro',
      username: 'ana_coleciona',
      email: 'ana@greenmint.test',
      phone: '+55 51 99999-0001',
      bio: 'Coleciono retratos digitais desde 2021.',
      avatarUrl: '/assets/avatars/user-ana.webp',
      country: 'Brasil',
      city: 'Porto Alegre',
      website: null,
      createdAt: created,
      updatedAt: created,
      passwordSalt: 'salt-ana-01',
      passwordHash: 'bc82e10dcf8c862c7924d0fefb80e1f4fb29123e5c157ca55fa9f46a1c3286b7',
    },
    {
      id: 'usr_bruno',
      name: 'Bruno Costa',
      username: 'brunocosta',
      email: 'bruno@greenmint.test',
      phone: null,
      bio: null,
      avatarUrl: null,
      country: 'Brasil',
      city: 'São Paulo',
      website: null,
      createdAt: created,
      updatedAt: created,
      passwordSalt: 'salt-bruno-02',
      passwordHash: 'f85136570b7cbf52ea423eef0a6eadaae882a6e56d6a848a962f1a3f086efd45',
    },
  ]
}

export function buildWallets(): Record<string, Wallet[]> {
  return {
    usr_ana: [
      {
        id: 'wal_ana_main',
        role: 'primary',
        label: 'MetaMask principal',
        provider: 'metamask',
        address: '0x8f3c9a1b2d4e6f708192a3b4c5d6e7f8091a2b3c',
        ens: 'ana.eth',
        networks: ['ethereum', 'polygon', 'base'],
        createdAt: created,
        updatedAt: created,
      },
      {
        id: 'wal_ana_alt',
        role: 'secondary',
        label: 'WalletConnect reserva',
        provider: 'walletconnect',
        address: '0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
        ens: null,
        networks: ['ethereum', 'arbitrum'],
        createdAt: created,
        updatedAt: created,
      },
    ],
    usr_bruno: [
      {
        id: 'wal_bruno_main',
        role: 'primary',
        label: 'Coinbase Wallet',
        provider: 'coinbase',
        address: '0x9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d',
        ens: null,
        networks: ['ethereum', 'base'],
        createdAt: created,
        updatedAt: created,
      },
    ],
  }
}

export interface CouponRecord {
  code: string
  description: string
  percentBp: number
  expiresAt: string
}

/** GREEN10 válido; MINT25 válido; EXPIRADO vencido. Qualquer outro código é inválido. */
export function buildCoupons(): CouponRecord[] {
  return [
    { code: 'GREEN10', description: '10% de desconto no pedido', percentBp: 1000, expiresAt: '2099-12-31T23:59:59.000Z' },
    { code: 'MINT25', description: '25% de desconto na primeira compra', percentBp: 2500, expiresAt: '2099-12-31T23:59:59.000Z' },
    { code: 'EXPIRADO', description: '15% de desconto (campanha encerrada)', percentBp: 1500, expiresAt: '2026-01-31T23:59:59.000Z' },
  ]
}

export const NETWORK_FEES_ETH = {
  ethereum: { base: '0.0021', perExtraLine: '0.0004' },
  polygon: { base: '0.0003', perExtraLine: '0.00005' },
  arbitrum: { base: '0.0004', perExtraLine: '0.00008' },
  base: { base: '0.0002', perExtraLine: '0.00004' },
} as const
