import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const cards = (page: Page) => page.getByTestId('nft-card')
const prices = (page: Page) =>
  cards(page)
    .locator('[data-price]')
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-price'))))

test.describe('Catálogo', () => {
  test('filtros combináveis, ordenação e paginação ficam na URL e sobrevivem a refresh', async ({ app, page }) => {
    await app.open('/')
    await expect(cards(page).first()).toBeVisible()

    await page.getByRole('navigation', { name: 'Paginação' }).getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/[?&]page=2/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // Mudança de filtro zera a paginação; filtros se combinam.
    await app.filters(async (scope) => {
      await app.filterButton(scope, 'Rede', /Ethereum/).click()
      await expect(page).toHaveURL(/network=ethereum/)
      await expect(page).not.toHaveURL(/page=/)
      await app.filterButton(scope, 'Coleções', /Arte digital/).click()
      await expect(page).toHaveURL(/category=digital_art/)
      await expect(app.filterButton(scope, 'Rede', /Ethereum/)).toHaveAttribute('aria-pressed', 'true')
    })
    await expect(page).toHaveURL(/network=ethereum/)

    await app.sortBy('Menor preço')
    await expect(page).toHaveURL(/sort=price_asc/)
    await expect(cards(page).first()).toBeVisible()
    const sorted = await prices(page)
    expect(sorted.length).toBeGreaterThan(0)
    expect(sorted).toEqual([...sorted].sort((a, b) => a - b))

    // Acesso direto/refresh restaura o mesmo estado.
    const url = page.url()
    await page.reload()
    await expect(page).toHaveURL(url)
    await expect(page.getByRole('list', { name: 'Filtros ativos' })).toContainText('Ethereum')
    await expect(page.getByRole('list', { name: 'Filtros ativos' })).toContainText('Arte digital')
    expect(await prices(page)).toEqual(sorted)
  })

  test('remover filtro ativo pelo chip atualiza a URL', async ({ app, page }) => {
    await app.open('/?network=polygon&page=2')
    await page.getByRole('list', { name: 'Filtros ativos' }).getByRole('button', { name: /Polygon/ }).click()
    await expect(page).not.toHaveURL(/network=/)
    await expect(page).not.toHaveURL(/page=/)
  })

  test('busca por texto e estado vazio', async ({ app, page }) => {
    await app.open('/')
    await expect(cards(page).first()).toBeVisible()
    await app.search('Emerald')
    await expect(page).toHaveURL(/q=Emerald/)
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).first()).toContainText('Emerald Ape #042')

    await app.search('nada-corresponde-xyz')
    await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
    await expect(page.getByText('Nada corresponde a “nada-corresponde-xyz”', { exact: false })).toBeVisible()
  })

  test('parâmetros inválidos na URL caem no padrão', async ({ app, page }) => {
    await app.open('/?sort=xyz&page=-3&network=marte')
    await expect(cards(page).first()).toBeVisible()
    await expect(page.getByRole('list', { name: 'Filtros ativos' })).toHaveCount(0)
  })

  test('catálogo vazio', async ({ app, page }) => {
    await app.open('/', { scenario: 'empty' })
    await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
  })

  test('falha transitória é recuperada', async ({ app, page }) => {
    await app.open('/', { scenario: 'flaky' })
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo.' })
    await expect(cards(page).first().or(alert)).toBeVisible({ timeout: 15_000 })
    if (await alert.isVisible()) await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cards(page).first()).toBeVisible()
  })

  test('erro do servidor mostra alerta com nova tentativa', async ({ app, page }) => {
    await app.open('/', { scenario: 'server-error' })
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo.' })
    await expect(alert).toBeVisible({ timeout: 15_000 })
    await expect(alert.getByRole('button', { name: /Tentar novamente|Tentando/ })).toBeVisible()
  })

  test('sem conexão mostra erro em vez de tela em branco', async ({ app, page }) => {
    await app.open('/', { scenario: 'offline' })
    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 15_000 })
  })

  test('respostas fora de ordem não sobrescrevem a busca mais recente', async ({ app, page }) => {
    await app.open('/', { scenario: 'out-of-order' })
    await expect(cards(page).first()).toBeVisible({ timeout: 10_000 })
    // Buscas em sequência rápida: no cenário, requisições ímpares demoram mais.
    await app.search('Ape')
    await app.search('Sage')
    await app.search('Emerald')
    await expect(page).toHaveURL(/q=Emerald/)
    await expect(cards(page)).toHaveCount(1, { timeout: 10_000 })
    await expect(cards(page).first()).toContainText('Emerald Ape #042')
    // Respostas atrasadas das buscas anteriores não podem trocar o resultado.
    await page.waitForTimeout(2500)
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).first()).toContainText('Emerald Ape #042')
  })
})
