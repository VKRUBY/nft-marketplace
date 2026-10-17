import type { CreateOrderInput } from '@/contracts/domain'

/**
 * Tentativa de pedido persistida em sessionStorage.
 *
 * A chave de idempotência nasce junto com o conteúdo exato do pedido e é
 * reutilizada em qualquer reenvio desse mesmo conteúdo — clique repetido,
 * retry automático após timeout ou recarregar a página no meio do envio.
 * Assim o servidor devolve o mesmo pedido em vez de criar outro. Se o
 * conteúdo muda (nova cotação, outra carteira), nasce uma chave nova.
 */
export interface OrderAttempt {
  key: string
  fingerprint: string
  input: CreateOrderInput
  createdAt: number
  /** Preenchido assim que o servidor confirma a criação. */
  orderId: string | null
}

const storageKey = (userId: string) => `kurio:order-attempt:${userId}`

function fingerprint(input: CreateOrderInput): string {
  return JSON.stringify(input)
}

export const orderAttempts = {
  get(userId: string): OrderAttempt | null {
    try {
      const raw = sessionStorage.getItem(storageKey(userId))
      return raw ? (JSON.parse(raw) as OrderAttempt) : null
    } catch {
      return null
    }
  },
  /** Reaproveita a tentativa se o conteúdo for idêntico; senão cria outra. */
  forInput(userId: string, input: CreateOrderInput): OrderAttempt {
    const current = this.get(userId)
    const fp = fingerprint(input)
    if (current && current.fingerprint === fp && !current.orderId) return current
    const attempt: OrderAttempt = { key: crypto.randomUUID(), fingerprint: fp, input, createdAt: Date.now(), orderId: null }
    this.save(userId, attempt)
    return attempt
  },
  markCreated(userId: string, orderId: string) {
    const current = this.get(userId)
    if (current) this.save(userId, { ...current, orderId })
  },
  clear(userId: string) {
    try {
      sessionStorage.removeItem(storageKey(userId))
    } catch {
      /* sem storage */
    }
  },
  save(userId: string, attempt: OrderAttempt) {
    try {
      sessionStorage.setItem(storageKey(userId), JSON.stringify(attempt))
    } catch {
      /* sem storage: segue em memória pela mutation */
    }
  },
}

/** Rascunho do formulário do checkout: sobrevive a expiração de sessão e refresh. */
export const checkoutDraft = {
  key: (userId: string) => `kurio:checkout-draft:${userId}`,
  load<T>(userId: string): Partial<T> | null {
    try {
      const raw = sessionStorage.getItem(this.key(userId))
      return raw ? (JSON.parse(raw) as Partial<T>) : null
    } catch {
      return null
    }
  },
  save(userId: string, value: unknown) {
    try {
      sessionStorage.setItem(this.key(userId), JSON.stringify(value))
    } catch {
      /* sem storage */
    }
  },
  clear(userId: string) {
    try {
      sessionStorage.removeItem(this.key(userId))
    } catch {
      /* sem storage */
    }
  },
}
