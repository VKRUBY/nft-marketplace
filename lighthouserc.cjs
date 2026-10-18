/**
 * Lighthouse CI — home e detalhe, mobile e desktop, 3 execuções cada.
 *
 * O preset vem de `LH_PRESET` (`mobile` | `desktop`); `npm run lighthouse`
 * roda os dois em sequência (scripts/lighthouse.mjs), que também calcula a
 * mediana das 3 execuções e grava o resumo com LCP, CLS e TBT.
 *
 * Mede o build de demonstração (com mocks), servido pelo `vite preview` —
 * o mesmo que vai para a Vercel. Defina `LH_BASE_URL` para medir o deploy.
 */
const preset = process.env.LH_PRESET === 'desktop' ? 'desktop' : 'mobile'
const port = Number(process.env.LH_PORT ?? 4174)
const base = process.env.LH_BASE_URL ?? `http://localhost:${port}`

module.exports = {
  ci: {
    collect: {
      url: [`${base}/`, `${base}/nft/emerald-ape-042`],
      numberOfRuns: 3,
      ...(process.env.LH_BASE_URL
        ? {}
        : { startServerCommand: `npx vite preview --port ${port} --strictPort`, startServerReadyPattern: 'Local' }),
      chromePath: process.env.CHROME_PATH,
      settings: {
        ...(preset === 'desktop' ? { preset: 'desktop' } : {}),
        chromeFlags: '--headless=new --no-sandbox',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      // Avalia a mediana das execuções (aggregationMethod padrão: median-run).
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: `./lighthouse-reports/${preset}`,
    },
  },
}
