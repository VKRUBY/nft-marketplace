import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function axe(page: Page) {
  // Espera o conteúdo assentar (sem skeletons) antes de auditar.
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 10_000 })
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

test.describe('Acessibilidade e layout', () => {
  test.use({ reducedMotion: 'reduce' })

  test('telas públicas sem violações WCAG 2.1 AA', async ({ app, page }) => {
    await app.open('/')
    for (const path of ['/', '/nft/emerald-ape-042', '/nft/nao-existe', '/carrinho', '/login', '/cadastro', '/em-breve/criadores']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      expect(await axe(page), path).toEqual([])
    }
  })

  test('telas autenticadas e checkout sem violações WCAG 2.1 AA', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await app.addToCart('emerald-ape-042')
    for (const path of ['/carrinho', '/pagamento', '/perfil', '/perfil/carteiras', '/perfil/interesses']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      expect(await axe(page), path).toEqual([])
    }
    await app.openCheckout()
    await app.confirmButton().click()
    await expect(app.reviewDialog()).toBeVisible()
    expect(await axe(page), 'revisão').toEqual([])
    await app.reviewDialog().getByRole('button', { name: 'Confirmar e enviar' }).click()
    await expect(app.orderStatus()).toHaveAttribute('data-order-status', 'confirmed', { timeout: 10_000 })
    expect(await axe(page), 'confirmação').toEqual([])
  })

  test('teclado: link de pular conteúdo, navegação e foco ao trocar de página', async ({ app, page }) => {
    test.skip(app.isMobile, 'navegação por teclado físico é verificada no desktop')
    await app.open('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#conteudo')).toBeFocused()

    const card = page.getByTestId('nft-card').filter({ hasText: 'Emerald Ape #042' }).getByRole('link').first()
    await card.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042/)
    await expect(page.locator('main#conteudo')).toBeFocused()
    // O título da nova página é anunciado numa região aria-live.
    await expect(page.locator('[aria-live="polite"][aria-atomic="true"]').filter({ hasText: 'Emerald Ape #042' })).toBeAttached()

    // Edições: grupo de rádio com setas.
    await page.getByRole('radio', { name: '1/50' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'ABERTA' })).toBeFocused()
    await expect(page.getByRole('radio', { name: 'ABERTA' })).toBeChecked()
    await expect(page).toHaveURL(/edicao=ABERTA/)
  })

  test('diálogo de login: foco inicial, foco preso e Esc fecha', async ({ app, page }) => {
    test.skip(app.isMobile, 'navegação por teclado físico é verificada no desktop')
    await app.open('/login')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByPlaceholder('contato@email.com')).toBeFocused()
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('erros de formulário ficam associados aos campos', async ({ app, page }) => {
    await app.open('/cadastro')
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('Confirmar senha').press('Enter')
    const email = dialog.getByPlaceholder('Digite seu e-mail', { exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Informe o e-mail')
    await expect(dialog.getByPlaceholder('Nome de usuário')).toBeFocused()
  })

  test('drawer de filtros no mobile prende e devolve o foco', async ({ app, page }) => {
    test.skip(!app.isMobile, 'drawer existe só no mobile')
    await app.open('/')
    const trigger = page.getByRole('button', { name: /^Filtros/ })
    await trigger.click()
    const drawer = page.getByRole('dialog', { name: 'Filtros' })
    await expect(drawer).toBeVisible()
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('sem rolagem horizontal em 390, 768 e 1440 px', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042')
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/login']) {
        await page.goto(path)
        await expect(page.locator('main')).toBeVisible()
        await page.waitForTimeout(200)
        expect(await horizontalOverflow(page), `${width}px ${path}`).toBeLessThanOrEqual(0)
      }
    }
  })

  test('zoom não é bloqueado e o layout aguenta 200%', async ({ app, page }) => {
    await app.open('/')
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/)
    // 200% de zoom numa tela de 1280 px equivale a uma janela de 640 px CSS.
    await page.setViewportSize({ width: 640, height: 800 })
    for (const path of ['/', '/nft/emerald-ape-042']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0)
    }
  })

  test('skeletons com shimmer respeitam reduced motion', async ({ app, page }) => {
    await app.open('/', { scenario: 'slow' })
    const skeleton = app.visible(page.locator('[data-slot="skeleton"]'))
    await expect(skeleton).toBeVisible()
    const duration = await skeleton.evaluate((el) => getComputedStyle(el).animationDuration)
    expect(parseFloat(duration)).toBeLessThan(0.01)
    await expect(page.getByRole('status', { name: 'Carregando NFTs' })).toBeVisible()
  })
})

test.describe('Movimento padrão', () => {
  test('skeleton anima com shimmer quando não há preferência', async ({ app, page }) => {
    await app.open('/', { scenario: 'slow' })
    const skeleton = app.visible(page.locator('[data-slot="skeleton"]'))
    await expect(skeleton).toBeVisible()
    expect(await skeleton.evaluate((el) => getComputedStyle(el).animationName)).toBe('shimmer')
  })
})
