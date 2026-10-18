/**
 * Substituto mínimo de `tough-cookie` para o bundle do navegador.
 *
 * O MSW usa tough-cookie (e, por tabela, tldts com a Public Suffix List)
 * apenas para guardar cookies vindos de `Set-Cookie` em respostas mockadas e
 * reenviá-los nas requisições seguintes. Esta API simulada não usa cookies —
 * a sessão é um Bearer token — então o jar fica sempre vazio. O alias em
 * vite.config.ts troca o pacote por este arquivo e tira ~250 KB (brutos) do
 * chunk dos mocks, que fica no caminho crítico do boot da demo.
 *
 * Se algum handler passar a emitir `Set-Cookie`, remova o alias.
 */

type Index = Record<string, Record<string, Record<string, Cookie>>>

export class Cookie {
  static fromJSON(): Cookie | null {
    return null
  }
  toJSON(): Record<string, unknown> {
    return {}
  }
}

export class MemoryCookieStore {
  idx: Index = {}
}

export class CookieJar {
  constructor(_store?: MemoryCookieStore) {}
  getCookiesSync(): Cookie[] {
    return []
  }
  async setCookie(): Promise<void> {}
}

export type SerializedCookie = Record<string, unknown>
export type MemoryCookieStoreIndex = Index
