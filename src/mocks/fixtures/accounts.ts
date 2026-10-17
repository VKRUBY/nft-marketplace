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
      username: 'ana.coleciona',
      email: 'ana@kurio.test',
      ensName: 'ana',
      walletNickname: 'Principal',
      avatarUrl: null,
      createdAt: created,
      updatedAt: created,
      passwordSalt: 'salt-ana-01',
      passwordHash: 'bc82e10dcf8c862c7924d0fefb80e1f4fb29123e5c157ca55fa9f46a1c3286b7',
    },
    {
      id: 'usr_bruno',
      name: 'Bruno Costa',
      username: 'brunocosta',
      email: 'bruno@kurio.test',
      ensName: null,
      walletNickname: 'Carteira do Bruno',
      avatarUrl: null,
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
        displayName: 'Ana Ribeiro',
        nickname: 'Principal',
        network: 'ethereum',
        profileName: 'ana.coleciona',
        address: '0xA91F3c9a1b2d4e6f708192a3b4c5d6e7f809E82C',
        secondaryAddress: null,
        provider: 'metamask',
        referralCode: null,
        email: 'ana@kurio.test',
        ensName: 'ana',
        createdAt: created,
        updatedAt: created,
      },
      {
        id: 'wal_ana_alt',
        role: 'secondary',
        displayName: 'Ana Ribeiro',
        nickname: 'Reserva',
        network: 'polygon',
        profileName: 'ana.reserva',
        address: '0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
        secondaryAddress: 'nova.kurio.eth',
        provider: 'coinbase',
        referralCode: 'KURIO-2026',
        email: 'ana@kurio.test',
        ensName: 'nova',
        createdAt: created,
        updatedAt: created,
      },
    ],
    usr_bruno: [
      {
        id: 'wal_bruno_main',
        role: 'primary',
        displayName: 'Bruno Costa',
        nickname: 'Carteira do Bruno',
        network: 'ethereum',
        profileName: 'brunocosta',
        address: '0x9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d',
        secondaryAddress: null,
        provider: 'walletconnect',
        referralCode: null,
        email: 'bruno@kurio.test',
        ensName: null,
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

/** KURIO10 válido; LANCAMENTO25 válido; EXPIRADO vencido. Qualquer outro código é inválido. */
export function buildCoupons(): CouponRecord[] {
  return [
    { code: 'KURIO10', description: '10% de desconto no pedido', percentBp: 1000, expiresAt: '2099-12-31T23:59:59.000Z' },
    { code: 'LANCAMENTO25', description: '25% de desconto do lançamento', percentBp: 2500, expiresAt: '2099-12-31T23:59:59.000Z' },
    { code: 'EXPIRADO', description: '15% de desconto (campanha encerrada)', percentBp: 1500, expiresAt: '2026-01-31T23:59:59.000Z' },
  ]
}

/** Taxa estimada por rede: base + adicional por linha a partir da segunda. */
export const NETWORK_FEES_ETH = {
  ethereum: { base: '0.012', perExtraLine: '0.002' },
  polygon: { base: '0.0004', perExtraLine: '0.0001' },
  solana: { base: '0.0002', perExtraLine: '0.00005' },
} as const
