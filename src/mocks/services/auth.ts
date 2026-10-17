import type { AuthResponse, LoginInput, RegisterInput, Session } from '@/contracts/domain'
import { db, findUser, persist, publicUser, type SessionRecord } from '../db'
import { MockApiError } from '../errors'
import type { UserRecord } from '../fixtures/accounts'
import { getScenario } from '../scenarios'

export async function hashPassword(salt: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return `gm_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

function toSession(record: SessionRecord): Session {
  const user = findUser(record.userId)
  if (!user) throw new MockApiError('UNAUTHENTICATED', 'Sessão inválida.')
  return { user: publicUser(user), expiresAt: new Date(record.expiresAt).toISOString() }
}

function openSession(user: UserRecord): AuthResponse {
  const record: SessionRecord = {
    token: randomToken(),
    userId: user.id,
    expiresAt: Date.now() + getScenario().sessionTtlMs,
  }
  db.sessions.push(record)
  persist()
  return { token: record.token, session: toSession(record) }
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = db.users.find((u) => u.email === input.email.toLowerCase())
  const hash = user ? await hashPassword(user.passwordSalt, input.password) : null
  if (!user || hash !== user.passwordHash) {
    throw new MockApiError('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
  }
  return openSession(user)
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const fieldErrors: Record<string, string> = {}
  if (db.users.some((u) => u.email === input.email)) fieldErrors.email = 'Este e-mail já está cadastrado.'
  if (db.users.some((u) => u.username === input.username)) fieldErrors.username = 'Este nome de usuário já está em uso.'
  if (fieldErrors.email) throw new MockApiError('EMAIL_TAKEN', 'Já existe uma conta com este e-mail.', fieldErrors)
  if (fieldErrors.username) throw new MockApiError('USERNAME_TAKEN', 'Nome de usuário indisponível.', fieldErrors)

  const now = new Date().toISOString()
  const salt = crypto.randomUUID()
  const user: UserRecord = {
    id: `usr_${crypto.randomUUID().slice(0, 8)}`,
    name: input.username,
    username: input.username,
    email: input.email,
    ensName: null,
    walletNickname: null,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    passwordSalt: salt,
    passwordHash: await hashPassword(salt, input.password),
  }
  db.users.push(user)
  db.favorites[user.id] = []
  db.wallets[user.id] = []
  return openSession(user)
}

/** Resolve o usuário do cabeçalho Authorization; lança 401 se ausente, inválido ou expirado. */
export function requireSession(authorization: string | null): SessionRecord {
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!token) throw new MockApiError('UNAUTHENTICATED', 'Faça login para continuar.')
  const record = db.sessions.find((s) => s.token === token)
  if (!record) throw new MockApiError('UNAUTHENTICATED', 'Sessão inválida. Faça login novamente.')
  if (record.expiresAt <= Date.now()) {
    throw new MockApiError('SESSION_EXPIRED', 'Sua sessão expirou. Faça login novamente.')
  }
  return record
}

/** Versão tolerante: sem token → visitante; token inválido/expirado → 401. */
export function optionalSession(authorization: string | null): SessionRecord | null {
  if (!authorization) return null
  return requireSession(authorization)
}

export function getSession(authorization: string | null): Session {
  return toSession(requireSession(authorization))
}

export function logout(authorization: string | null): void {
  const token = authorization?.replace(/^Bearer\s+/i, '')
  db.sessions = db.sessions.filter((s) => s.token !== token)
  persist()
}

/** Controle de teste: expira imediatamente todas as sessões (ou as de um usuário). */
export function expireSessions(userId?: string): number {
  let count = 0
  for (const s of db.sessions) {
    if (!userId || s.userId === userId) {
      s.expiresAt = Date.now() - 1
      count++
    }
  }
  persist()
  return count
}

export function userIdForToken(token: string | null): string | null {
  if (!token) return null
  const record = db.sessions.find((s) => s.token === token)
  return record && record.expiresAt > Date.now() ? record.userId : null
}
