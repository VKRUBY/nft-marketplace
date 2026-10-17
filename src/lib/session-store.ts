/**
 * Credenciais do navegador.
 *
 * - Token da sessão: localStorage (sobrevive a refresh). Em produção seria um
 *   cookie httpOnly; aqui a API é simulada no próprio navegador pelo MSW, então
 *   não há servidor para emiti-lo — decisão registrada em ARCHITECTURE.md.
 * - Id do carrinho de visitante: uuid estável enviado em `X-Guest-Cart`.
 *
 * Mudanças de sessão são propagadas para outras abas via evento `storage`.
 */

const TOKEN_KEY = 'greenmint:session-token'
const GUEST_CART_KEY = 'greenmint:guest-cart'

type Listener = (token: string | null) => void
const listeners = new Set<Listener>()

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* modo privado sem storage: segue só em memória */
  }
}

let token: string | null = read(TOKEN_KEY)

export const sessionStore = {
  getToken: () => token,
  setToken(next: string | null) {
    if (next === token) return
    token = next
    write(TOKEN_KEY, next)
    for (const l of listeners) l(next)
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getGuestCartId(): string {
    let id = read(GUEST_CART_KEY)
    if (!id) {
      id = crypto.randomUUID()
      write(GUEST_CART_KEY, id)
    }
    return id
  },
  /** Após a mesclagem no login, o visitante passa a usar um carrinho novo. */
  rotateGuestCartId() {
    write(GUEST_CART_KEY, crypto.randomUUID())
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return
    token = event.newValue
    for (const l of listeners) l(token)
  })
}
