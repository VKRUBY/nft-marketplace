import { ANA, expect, test } from './fixtures'

test.describe('Pagamento', () => {
  test('exige login e volta ao pagamento depois de entrar', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042')
    await page.goto('/pagamento')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpagamento/)
    await app.login(ANA, { from: '' })
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(app.confirmButton()).toBeEnabled()
  })

  test('validação: erros ligados aos campos e foco no primeiro inválido; nada é enviado', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.openBuyerForm()
    const email = page.getByRole('textbox', { name: /^E-mail/ })
    await email.fill('nao-e-email')
    await app.confirmButton().click()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription(/E-mail inválido/)
    await expect(email).toBeFocused()
    await expect(app.reviewDialog()).toBeHidden()
    expect(await app.userOrders()).toHaveLength(0)
  })

  test('rede incompatível com a carteira bloqueia a compra', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.openBuyerForm()
    await page.getByRole('combobox', { name: /^Rede/ }).click()
    await page.getByRole('option', { name: 'Polygon' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'está na rede Ethereum' })).toBeVisible()
    await expect(app.confirmButton()).toBeDisabled()
  })

  test('compra confirmada: revisão, confirmação, recibo do snapshot e carrinho limpo', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()

    await app.confirmButton().click()
    const review = app.reviewDialog()
    await expect(review).toBeVisible()
    await expect(review).toContainText('Emerald Ape #042')
    const quoteTotal = (await review.getByTestId('summary-total').textContent())!.trim()
    // O total do pagamento é o mesmo da revisão (desktop: resumo; mobile: rodapé).
    await expect(app.visible(page.getByText(quoteTotal))).toBeVisible()
    await expect(review).toContainText('Principal')
    await review.getByRole('button', { name: 'Confirmar e enviar' }).click()

    await page.waitForURL(/\/pedido\//)
    await expect(app.orderStatus()).toHaveAttribute('data-order-status', 'confirmed', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByRole('main')).toContainText('Emerald Ape #042')
    await expect(page.getByRole('main')).toContainText(quoteTotal)

    const orders = await app.userOrders()
    expect(orders).toHaveLength(1)
    expect(orders[0]!.status).toBe('confirmed')

    // O recibo vem do snapshot do pedido: mudar o preço depois não altera o que foi pago.
    const nft = await app.nft('emerald-ape-042')
    const edition = nft.editions.find((e) => e.label === '1/50')!
    await app.gm((g, a) => g.updateEdition(a.nft, a.edition, { priceEth: '9.99' }), { nft: nft.id, edition: edition.id })
    await page.reload()
    await expect(page.getByRole('main')).toContainText(quoteTotal)
    await expect(page.getByRole('main')).not.toContainText('9.99')

    await page.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })

  test('cliques repetidos não duplicam o pedido', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.confirmButton().click()
    const send = app.reviewDialog().getByRole('button', { name: 'Confirmar e enviar' })
    await send.dblclick()
    // Terceiro clique com o diálogo possivelmente já fechando; não pode virar um segundo pedido.
    await send.click({ force: true, timeout: 1_000 }).catch(() => {})
    await page.waitForURL(/\/pedido\//)
    await expect(app.orderStatus()).toHaveAttribute('data-order-status', 'confirmed', { timeout: 10_000 })
    expect(await app.userOrders()).toHaveLength(1)
  })

  test('timeout depois de criar o pedido: nova tentativa reaproveita a mesma chave', async ({ app, page }) => {
    await app.open('/', { scenario: 'order-timeout' })
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.confirmButton().click()
    await app.reviewDialog().getByRole('button', { name: 'Confirmar e enviar' }).click()
    // Ou o retry automático resolve, ou o usuário tenta de novo pelo diálogo.
    const retry = app.reviewDialog().getByRole('button', { name: 'Tentar novamente' })
    await expect(page.locator('[data-order-status]').or(retry)).toBeVisible({ timeout: 30_000 })
    if (await retry.isVisible()) await retry.click()
    await page.waitForURL(/\/pedido\//, { timeout: 30_000 })
    const orders = await app.userOrders()
    expect(orders).toHaveLength(1)
  })

  test('pagamento recusado mantém o carrinho', async ({ app, page }) => {
    await app.open('/', { scenario: 'payment-declined' })
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.placeOrder()
    await expect(app.orderStatus()).toHaveAttribute('data-order-status', 'declined', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toHaveCount(0)
    await page.goto('/carrinho')
    await expect(app.cartRows()).toHaveCount(1)
  })

  test('carteira recusa conexão: nenhum pedido é criado', async ({ app, page }) => {
    await app.open('/', { scenario: 'wallet-rejected' })
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.confirmButton().click()
    const review = app.reviewDialog()
    await review.getByRole('button', { name: 'Confirmar e enviar' }).click()
    await expect(review.getByRole('alert')).toContainText('Tente conectar de novo ou escolha outra carteira.')
    await expect(page).toHaveURL(/\/pagamento$/)
    expect(await app.userOrders()).toHaveLength(0)
  })

  test('preço muda com a revisão aberta: exige nova confirmação', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.confirmButton().click()
    const review = app.reviewDialog()
    await expect(review).toBeVisible()

    const nft = await app.nft('emerald-ape-042')
    const edition = nft.editions.find((e) => e.label === '1/50')!
    await app.gm((g, a) => g.updateEdition(a.nft, a.edition, { priceEth: '1.25' }), { nft: nft.id, edition: edition.id })

    // A cotação antiga não pode ser enviada: o diálogo avisa e bloqueia o envio.
    await expect(review.getByRole('alert').filter({ hasText: 'Os valores foram atualizados.' })).toBeVisible()
    await expect(review.getByText('Há itens com alterações de preço ou disponibilidade.')).toBeVisible()
    await expect(review.getByRole('button', { name: 'Confirmar novos valores' })).toBeDisabled()

    // Aceita os novos valores no resumo e confirma de novo.
    await review.getByRole('button', { name: 'Voltar' }).click()
    await page.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(app.confirmButton()).toBeEnabled()
    await app.confirmButton().click()
    await expect(review).toContainText('1.25')
    await review.getByRole('button', { name: 'Confirmar e enviar' }).click()
    await page.waitForURL(/\/pedido\//)
    await expect(page.getByRole('main')).toContainText('1.25')
    expect(await app.userOrders()).toHaveLength(1)
  })

  test('cenário price-change: cotação desatualizada bloqueia até aceitar', async ({ app, page }) => {
    await app.open('/', { scenario: 'price-change' })
    await app.login()
    await app.addToCart('emerald-ape-042')
    await page.goto('/pagamento')
    const accept = page.getByRole('button', { name: 'Aceitar novos valores' })
    await expect(accept).toBeVisible({ timeout: 15_000 })
    await expect(app.confirmButton()).toBeDisabled()
    await accept.click()
    await expect(app.confirmButton()).toBeEnabled()
  })

  test('edição esgota no envio: conflito e nenhum pedido', async ({ app, page }) => {
    await app.open('/', { scenario: 'sold-out' })
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.confirmButton().click()
    await app.reviewDialog().getByRole('button', { name: 'Confirmar e enviar' }).click()
    await expect(app.reviewDialog().getByRole('alert').first()).toBeVisible()
    await expect(page).toHaveURL(/\/pagamento$/)
    expect(await app.userOrders()).toHaveLength(0)
  })

  test('na confirmação, só os itens comprados saem do carrinho', async ({ app, page }) => {
    await app.open('/', { scenario: 'slow-payment' })
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.placeOrder()
    await expect(app.orderStatus()).toHaveAttribute('data-order-status', 'pending')

    // Enquanto o pedido está pendente, outro item entra no carrinho.
    await app.addToCart('sage-nomad-009')
    await page.goto('/carrinho')
    await expect(app.cartRows()).toHaveCount(2)
    await expect(page.getByText('Compra confirmada')).toBeVisible({ timeout: 30_000 })
    await expect(app.cartRows()).toHaveCount(1)
    await expect(app.cartRows().first()).toContainText('Sage Nomad #009')
  })

  test('carteira: conectar e desconectar (simulado)', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await page.goto('/perfil/carteiras')
    const status = page.getByRole('status').filter({ hasText: /Conectada|Desconectada/ }).first()
    await expect(status).toBeVisible()
    if ((await status.textContent())?.includes('Desconectada')) {
      await page.getByRole('button', { name: 'Conectar', exact: true }).first().click()
      await expect(status).toContainText('Conectada na')
    }
    await page.getByRole('button', { name: 'Desconectar' }).first().click()
    await expect(status).toContainText('Desconectada')
  })
})
