#!/usr/bin/env node
/**
 * Roda o Lighthouse CI em mobile e desktop (3 execuções por URL), grava os
 * relatórios em lighthouse-reports/<preset>/ e um resumo com a MEDIANA de
 * cada métrica em lighthouse-reports/summary.md (e .json).
 *
 * Uso: npm run lighthouse            (precisa de `npm run build` antes)
 *      LH_BASE_URL=https://… npm run lighthouse   (mede um deploy)
 *      LH_PRESETS=mobile npm run lighthouse      (só um preset)
 *
 * Sai com código ≠ 0 se alguma mediana ficar abaixo das metas.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const presets = (process.env.LH_PRESETS ?? 'mobile,desktop').split(',')
const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
const out = 'lighthouse-reports'
mkdirSync(out, { recursive: true })

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const rows = []
let failed = false

for (const preset of presets) {
  const dir = join(out, preset)
  rmSync(dir, { recursive: true, force: true })
  rmSync('.lighthouseci', { recursive: true, force: true })
  const env = { ...process.env, LH_PRESET: preset }
  const run = (cmd) => execFileSync('npx', ['lhci', cmd, '--config=lighthouserc.cjs'], { stdio: 'inherit', env })
  run('collect')
  run('upload')

  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  const byUrl = Map.groupBy(manifest, (entry) => new URL(entry.url).pathname)
  for (const [path, entries] of byUrl) {
    const reports = entries.map((e) => JSON.parse(readFileSync(e.jsonPath, 'utf8')))
    const score = (cat) => Math.round(median(reports.map((r) => r.categories[cat].score * 100)))
    const metric = (id) => median(reports.map((r) => r.audits[id].numericValue))
    const row = {
      preset,
      page: path === '/' ? 'Início' : 'Detalhe',
      path,
      runs: reports.length,
      performance: score('performance'),
      accessibility: score('accessibility'),
      'best-practices': score('best-practices'),
      seo: score('seo'),
      lcpMs: Math.round(metric('largest-contentful-paint')),
      cls: Number(metric('cumulative-layout-shift').toFixed(3)),
      tbtMs: Math.round(metric('total-blocking-time')),
      fcpMs: Math.round(metric('first-contentful-paint')),
      report: entries.find((e) => e.isRepresentativeRun)?.htmlPath,
    }
    for (const [cat, min] of Object.entries(TARGETS)) if (row[cat] < min) failed = true
    rows.push(row)
  }
}

const mark = (cat, value) => `${value}${value >= TARGETS[cat] ? '' : ' ⚠'}`
const md = [
  `# Lighthouse — mediana de ${rows[0]?.runs ?? 3} execuções`,
  '',
  `Gerado em ${new Date().toISOString()} · metas: Perf ≥ 90, A11y ≥ 95, BP ≥ 95, SEO ≥ 90`,
  '',
  '| Página | Perfil | Perf | A11y | BP | SEO | LCP | CLS | TBT | FCP |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map(
    (r) =>
      `| ${r.page} | ${r.preset} | ${mark('performance', r.performance)} | ${mark('accessibility', r.accessibility)} | ${mark('best-practices', r['best-practices'])} | ${mark('seo', r.seo)} | ${(r.lcpMs / 1000).toFixed(2)} s | ${r.cls} | ${r.tbtMs} ms | ${(r.fcpMs / 1000).toFixed(2)} s |`,
  ),
  '',
].join('\n')
writeFileSync(join(out, 'summary.md'), md)
writeFileSync(join(out, 'summary.json'), JSON.stringify(rows, null, 2))
console.log(`\n${md}`)
if (existsSync('.lighthouseci')) rmSync('.lighthouseci', { recursive: true, force: true })
process.exit(failed ? 1 : 0)
