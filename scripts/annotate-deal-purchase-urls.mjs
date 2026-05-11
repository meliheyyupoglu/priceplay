/**
 * demo-snapshot icindeki deal satirlarina CheapShark redirect zincirinin
 * son URL'sini `purchaseUrl` olarak yazar (tarayici cheapshark.com'a gitmeden magaza acilir).
 *
 *   node scripts/annotate-deal-purchase-urls.mjs
 *   MAX_DEALS=500 DELAY_MS=120 node scripts/annotate-deal-purchase-urls.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const FILES = [
  path.join(ROOT, 'public', 'demo-snapshot.json'),
  path.join(ROOT, 'apps', 'mobile_flutter', 'assets', 'data', 'demo-snapshot.json'),
  path.join(ROOT, 'data', 'cheapshark-db.json'),
]

const MAX_DEALS = Math.max(1, Number(process.env.MAX_DEALS || 4000))
const DELAY_MS = Math.max(0, Number(process.env.DELAY_MS || 80))

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

async function resolveFinalUrl(dealId) {
  const u = `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(dealId)}`
  const r = await fetch(u, {
    redirect: 'follow',
    headers: { 'User-Agent': 'PricePlayAnnotate/1.0', Accept: 'text/html' },
  })
  return r.url
}

async function annotateFile(fp) {
  let raw
  try {
    raw = await readFile(fp, 'utf8')
  } catch {
    console.warn('[annotate] atlandi (yok):', fp)
    return { fp, updated: 0, skipped: 0, errors: 0 }
  }
  const j = JSON.parse(raw)
  const details = j.gameDetails || {}
  let updated = 0
  let skipped = 0
  let errors = 0
  let count = 0

  for (const payload of Object.values(details)) {
    if (!payload || typeof payload !== 'object') continue
    const deals = payload.deals
    if (!Array.isArray(deals)) continue
    for (const d of deals) {
      if (!d || typeof d !== 'object') continue
      if (d.purchaseUrl || d.purchase_url) {
        skipped++
        continue
      }
      const dealId = String(d.dealID ?? d.dealId ?? '').trim()
      if (!dealId) {
        skipped++
        continue
      }
      if (count >= MAX_DEALS) break
      count++
      try {
        const final = await resolveFinalUrl(dealId)
        let host = ''
        try {
          host = new URL(final).hostname
        } catch {
          host = ''
        }
        if (final && host && !host.endsWith('cheapshark.com')) {
          d.purchaseUrl = final
          updated++
        } else {
          skipped++
        }
      } catch (e) {
        errors++
        console.warn('[annotate] deal fail', dealId.slice(0, 24), e.message || e)
      }
      if (DELAY_MS) await sleep(DELAY_MS)
    }
    if (count >= MAX_DEALS) break
  }

  j.generatedAt = new Date().toISOString()
  await mkdir(path.dirname(fp), { recursive: true })
  await writeFile(fp, JSON.stringify(j), 'utf8')
  console.log('[annotate]', fp, { updated, skipped, errors })
  return { fp, updated, skipped, errors }
}

async function main() {
  console.log('[annotate] MAX_DEALS=', MAX_DEALS, 'DELAY_MS=', DELAY_MS)
  for (const fp of FILES) {
    await annotateFile(fp)
  }
}

main().catch((e) => {
  console.error('[annotate] failed', e)
  process.exit(1)
})
