import { defineConfig, devices } from '@playwright/test'

/**
 * E2E contra o build de produção (vite preview) com a camada de mocks ligada,
 * como no deploy de demonstração.
 *
 * Isolamento: cada teste roda num BrowserContext novo, então localStorage,
 * sessionStorage e o service worker do MSW começam vazios. O banco simulado
 * vive no localStorage do contexto e é recriado a partir do seed do cenário
 * na primeira visita (`openApp` em e2e/fixtures.ts) — nenhum teste vê o
 * estado de outro, e a ordem de execução não importa.
 */
const PORT = Number(process.env.E2E_PORT ?? 4173)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

// Usa o Chrome instalado quando disponível (CHANNEL=chrome); senão o Chromium do Playwright.
const channel = process.env.PW_CHANNEL || undefined

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    serviceWorkers: 'allow',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        channel,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
