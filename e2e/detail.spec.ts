import type { Page } from '@playwright/test'
import { ANA, expect, test, type App } from './fixtures'

const favoriteButton = (app: App, page: Page) =>
  app.visible(page.getByRole('button', { name: /^(Favoritar|Favoritado|Adicionar à lista de interesse|Remover da lista de interesse)$/ }))

test.describe('Detalhe do NFT', () => {
  test('acesso direto pela URL com edição pré-selecionada', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042?edicao=ABERTA')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page).toHaveTitle(/Emerald Ape #042/)
    await expect(page.getByRole('radio', { name: 'ABERTA' })).toBeChecked()
    await expect(page.getByRole('img', { name: /Emerald Ape #042/ }).first()).toBeVisible()
  })

  test('NFT inexistente mostra 404 com caminho de volta', async ({ app, page }) => {
    await app.open('/nft/nao-existe-999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page).toHaveURL('/')
  })

  test('edição indisponível bloqueia a compra e explica', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042')
    const soldOut = page.getByRole('radio', { name: '1/1 (indisponível)', exact: true })
    await soldOut.click()
    await expect(page).toHaveURL(/edicao=1%2F1|edicao=1\/1/)
    await expect(page.getByText('A edição 1/1 está indisponível. Escolha outra edição.')).toBeVisible()
    const buy = app.isMobile ? page.getByRole('button', { name: 'Adicionar ao carrinho' }) : page.getByRole('button', { name: 'COMPRAR' })
    await expect(buy).toBeDisabled()
  })

  test('quantidade respeita o limite por pedido', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042?edicao=1%2F10')
    const stepper = app.visible(page.getByRole('group', { name: 'Quantidade de Emerald Ape #042' }))
    const plus = stepper.getByRole('button', { name: 'Aumentar quantidade' })
    const nft = await app.nft('emerald-ape-042')
    const edition = nft.editions.find((e) => e.label === '1/10')!
    const limit = Math.max(1, Math.min(edition.available, edition.maxPerOrder))
    expect(limit).toBeGreaterThan(1)
    for (let i = 1; i < limit; i++) await plus.click()
    await expect(stepper.locator('output')).toHaveText(String(limit))
    await expect(page.getByText(`Máximo de ${limit} por pedido nesta edição.`)).toBeVisible()
    await expect(plus).toBeDisabled()
    await expect(stepper.getByRole('button', { name: 'Diminuir quantidade' })).toBeEnabled()
  })

  test('favorito exige login e persiste para o usuário', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042')
    await favoriteButton(app, page).click()
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await app.login(ANA, { from: '' })
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042/)

    const button = favoriteButton(app, page)
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')

    await page.reload()
    await expect(favoriteButton(app, page)).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/perfil/interesses')
    await expect(page.getByRole('main')).toContainText('Emerald Ape #042')
  })

  test('falha ao favoritar desfaz a marcação otimista', async ({ app, page }) => {
    await app.open('/', { scenario: 'favorite-fails' })
    await app.login()
    await page.goto('/nft/emerald-ape-042')
    const button = favoriteButton(app, page)
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()
    await expect(page.getByText(/Não foi possível/).first()).toBeVisible()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
  })
})
