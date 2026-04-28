import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const CHEAPSHARK_BASE = 'https://www.cheapshark.com/api/1.0'
const DB_FILE = process.env.DEMO_DB_FILE || path.join(process.cwd(), 'data', 'cheapshark-db.json')
const OUT_FILE = process.env.DEMO_SNAPSHOT_OUT || path.join(process.cwd(), 'public', 'demo-snapshot.json')
const PAGE_SIZE = Number(process.env.DEMO_PAGE_SIZE || 60)
const PAGES_PER_RUN = Number(process.env.DEMO_PAGES_PER_RUN || 3)
const DETAILS_PER_RUN = Number(process.env.DEMO_DETAILS_PER_RUN || 60)

const SEARCH_TERMS = String(
  process.env.DEMO_SEARCH_TERMS || 'elden,portal,gta,witcher,cyberpunk,fifa,forza,minecraft,hades,resident evil',
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function defaultDb() {
  return {
    generatedAt: null,
    meta: { runs: 0 },
    cursors: { popular: 0, discounted: 0, newReleases: 0, free100: 0 },
    stores: [],
    deals: { popular: [], discounted: [], newReleases: [], free100: [] },
    searches: {},
    gameDetails: {},
  }
}

async function loadDb() {
  try {
    const raw = await readFile(DB_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return { ...defaultDb(), ...parsed, deals: { ...defaultDb().deals, ...(parsed.deals || {}) } }
  } catch {
    return defaultDb()
  }
}

async function saveDb(db) {
  await mkdir(path.dirname(DB_FILE), { recursive: true })
  await writeFile(DB_FILE, JSON.stringify(db), 'utf8')
}

async function getJson(url, { allow429 = false } = {}) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (res.status === 429 && allow429) {
    const err = new Error(`429: ${url}`)
    err.code = 'RATE_LIMIT'
    throw err
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`GET ${url} -> ${res.status} ${txt.slice(0, 180)}`)
  }
  return res.json()
}

function mergeDealsByDealId(existing, incoming) {
  const out = []
  const seen = new Set()
  for (const list of [existing, incoming]) {
    for (const row of list) {
      if (!row || typeof row !== 'object') continue
      const id = String(row.dealID ?? '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(row)
    }
  }
  return out
}

function uniqueGameIdsFromDeals(...lists) {
  const out = []
  const seen = new Set()
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      const id = String(row?.gameID ?? row?.gameId ?? '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

async function harvestDeals(db, key, paramsBuilder) {
  let page = Number(db.cursors?.[key] || 0)
  let fetchedPages = 0
  while (fetchedPages < PAGES_PER_RUN) {
    const params = paramsBuilder(page)
    const qs = new URLSearchParams(params).toString()
    const url = `${CHEAPSHARK_BASE}/deals?${qs}`
    const list = await getJson(url, { allow429: true })
    if (!Array.isArray(list) || list.length === 0) break
    db.deals[key] = mergeDealsByDealId(db.deals[key] || [], list)
    page += 1
    fetchedPages += 1
    await new Promise((r) => setTimeout(r, 80))
  }
  db.cursors[key] = page
  return fetchedPages
}

async function main() {
  const db = await loadDb()
  console.log('[demo-snapshot] harvest source:', CHEAPSHARK_BASE)
  let hit429 = false
  try {
    if (!Array.isArray(db.stores) || db.stores.length === 0) {
      db.stores = await getJson(`${CHEAPSHARK_BASE}/stores`, { allow429: true })
    }
    await harvestDeals(db, 'popular', (page) => ({
      sortBy: 'Deal Rating',
      pageSize: String(PAGE_SIZE),
      pageNumber: String(page),
    }))
    await harvestDeals(db, 'discounted', (page) => ({
      onSale: '1',
      sortBy: 'Savings',
      pageSize: String(PAGE_SIZE),
      pageNumber: String(page),
    }))
    await harvestDeals(db, 'newReleases', (page) => ({
      sortBy: 'Release',
      pageSize: String(PAGE_SIZE),
      pageNumber: String(page),
    }))
    await harvestDeals(db, 'free100', (page) => ({
      onSale: '1',
      sortBy: 'Savings',
      pageSize: String(PAGE_SIZE),
      pageNumber: String(page),
    }))

    for (const term of SEARCH_TERMS) {
      const q = term.toLowerCase()
      if (Array.isArray(db.searches[q]) && db.searches[q].length > 0) continue
      const list = await getJson(`${CHEAPSHARK_BASE}/games?title=${encodeURIComponent(term)}&limit=40`, {
        allow429: true,
      })
      db.searches[q] = Array.isArray(list) ? list : []
      await new Promise((r) => setTimeout(r, 90))
    }

    const allGameIds = uniqueGameIdsFromDeals(
      db.deals.popular,
      db.deals.discounted,
      db.deals.newReleases,
      db.deals.free100,
    )
    const missingIds = allGameIds.filter((id) => !db.gameDetails[id]).slice(0, DETAILS_PER_RUN)
    for (const id of missingIds) {
      const detail = await getJson(`${CHEAPSHARK_BASE}/games?id=${encodeURIComponent(id)}`, {
        allow429: true,
      })
      db.gameDetails[id] = detail
      await new Promise((r) => setTimeout(r, 70))
    }
  } catch (e) {
    if (e?.code === 'RATE_LIMIT') {
      hit429 = true
      console.warn('[demo-snapshot] 429 alindi, bu tur burada durduruldu.')
    } else {
      throw e
    }
  }

  db.meta.runs = Number(db.meta.runs || 0) + 1
  db.generatedAt = new Date().toISOString()
  await saveDb(db)

  const snapshot = {
    generatedAt: db.generatedAt,
    stores: db.stores || [],
    popular: db.deals.popular || [],
    discounted: db.deals.discounted || [],
    newReleases: db.deals.newReleases || [],
    free100: db.deals.free100 || [],
    searches: db.searches || {},
    gameDetails: db.gameDetails || {},
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(snapshot), 'utf8')
  console.log(`[demo-snapshot] db: ${DB_FILE}`)
  console.log(`[demo-snapshot] written: ${OUT_FILE}`)
  console.log(
    `[demo-snapshot] sizes popular=${snapshot.popular.length} discounted=${snapshot.discounted.length} new=${snapshot.newReleases.length} free=${snapshot.free100.length} details=${Object.keys(snapshot.gameDetails).length}`,
  )
  if (hit429) {
    console.log('[demo-snapshot] Durum: RATE_LIMIT. Sonra tekrar calistir ve biriktirmeye devam et.')
  } else {
    console.log('[demo-snapshot] Durum: tamamlandi.')
  }
}

main().catch((e) => {
  console.error('[demo-snapshot] failed:', e.message || e)
  process.exit(1)
})
