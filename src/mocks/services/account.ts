import type {
  AvatarUpdateInput,
  Favorites,
  Network,
  PasswordChangeInput,
  ProfileUpdateInput,
  User,
  Wallet,
  WalletConnection,
  WalletInput,
} from '@/contracts/domain'
import { db, findNft, findUser, persist, publicUser } from '../db'
import { MockApiError } from '../errors'
import { newId } from '../rng'
import { getScenario } from '../scenarios'
import { hashPassword } from './auth'

// ─── Perfil ─────────────────────────────────────────────────────────────────

function requireUser(userId: string) {
  const user = findUser(userId)
  if (!user) throw new MockApiError('UNAUTHENTICATED', 'Conta não encontrada.')
  return user
}

export function getProfile(userId: string): User {
  return publicUser(requireUser(userId))
}

export function updateProfile(userId: string, input: ProfileUpdateInput): User {
  const user = requireUser(userId)
  if (input.email && db.users.some((u) => u.id !== userId && u.email === input.email)) {
    throw new MockApiError('EMAIL_TAKEN', 'Este e-mail já está em uso.', { email: 'Este e-mail já está em uso.' })
  }
  if (input.username && db.users.some((u) => u.id !== userId && u.username === input.username)) {
    throw new MockApiError('USERNAME_TAKEN', 'Nome de usuário indisponível.', {
      username: 'Este nome de usuário já está em uso.',
    })
  }
  Object.assign(user, input, { updatedAt: new Date().toISOString() })
  persist()
  return publicUser(user)
}

export function updateAvatar(userId: string, input: AvatarUpdateInput): User {
  const user = requireUser(userId)
  user.avatarUrl = input.dataUrl
  user.updatedAt = new Date().toISOString()
  persist()
  return publicUser(user)
}

export async function changePassword(userId: string, input: PasswordChangeInput): Promise<void> {
  const user = requireUser(userId)
  if ((await hashPassword(user.passwordSalt, input.currentPassword)) !== user.passwordHash) {
    throw new MockApiError('INVALID_PASSWORD', 'A senha atual está incorreta.', {
      currentPassword: 'Senha atual incorreta.',
    })
  }
  user.passwordSalt = crypto.randomUUID()
  user.passwordHash = await hashPassword(user.passwordSalt, input.newPassword)
  user.updatedAt = new Date().toISOString()
  persist()
}

// ─── Favoritos ──────────────────────────────────────────────────────────────

export function getFavorites(userId: string): Favorites {
  return { nftIds: [...(db.favorites[userId] ?? [])] }
}

export function setFavorite(userId: string, nftId: string, favorite: boolean): Favorites {
  if (!findNft(nftId)) throw new MockApiError('NOT_FOUND', 'NFT não encontrado.')
  const current = new Set(db.favorites[userId] ?? [])
  const changed = favorite ? !current.has(nftId) : current.has(nftId)
  if (favorite) current.add(nftId)
  else current.delete(nftId)
  db.favorites[userId] = [...current]
  if (changed) {
    const nft = db.nfts.find((n) => n.id === nftId)
    if (nft) nft.likes = Math.max(0, nft.likes + (favorite ? 1 : -1))
  }
  persist()
  return getFavorites(userId)
}

// ─── Carteiras ──────────────────────────────────────────────────────────────

export function listWallets(userId: string): Wallet[] {
  const order = { primary: 0, secondary: 1 }
  return [...(db.wallets[userId] ?? [])].sort((a, b) => order[a.role] - order[b.role])
}

function assertUniqueness(userId: string, input: WalletInput, ignoreId?: string) {
  const wallets = db.wallets[userId] ?? []
  if (wallets.some((w) => w.id !== ignoreId && w.role === input.role)) {
    throw new MockApiError(
      'WALLET_ROLE_TAKEN',
      input.role === 'primary' ? 'Você já tem uma carteira principal.' : 'Você já tem uma carteira secundária.',
      { role: 'Já existe uma carteira com este papel.' },
    )
  }
  if (wallets.some((w) => w.id !== ignoreId && w.address.toLowerCase() === input.address.toLowerCase())) {
    throw new MockApiError('VALIDATION_ERROR', 'Este endereço já está cadastrado.', {
      address: 'Endereço já cadastrado em outra carteira.',
    })
  }
}

export function createWallet(userId: string, input: WalletInput): Wallet {
  assertUniqueness(userId, input)
  const now = new Date().toISOString()
  const wallet: Wallet = {
    id: newId('wal'),
    role: input.role,
    label: input.label,
    provider: input.provider,
    address: input.address,
    ens: input.ens ?? null,
    networks: input.networks,
    createdAt: now,
    updatedAt: now,
  }
  db.wallets[userId] = [...(db.wallets[userId] ?? []), wallet]
  persist()
  return wallet
}

export function updateWallet(userId: string, walletId: string, input: WalletInput): Wallet {
  const wallets = db.wallets[userId] ?? []
  const wallet = wallets.find((w) => w.id === walletId)
  if (!wallet) throw new MockApiError('NOT_FOUND', 'Carteira não encontrada.')
  assertUniqueness(userId, input, walletId)
  Object.assign(wallet, {
    role: input.role,
    label: input.label,
    provider: input.provider,
    address: input.address,
    ens: input.ens ?? null,
    networks: input.networks,
    updatedAt: new Date().toISOString(),
  })
  // Endereço ou redes mudaram: a conexão anterior deixa de valer.
  delete db.walletConnections[walletId]
  persist()
  return wallet
}

export function connectWallet(userId: string, walletId: string, network: Network): WalletConnection {
  const wallet = db.wallets[userId]?.find((w) => w.id === walletId)
  if (!wallet) throw new MockApiError('NOT_FOUND', 'Carteira não encontrada.')
  if (!wallet.networks.includes(network)) {
    throw new MockApiError('WALLET_REJECTED', 'Esta carteira não está habilitada para a rede escolhida.', {
      network: 'Rede não suportada por esta carteira.',
    })
  }
  if (getScenario().walletRejects) {
    throw new MockApiError('WALLET_REJECTED', 'A conexão foi recusada na carteira.')
  }
  const connection: WalletConnection = {
    walletId,
    network,
    status: 'connected',
    connectedAt: new Date().toISOString(),
  }
  db.walletConnections[walletId] = connection
  persist()
  return connection
}

export function disconnectWallet(userId: string, walletId: string): WalletConnection {
  const wallet = db.wallets[userId]?.find((w) => w.id === walletId)
  if (!wallet) throw new MockApiError('NOT_FOUND', 'Carteira não encontrada.')
  const previous = db.walletConnections[walletId]
  const connection: WalletConnection = {
    walletId,
    network: previous?.network ?? wallet.networks[0] ?? 'ethereum',
    status: 'disconnected',
    connectedAt: null,
  }
  db.walletConnections[walletId] = connection
  persist()
  return connection
}

export function getWalletConnection(userId: string, walletId: string): WalletConnection | null {
  if (!db.wallets[userId]?.some((w) => w.id === walletId)) return null
  return db.walletConnections[walletId] ?? null
}
