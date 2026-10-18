import { ANA, BRUNO, expect, test } from './fixtures'

const heading = (page: import('@playwright/test').Page) => page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })

test.describe('Tempo real', () => {
  test('evento nft.updated atualiza o detalhe; duplicatas e eventos antigos não regridem', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042', { scenario: 'realtime-chaos' })
    await expect(heading(page)).toBeVisible()
    const nft = await app.nft('emerald-ape-042')
    const edition = nft.editions.find((e) => e.label === '1/50')!
    const main = page.getByRole('main')
    await expect(main).toContainText('1.19 ETH')

    await app.gm((g, a) => g.updateEdition(a.nft, a.edition, { priceEth: '2.5' }), { nft: nft.id, edition: edition.id })
    await expect(main).toContainText('2.50 ETH')
    await app.gm((g, a) => g.updateEdition(a.nft, a.edition, { priceEth: '2.75' }), { nft: nft.id, edition: edition.id })
    await expect(main).toContainText('2.75 ETH')

    // O cenário já reenvia cada evento e uma versão anterior; reenvios manuais também.
    await app.gm((g, id) => g.replayNftEvent(id, 'previous'), nft.id)
    await app.gm((g, id) => g.replayNftEvent(id, 'last'), nft.id)
    await page.waitForTimeout(1000)
    await expect(main).toContainText('2.75 ETH')
    await expect(main).not.toContainText('2.50 ETH')
  })

  test('após reconectar, o app reconcilia via REST o que perdeu na queda', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042')
    await expect(heading(page)).toBeVisible()
    const nft = await app.nft('emerald-ape-042')
    const edition = nft.editions.find((e) => e.label === '1/50')!

    await app.gm((g) => {
      g.setRealtimeBlocked(true)
      g.dropRealtime()
    })
    await app.gm((g, a) => g.updateEdition(a.nft, a.edition, { priceEth: '3.1' }), { nft: nft.id, edition: edition.id })
    await page.waitForTimeout(800)
    await expect(page.getByRole('main')).toContainText('1.19 ETH')

    await app.gm((g) => g.setRealtimeBlocked(false))
    await expect(page.getByRole('main')).toContainText('3.10 ETH', { timeout: 20_000 })
  })

  test('pedido pendente sobrevive a refresh sem socket e não gera segunda compra', async ({ app, page }) => {
    await app.open('/', { scenario: 'slow-payment' })
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    const orderId = await app.placeOrder()
    await expect(app.orderStatus()).toHaveAttribute('data-order-status', 'pending')

    await app.gm((g) => {
      g.setRealtimeBlocked(true)
      g.dropRealtime()
    })
    await page.reload()
    await expect(app.orderStatus()).toHaveAttribute('data-order-status', 'pending')

    // Em outra página, o aviso global leva de volta ao pedido.
    await page.goto('/')
    const banner = page.getByText('Você tem um pedido aguardando confirmação na rede.')
    await expect(banner).toBeVisible()
    await page.goto('/pagamento')
    await expect(page.getByRole('link', { name: 'Acompanhar pedido' })).toHaveAttribute('href', `/pedido/${orderId}`)

    await app.gm((g) => g.setRealtimeBlocked(false))
    await page.goto('/')
    await expect(page.getByText('Compra confirmada')).toBeVisible({ timeout: 30_000 })
    await expect(banner).toBeHidden()

    const orders = await app.userOrders()
    expect(orders).toHaveLength(1)
    expect(orders[0]!.status).toBe('confirmed')
    await page.goto(`/pedido/${orderId}`)
    await expect(app.orderStatus()).toHaveAttribute('data-order-status', 'confirmed')
  })

  test('eventos de um usuário não chegam a outro; listeners não vazam na troca', async ({ app, page }) => {
    await app.open('/', { scenario: 'slow-payment' })
    await app.login(ANA)
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.placeOrder()
    await page.goto('/perfil')
    await app.visible(page.getByRole('button', { name: 'Sair' })).click()
    await expect(page).toHaveURL('/')
    await app.login(BRUNO)
    await page.goto('/')

    await expect.poll(() => app.gm((g) => g.realtimeConnections())).toBe(1)

    // O pedido da Ana é resolvido enquanto Bruno está logado.
    await expect.poll(async () => (await app.userOrders('usr_ana'))[0]?.status, { timeout: 30_000 }).toBe('confirmed')
    await page.waitForTimeout(1000)
    await expect(page.getByText('Compra confirmada')).toHaveCount(0)
    await expect(page.getByText('Você tem um pedido aguardando')).toHaveCount(0)
  })
})
