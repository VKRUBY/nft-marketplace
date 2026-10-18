import { ANA, BRUNO, expect, test } from './fixtures'

test.describe('Sessão', () => {
  test('itens do visitante são mesclados ao carrinho da conta no login', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042')
    await app.addToCart('sage-nomad-009')
    await app.login()
    await page.goto('/carrinho')
    await expect(app.cartRows()).toHaveCount(2)
    const db = await app.db()
    const anaCart = Object.values(db.carts).find((c) => c.owner === 'user' && c.ownerId === 'usr_ana')
    expect(anaCart?.lines).toHaveLength(2)
  })

  test('sessão expira no pagamento: login preserva a rota e o rascunho', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await app.openBuyerForm()
    const note = page.getByLabel('Observação do colecionador (opcional)')
    await note.fill('Entregar na carteira principal, por favor')
    await expect(async () => {
      const draft = await page.evaluate(() => sessionStorage.getItem('kurio:checkout-draft:usr_ana'))
      expect(draft).toContain('Entregar na carteira principal')
    }).toPass()

    await app.gm((g) => g.expireSessions())
    await app.confirmButton().click()
    const send = app.reviewDialog().getByRole('button', { name: 'Confirmar e enviar' })
    await send.click().catch(() => {})
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpagamento&reason=expired/)
    await expect(page.getByText(/sessão expirou|Sessão encerrada/i).first()).toBeVisible()
    expect(await app.userOrders()).toHaveLength(0)

    await app.login(ANA, { from: '' })
    await expect(page).toHaveURL(/\/pagamento$/)
    await app.openBuyerForm()
    await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('Entregar na carteira principal, por favor')
  })

  test('sessão expira durante a navegação: volta à página pedida após o login', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await page.goto('/perfil')
    await expect(page.getByRole('main')).toContainText('Dados do perfil')
    await app.gm((g) => g.expireSessions())
    await app.visible(page.getByRole('link', { name: 'Carteiras' })).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil%2Fcarteiras&reason=expired/)
    await app.login(ANA, { from: '' })
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
  })

  test('logout limpa dados privados e o rascunho', async ({ app, page }) => {
    await app.open('/')
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.openCheckout()
    await page.goto('/perfil')
    await app.visible(page.getByRole('button', { name: 'Sair' })).click()
    await expect(page).toHaveURL('/')
    await expect(app.visible(page.getByRole('link', { name: /^Carrinho, / }))).toHaveAccessibleName('Carrinho, 0 itens')
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('kurio:checkout-draft')))).toEqual([])
    expect(await page.evaluate(() => localStorage.getItem('greenmint:session-token'))).toBeNull()
    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil/)
  })

  test('troca de usuário não expõe dados da conta anterior', async ({ app, page }) => {
    await app.open('/')
    await app.login(ANA)
    await app.addToCart('emerald-ape-042')
    await page.goto('/perfil/interesses')
    await expect(page.getByRole('main').getByTestId('nft-card').first()).toBeVisible()
    await page.goto('/perfil')
    await app.visible(page.getByRole('button', { name: 'Sair' })).click()
    await expect(page).toHaveURL('/')

    await app.login(BRUNO)
    await page.goto('/perfil')
    const main = page.getByRole('main')
    await expect(main.getByRole('textbox', { name: /^E-mail/ })).toHaveValue(BRUNO.email)
    await expect(main).not.toContainText('ana@kurio.test')
    await page.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
    await page.goto('/perfil/interesses')
    await expect(page.getByRole('main').getByTestId('nft-card')).toHaveCount(0)
    await page.goto('/perfil/carteiras')
    await expect(page.getByRole('main')).not.toContainText('Reserva')
  })

  test('senhas nunca ficam em texto puro', async ({ app, page }) => {
    const storage = () => page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))

    // Login: só o token vai para o storage.
    await app.open('/')
    await app.login(ANA)
    expect(await storage()).not.toContain(ANA.password)

    // Cadastro: o servidor simulado guarda hash + salt, nunca a senha.
    await page.evaluate(() => localStorage.removeItem('greenmint:session-token'))
    await page.goto('/cadastro')
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('Nome de usuário').fill('carla')
    await dialog.getByPlaceholder('Digite seu e-mail', { exact: true }).fill('carla@kurio.test')
    await dialog.getByPlaceholder('Senha', { exact: true }).fill('Segredo123')
    await dialog.getByPlaceholder('Confirmar senha').fill('Segredo123')
    await dialog.getByPlaceholder('Confirmar senha').press('Enter')
    await expect(dialog).toBeHidden()

    expect(await storage()).not.toContain('Segredo123')
    const db = await app.db()
    const carla = db.users.find((u) => u.email === 'carla@kurio.test')!
    expect(carla.passwordHash).toMatch(/^[0-9a-f]{64}$/)
    expect(carla.passwordSalt).toBeTruthy()
    expect(JSON.stringify(db.users)).not.toContain('Segredo123')
  })
})
