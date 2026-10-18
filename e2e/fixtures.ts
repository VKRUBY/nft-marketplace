import { test as base, expect, type Locator, type Page } from '@playwright/test'

/**
 * Helpers compartilhados pelos testes E2E.
 *
 * Toda manipulação de "servidor" passa por `window.__greenmint` (controles do
 * MSW): o teste muda o banco simulado ou dispara eventos, e a aplicação
 * reage pelas respostas REST e pelo Socket.IO, como em produção.
 */

export const ANA = { email: 'ana@kurio.test', password: 'Mint@2026', name: 'Ana' }
export const BRUNO = { email: 'bruno@kurio.test', password: 'Mint@2026', name: 'Bruno' }

/** Subconjunto tipado dos controles expostos pelo app (src/mocks/controls.ts). */
export interface Controls {
  setScenario(id: string): void
  reset(): void
  updateEdition(nftId: string, editionId: string, patch: { priceEth?: string; available?: number }): number
  replayNftEvent(nftId: string, which: 'last' | 'previous'): void
  dropRealtime(): void
  setRealtimeBlocked(blocked: boolean): void
  realtimeConnections(): number
  expireSessions(userId?: string): number
  snapshot(): MockDb
}

export interface MockDb {
  users: Array<{ id: string; email: string; passwordHash: string; passwordSalt: string }>
  nfts: Array<{ id: string; slug: string; name: string; editions: Array<{ id: string; label: string; priceEth: string; available: number; maxPerOrder: number }> }>
  orders: Record<string, { id: string; userId: string; status: string; idempotencyKey: string; lines: Array<{ nftId: string; editionId: string; quantity: number }> }>
  carts: Record<string, { owner: 'guest' | 'user'; ownerId: string; lines: Array<{ nftId: string; editionId: string; quantity: number }> }>
}

declare global {
  interface Window {
    __greenmint?: Controls
  }
}

export class App {
  constructor(
    readonly page: Page,
    readonly isMobile: boolean,
  ) {}

  /** Abre o app num cenário e com o banco simulado restaurado ao seed. */
  async open(path = '/', { scenario = 'fast' }: { scenario?: string } = {}) {
    const sep = path.includes('?') ? '&' : '?'
    await this.page.goto(`${path}${sep}scenario=${scenario}&mock-reset=1`)
    await this.page.waitForFunction(() => Boolean(window.__greenmint))
    // Os parâmetros de cenário são removidos da URL após o boot.
    await expect(this.page).not.toHaveURL(/mock-reset/)
  }

  /** Executa uma função com os controles do servidor simulado. */
  async gm<R, A = undefined>(fn: (g: Controls, arg: A) => R, arg?: A): Promise<Awaited<R>> {
    // Após uma navegação, os mocks reiniciam: espera os controles existirem.
    await this.page.waitForFunction(() => Boolean(window.__greenmint))
    return this.page.evaluate(
      ([source, a]) => {
        const f = new Function(`return (${source})`)() as (g: Controls, arg: unknown) => unknown
        return f(window.__greenmint!, a)
      },
      [fn.toString(), arg] as const,
    ) as Promise<Awaited<R>>
  }

  db() {
    return this.gm((g) => g.snapshot())
  }

  async nft(slug: string) {
    const db = await this.db()
    const nft = db.nfts.find((n) => n.slug === slug)
    if (!nft) throw new Error(`NFT ${slug} não encontrado no seed`)
    return nft
  }

  async login(user = ANA, { from = '/login' }: { from?: string } = {}) {
    if (from) await this.page.goto(from)
    const dialog = this.page.getByRole('dialog')
    await dialog.getByPlaceholder('contato@email.com').fill(user.email)
    await dialog.getByPlaceholder('Senha').fill(user.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog).toBeHidden()
  }

  /** Adiciona uma edição ao carrinho pela página de detalhe. */
  async addToCart(slug: string, { edition, quantity = 1 }: { edition?: string; quantity?: number } = {}) {
    await this.page.goto(`/nft/${slug}${edition ? `?edicao=${encodeURIComponent(edition)}` : ''}`)
    await expect(this.page.getByRole('heading', { level: 1 })).toBeVisible()
    const stepper = this.visible(this.page.getByRole('group', { name: /^Quantidade de / }))
    for (let i = 1; i < quantity; i++) await stepper.getByRole('button', { name: 'Aumentar quantidade' }).click()
    const button = this.isMobile
      ? this.page.getByRole('button', { name: 'Adicionar ao carrinho' })
      : this.page.getByRole('button', { name: 'COMPRAR' })
    await button.click()
    await expect(this.page.getByText(/adicionado ao carrinho/).first()).toBeVisible()
  }

  /**
   * Executa ações nos filtros do catálogo: barra lateral no desktop, drawer
   * no mobile (aberto e fechado em volta da ação).
   */
  async filters<T>(fn: (scope: Locator) => Promise<T>): Promise<T> {
    let scope: Locator
    if (this.isMobile) {
      await this.page.getByRole('button', { name: /^Filtros/ }).click()
      scope = this.page.getByRole('dialog', { name: 'Filtros' })
      await expect(scope).toBeVisible()
    } else {
      scope = this.page.getByRole('complementary', { name: 'Filtros do catálogo' })
    }
    const result = await fn(scope)
    if (this.isMobile) {
      await this.page.keyboard.press('Escape')
      await expect(scope).toBeHidden()
    }
    return result
  }

  filterButton(scope: Locator, group: string, option: string | RegExp) {
    return scope.getByRole('region', { name: group }).getByRole('button', { name: option })
  }

  async sortBy(label: string) {
    const pick = async (scope: Locator) => {
      await this.visible(scope.getByRole('combobox', { name: 'Ordenar por:' })).click()
      await this.page.getByRole('option', { name: label }).click()
    }
    if (this.isMobile) await this.filters(pick)
    else await pick(this.page.locator('#catalogo'))
  }

  async search(q: string) {
    if (this.isMobile) {
      const box = this.page.getByRole('searchbox', { name: 'Explorar coleções' })
      await box.fill(q)
      await box.press('Enter')
    } else {
      await this.page.getByRole('button', { name: 'Buscar NFTs' }).click()
      const box = this.page.getByRole('dialog', { name: 'Buscar NFTs' }).getByRole('searchbox')
      await box.fill(q)
      await box.press('Enter')
    }
  }

  cartRows() {
    return this.page.locator('[data-testid="cart-row"]:visible')
  }

  /** Primeiro elemento visível do locator (desktop e mobile renderizam variantes). */
  visible(locator: Locator) {
    return locator.locator('visible=true').first()
  }

  summary(name: 'subtotal' | 'discount' | 'fee' | 'total') {
    return this.visible(this.page.getByTestId(`summary-${name}`))
  }

  /** Abre o pagamento e espera a cotação. */
  async openCheckout() {
    await this.page.goto('/pagamento')
    await expect(this.confirmButton()).toBeEnabled({ timeout: 10_000 })
  }

  /** No mobile, os campos do comprador ficam recolhidos atrás de um botão. */
  async openBuyerForm() {
    const toggle = this.page.getByRole('button', { name: 'Perfil do colecionador' })
    if (this.isMobile && (await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  }

  reviewDialog() {
    return this.page.getByRole('dialog', { name: 'Revise seu pedido' })
  }

  confirmButton() {
    return this.page.getByRole('button', { name: 'Confirmar compra' })
  }

  /** Revisão → envio. Retorna o id do pedido pela URL. */
  async placeOrder() {
    await this.confirmButton().click()
    const review = this.page.getByRole('dialog', { name: 'Revise seu pedido' })
    await expect(review).toBeVisible()
    await review.getByRole('button', { name: 'Confirmar e enviar' }).click()
    await this.page.waitForURL(/\/pedido\//, { timeout: 15_000 })
    return decodeURIComponent(new URL(this.page.url()).pathname.split('/').pop()!)
  }

  orderStatus() {
    return this.page.locator('[data-order-status]')
  }

  async userOrders(userId = 'usr_ana') {
    const db = await this.db()
    return Object.values(db.orders).filter((o) => o.userId === userId)
  }
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use, testInfo) => {
    await use(new App(page, testInfo.project.name === 'mobile'))
  },
})

export { expect }
