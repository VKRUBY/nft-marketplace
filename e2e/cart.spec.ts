import { expect, test } from './fixtures'

/** GET /api/cart pelo próprio app (MSW roda no navegador): resposta bruta da API. */
async function fetchCart(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const guest = localStorage.getItem('greenmint:guest-cart') ?? ''
    const token = localStorage.getItem('greenmint:session-token')
    const res = await fetch('/api/cart', {
      headers: { 'X-Guest-Cart': guest, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    return res.json() as Promise<{ summary: Record<string, string | number>; items: Array<{ unitPriceEth: string; lineTotalEth: string }> }>
  })
}

test.describe('Carrinho', () => {
  test('adicionar, alterar quantidade e remover; totais vêm da API', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042')
    await app.addToCart('sage-nomad-009')
    await page.goto('/carrinho')
    await expect(app.cartRows()).toHaveCount(2)

    const row = app.cartRows().filter({ hasText: 'Emerald Ape #042' })
    await row.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(row.locator('output')).toHaveText('2')

    // O resumo exibido é exatamente o que a API calculou.
    await expect(async () => {
      const cart = await fetchCart(page)
      expect(cart.items.length).toBe(2)
      await expect(app.summary('total')).toContainText(`${Number(cart.summary.totalEth).toString()}`, { timeout: 1 })
    }).toPass()

    await row.getByRole('button', { name: 'Remover Emerald Ape #042 do carrinho' }).click()
    await expect(app.cartRows()).toHaveCount(1)
    await expect(app.cartRows().first()).toContainText('Sage Nomad #009')

    await app.cartRows().first().getByRole('button', { name: /^Remover / }).click()
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })

  test('carrinho persiste após refresh', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042', { quantity: 3 })
    await page.goto('/carrinho')
    await page.reload()
    const row = app.cartRows().first()
    await expect(row).toContainText('Emerald Ape #042')
    await expect(row.locator('output')).toHaveText('3')
  })

  test('valores em ETH são strings decimais com precisão total', async ({ app, page }) => {
    await app.open('/')
    const nft = await app.nft('emerald-ape-042')
    const edition = nft.editions.find((e) => e.label === '1/50')!
    await app.gm((g, a) => g.updateEdition(a.nft, a.edition, { priceEth: '1.000000000000000001' }), { nft: nft.id, edition: edition.id })
    await app.addToCart('emerald-ape-042', { quantity: 3 })
    const cart = await fetchCart(page)
    expect(cart.items[0]!.unitPriceEth).toBe('1.000000000000000001')
    expect(cart.items[0]!.lineTotalEth).toBe('3.000000000000000003')
    expect(cart.summary.subtotalEth).toBe('3.000000000000000003')
    for (const [key, value] of Object.entries(cart.summary)) {
      if (key.endsWith('Eth')) expect(value, key).toMatch(/^\d+(\.\d+)?$/)
    }
  })

  test('cupom inválido, expirado e válido', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042')
    await page.goto('/carrinho')
    const input = app.visible(page.getByLabel('Código promocional'))
    const apply = app.visible(page.getByRole('button', { name: 'Aplicar' }))

    await input.fill('NAOEXISTE')
    await apply.click()
    await expect(page.getByRole('alert').filter({ hasText: 'Cupom não encontrado.' })).toBeVisible()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAccessibleDescription('Cupom não encontrado.')

    await input.fill('EXPIRADO')
    await apply.click()
    await expect(page.getByRole('alert').filter({ hasText: 'Cupom expirado.' })).toBeVisible()

    const before = await fetchCart(page)
    expect(before.summary.discountEth).toBe('0')
    await input.fill('kurio10')
    await apply.click()
    await expect(page.getByRole('button', { name: 'Remover cupom KURIO10' })).toBeVisible()
    const after = await fetchCart(page)
    expect(after.summary.discountEth).not.toBe('0')
    await expect(app.summary('discount')).toContainText(Number(after.summary.discountEth).toString())

    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(app.visible(page.getByLabel('Código promocional'))).toBeVisible()
  })

  test('mudança de preço e estoque em tempo real aparece no carrinho', async ({ app, page }) => {
    await app.open('/')
    const nft = await app.nft('emerald-ape-042')
    const edition = nft.editions.find((e) => e.label === '1/50')!
    await app.addToCart('emerald-ape-042')
    await page.goto('/carrinho')
    await expect(app.cartRows()).toHaveCount(1)

    await app.gm((g, a) => g.updateEdition(a.nft, a.edition, { priceEth: '1.5' }), { nft: nft.id, edition: edition.id })
    const alert = page.getByRole('alert').filter({ hasText: 'Alguns itens mudaram enquanto você navegava' })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('mudou de 1.19 para 1.50 ETH')
    await alert.getByRole('button', { name: 'Aceitar valores atuais' }).click()
    await expect(alert).toBeHidden()
    await expect(app.cartRows().first()).toContainText('1.50 ETH')

    await app.gm((g, a) => g.updateEdition(a.nft, a.edition, { available: 0 }), { nft: nft.id, edition: edition.id })
    await expect(page.getByRole('alert').filter({ hasText: 'esgotou' })).toBeVisible()
  })
})
