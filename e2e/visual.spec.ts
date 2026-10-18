import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Regressão visual das telas principais em desktop (1440) e mobile (390).
 * Baselines em e2e/__screenshots__/<projeto>/. Para regravar após uma
 * mudança intencional de layout: `npm run test:e2e:update -- visual`.
 *
 * Estabilidade: dados determinísticos (cenário `fast`, banco restaurado),
 * movimento reduzido (carrossel parado, sem shimmer), fontes e imagens
 * carregadas, e elementos que não fazem parte do layout (painel de
 * cenários da demo e toasts) ocultos.
 */
test.use({ reducedMotion: 'reduce' })

async function settle(page: Page) {
  await page.addStyleTag({ content: '[data-scenario-trigger], [data-sonner-toaster] { display: none !important; }' })
  await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(0, { timeout: 10_000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    // Só imagens visíveis na primeira dobra (lazy fora da tela ou em elementos ocultos não carregam).
    const images = Array.from(document.images).filter((img) => {
      const rect = img.getBoundingClientRect()
      return img.checkVisibility() && rect.width > 0 && rect.top < innerHeight
    })
    const loaded = Promise.all(
      images.map((img) =>
        img.complete
          ? null
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true })
              img.addEventListener('error', resolve, { once: true })
            }),
      ),
    )
    await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 8000))])
  })
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
}

test.describe('Regressão visual', () => {
  test('início', async ({ app, page }) => {
    await app.open('/')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('home.png')
  })

  test('detalhe do NFT', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png')
  })

  test('carrinho', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042')
    await app.addToCart('sage-nomad-009')
    await page.goto('/carrinho')
    await expect(app.cartRows()).toHaveCount(2)
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png')
  })

  test('pagamento', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png')
  })
})
