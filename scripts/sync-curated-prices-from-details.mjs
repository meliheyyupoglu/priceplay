/**
 * Ag yok: demo-snapshot icindeki gameDetails.deals ile curatedPopular satirlarindaki
 * cheapest / normalPrice / savings alanlarini hizalar; yinelenen sahte GTA satirini siler.
 *
 *   node scripts/sync-curated-prices-from-details.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SNAPSHOT_PUBLIC = path.join(ROOT, 'public', 'demo-snapshot.json')
const SNAPSHOT_FLUTTER = path.join(ROOT, 'apps', 'mobile_flutter', 'assets', 'data', 'demo-snapshot.json')

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function pickBestDealPrices(deals) {
  if (!Array.isArray(deals) || deals.length === 0) return null
  let best = null
  let bestP = Infinity
  for (const d of deals) {
    if (!d || typeof d !== 'object') continue
    const p = parseFloat(String(d.price ?? d.salePrice ?? '999'))
    if (!Number.isFinite(p)) continue
    if (p < bestP) {
      bestP = p
      best = d
    }
  }
  if (!best) return null
  return {
    cheapest: String(best.price ?? best.salePrice ?? '0'),
    normalPrice: String(best.retailPrice ?? '0'),
    savings: String(best.savings ?? '0'),
  }
}

function findNumericDetailKeyForRow(snapshot, row) {
  const seed = normText(row?.seed || '')
  const title = normText(row?.title || '')
  let bestKey = null
  let bestScore = -1
  for (const [k, payload] of Object.entries(snapshot.gameDetails || {})) {
    if (!/^\d+$/.test(k)) continue
    const t = normText(payload?.info?.title || '')
    if (!t) continue
    let score = 0
    if (seed) {
      if (t === seed) score += 5000
      else if (t.includes(seed) || seed.includes(t)) score += 2000
    }
    if (title) {
      if (t === title) score += 4500
      else if (t.includes(title) || title.includes(t)) score += 1800
    }
    if (score === 0) continue
    const n = Array.isArray(payload?.deals) ? payload.deals.length : 0
    const total = score + Math.min(n, 50)
    if (total > bestScore) {
      bestScore = total
      bestKey = k
    }
  }
  return bestKey
}

function pruneDuplicateGtaCuratedRow(snapshot) {
  const rows = snapshot.curatedPopular || []
  const has298615 = rows.some((r) => String(r?.gameId) === '298615')
  if (!has298615) return
  snapshot.curatedPopular = rows.filter((r) => String(r?.gameId) !== 'Grand Theft Auto V')
}

function dealsForRow(snapshot, row) {
  const g = String(row?.gameId ?? '').trim()
  const det = g ? snapshot.gameDetails?.[g] : null
  let deals = det?.deals
  if (Array.isArray(deals) && deals.length > 0) return deals
  const alt = findNumericDetailKeyForRow(snapshot, row)
  if (alt && alt !== g) {
    const d2 = snapshot.gameDetails?.[alt]
    deals = d2?.deals
    if (Array.isArray(deals) && deals.length > 0) return deals
  }
  return null
}

async function main() {
  const raw = await readFile(SNAPSHOT_PUBLIC, 'utf8')
  const snapshot = JSON.parse(raw)
  pruneDuplicateGtaCuratedRow(snapshot)
  let n = 0
  for (const row of snapshot.curatedPopular || []) {
    if (!row) continue
    const deals = dealsForRow(snapshot, row)
    const pr = pickBestDealPrices(deals)
    if (pr) {
      row.cheapest = pr.cheapest
      row.normalPrice = pr.normalPrice
      row.savings = pr.savings
      n++
    }
  }
  snapshot.generatedAt = new Date().toISOString()
  const body = JSON.stringify(snapshot)
  await mkdir(path.dirname(SNAPSHOT_PUBLIC), { recursive: true })
  await writeFile(SNAPSHOT_PUBLIC, body, 'utf8')
  await mkdir(path.dirname(SNAPSHOT_FLUTTER), { recursive: true })
  await writeFile(SNAPSHOT_FLUTTER, body, 'utf8')
  console.log(`[sync-curated] kart fiyatlari guncellenen satir: ${n}, yazildi: ${SNAPSHOT_PUBLIC}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
