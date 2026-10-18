import type { Page } from '@playwright/test'
import { ANA, BRUNO, expect, test } from './fixtures'

/**
 * Contratos da API simulada vistos de fora: envelope de erro, idempotência,
 * isolamento entre contas, 403 e reset para um estado conhecido.
 *
 * As chamadas diretas usam `fetch` dentro da página — passam pelo service
 * worker do MSW exatamente como as requisições do app.
 */
type ApiResult = { status: number; body: { error?: { code: string; message: string; retryable: boolean; fieldErrors?: Record<string, string> } } & Record<string, unknown> }

function api(page: Page, method: string, path: string, { body, headers = {}, auth = true }: { body?: unknown; headers?: Record<string, string>; auth?: boolean } = {}) {
  return page.evaluate(
    async ([m, p, b, h, useAuth]) => {
      const token = useAuth ? localStorage.getItem('greenmint:session-token') : null
      const res = await fetch(`/api${p}`, {
        method: m,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...h },
        body: b === undefined ? undefined : JSON.stringify(b),
      })
      return { status: res.status, body: await res.json().catch(() => ({})) }
    },
    [method, path, body, headers, auth] as const,
  ) as Promise<ApiResult>
}

test.describe('Contratos', () => {
  test('envelope de erro único: 400 com erros por campo, 401 e 404', async ({ app, page }) => {
    await app.open('/')

    const invalid = await api(page, 'POST', '/auth/login', { body: { email: 'x' } })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error).toMatchObject({ code: 'VALIDATION_ERROR', retryable: false })
    expect(Object.keys(invalid.body.error!.fieldErrors ?? {})).toEqual(expect.arrayContaining(['email', 'password']))

    const unauthenticated = await api(page, 'GET', '/me/profile', { auth: false })
    expect(unauthenticated.status).toBe(401)
    expect(unauthenticated.body.error?.code).toBe('UNAUTHENTICATED')

    const missing = await api(page, 'GET', '/nfts/nao-existe')
    expect(missing.status).toBe(404)
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', retryable: false })
  })

  test('idempotência: mesma chave e conteúdo devolve o mesmo pedido; conteúdo diferente é conflito', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    const sent = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/orders')
    const orderId = await app.placeOrder()
    const request = await sent
    const key = request.headers()['idempotency-key']
    expect(key).toMatch(/^[\w-]{16,}$/)
    const body = request.postDataJSON() as { buyer: { note: string | null } }

    const replay = await api(page, 'POST', '/orders', { body, headers: { 'Idempotency-Key': key! } })
    expect(replay.status).toBe(200)
    expect(replay.body.id).toBe(orderId)

    const changed = await api(page, 'POST', '/orders', {
      body: { ...body, buyer: { ...body.buyer, note: 'outro conteúdo' } },
      headers: { 'Idempotency-Key': key! },
    })
    expect(changed.status).toBe(409)
    expect(changed.body.error?.code).toBe('IDEMPOTENCY_CONFLICT')

    const missingKey = await api(page, 'POST', '/orders', { body })
    expect(missingKey.status).toBe(400)

    expect(await app.userOrders()).toHaveLength(1)
  })

  test('pedido de outra conta não é exibido nem acessível pela API', async ({ app, page }) => {
    await app.open('/')
    await app.login(ANA)
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    const orderId = await app.placeOrder()

    await page.goto('/perfil')
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    await app.login(BRUNO)

    await page.goto(`/pedido/${encodeURIComponent(orderId)}`)
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
    await expect(app.orderStatus()).toHaveCount(0)

    const direct = await api(page, 'GET', `/orders/${encodeURIComponent(orderId)}`)
    expect(direct.status).toBe(403)
    expect(direct.body.error?.code).toBe('FORBIDDEN')
  })

  test('403 na área privada mostra erro explicativo com nova tentativa', async ({ app, page }) => {
    await app.open('/', { scenario: 'forbidden' })
    await app.login()
    await page.goto('/perfil')
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o perfil.' })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('permissão')
    await expect(alert.getByRole('button', { name: 'Tentar novamente' })).toBeVisible()
  })

  test('reset restaura o estado conhecido do cenário', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042')
    const nft = await app.nft('emerald-ape-042')
    const edition = nft.editions.find((e) => e.label === '1/50')!
    const seedPrice = edition.priceEth
    await app.gm((g, a) => g.updateEdition(a.nftId, a.editionId, { priceEth: '9.99' }), { nftId: nft.id, editionId: edition.id })

    await page.goto('/nft/emerald-ape-042')
    await expect(page.locator('main [data-price]').first()).toHaveAttribute('data-price', '9.99')

    await app.open('/nft/emerald-ape-042')
    await expect(page.locator('main [data-price]').first()).toHaveAttribute('data-price', seedPrice)
    const carts = Object.values((await app.db()).carts)
    expect(carts.flatMap((c) => c.lines)).toHaveLength(0)
  })
})
