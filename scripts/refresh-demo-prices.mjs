/**
 * demo-snapshot + cheapshark-db: oyun fiyat/tekliflerini CheapShark'tan yeniler.
 * Oncelik: vitrin (curated) baslik aramasi + games?id, sonra popular deal -> indirim -> yeni -> ucretsiz listelerindeki gercek gameID'ler.
 *
 *   node scripts/refresh-demo-prices.mjs
 *   MAX_GAME_DETAILS=400 node scripts/refresh-demo-prices.mjs
 *   CURATED_ONLY=1 node scripts/refresh-demo-prices.mjs
 *
 * SAVE_EVERY_N_DEALS=5 : deal asamasinda her N basarili guncellemede diske yazar (429 kesilse bile kayip azalir).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CHEAP = 'https://www.cheapshark.com/api/1.0'
const SNAPSHOT_PUBLIC = path.join(ROOT, 'public', 'demo-snapshot.json')
const SNAPSHOT_FLUTTER = path.join(ROOT, 'apps', 'mobile_flutter', 'assets', 'data', 'demo-snapshot.json')
const DB_FILE = path.join(ROOT, 'data', 'cheapshark-db.json')

const MAX_GAME_DETAILS = Math.max(50, Number(process.env.MAX_GAME_DETAILS || 320))
const STEAM_DETAILS_CAP = Math.max(0, Number(process.env.STEAM_DETAILS || 110))
const DELAY_MS = Math.max(80, Number(process.env.REFRESH_DELAY_MS || 200))
const STEAM_DELAY_MS = Math.max(80, Number(process.env.STEAM_DELAY_MS || 120))
const START_PAUSE_MS = Math.max(0, Number(process.env.START_PAUSE_MS || 45000))
const CURATED_ONLY = String(process.env.CURATED_ONLY || '0').trim() === '1'
const SAVE_EVERY_N_DEALS = Math.max(1, Number(process.env.SAVE_EVERY_N_DEALS || 5))

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

/** 429 icin kisa denemeler + uzun soguma dalgalari */
async function getJson(url, { retriesPerWave = 4, waves = 5 } = {}) {
  for (let wave = 0; wave < waves; wave++) {
    for (let attempt = 0; attempt <= retriesPerWave; attempt++) {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'PricePlayRefresh/1.0' } })
      if (res.status === 429) {
        const wait = Math.min(90000, 2500 * 2 ** attempt)
        console.warn(`[refresh] 429, ${wait}ms (dalga ${wave + 1}/${waves}, deneme ${attempt + 1})...`)
        await sleep(wait)
        continue
      }
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`${res.status} ${t.slice(0, 120)}`)
      }
      return res.json()
    }
    if (wave < waves - 1) {
      const cool = 120000
      console.warn(`[refresh] 429 devam: ${cool / 1000}s soguma...`)
      await sleep(cool)
    }
  }
  throw new Error('429: istek limiti (tum dalgalar)')
}

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function pickBestSearchMatch(seed, list) {
  if (!Array.isArray(list) || list.length === 0) return null
  const want = normText(seed)
  const scored = list
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const title = String(x.external ?? x.title ?? '').trim()
      const t = normText(title)
      let score = 0
      if (t === want) score += 1000
      if (t.includes(want)) score += 400
      if (want.includes(t)) score += 250
      const words = want.split(' ').filter((w) => w.length > 2)
      for (const w of words) {
        if (t.includes(w)) score += 30
      }
      return { raw: x, score }
    })
    .sort((a, b) => b.score - a.score)
  return scored[0]?.raw ?? null
}

function hasDeals(payload) {
  const deals = payload?.deals
  return Array.isArray(deals) && deals.length > 0
}

function syncCuratedRowsFromDetails(snapshot) {
  snapshot.curatedPopular = (snapshot.curatedPopular || []).map((row) => {
    if (!row) return row
    const gid = String(row.gameId ?? '').trim()
    if (!gid) return row
    const detail = snapshot.gameDetails?.[gid]
    const info = detail?.info
    if (!info) return row
    const steam = String(info.steamAppID ?? row.steamAppID ?? '').trim()
    return {
      ...row,
      title: String(info.title ?? row.title),
      thumb: info.thumb ?? row.thumb,
      steamAppID: steam && steam !== '0' ? steam : row.steamAppID,
    }
  })
}

async function flushSnapshotToDisk(snapshot) {
  syncCuratedRowsFromDetails(snapshot)
  snapshot.generatedAt = new Date().toISOString()
  const body = JSON.stringify(snapshot)
  await mkdir(path.dirname(SNAPSHOT_PUBLIC), { recursive: true })
  await writeFile(SNAPSHOT_PUBLIC, body, 'utf8')
  await mkdir(path.dirname(SNAPSHOT_FLUTTER), { recursive: true })
  await writeFile(SNAPSHOT_FLUTTER, body, 'utf8')

  try {
    const dbRaw = await readFile(DB_FILE, 'utf8')
    const db = JSON.parse(dbRaw)
    db.generatedAt = snapshot.generatedAt
    db.gameDetails = { ...db.gameDetails, ...snapshot.gameDetails }
    db.steamAppDetails = { ...db.steamAppDetails, ...snapshot.steamAppDetails }
    if (db.curatedPopular && snapshot.curatedPopular) {
      for (const row of snapshot.curatedPopular) {
        if (row?.seed) db.curatedPopular[row.seed] = { ...db.curatedPopular[row.seed], ...row }
      }
    }
    await writeFile(DB_FILE, JSON.stringify(db), 'utf8')
  } catch {
    /* db yoksa sadece snapshot */
  }
  console.log(`[refresh] diske yazildi (${snapshot.generatedAt})`)
}

/** Sadece deal satirlarindaki CheapShark gameID (sayisal). Steam app id / metin id yok. */
function prioritizedDealGameIds(snapshot) {
  const out = []
  const seen = new Set()
  const pushDealId = (deal) => {
    const raw = deal?.gameID ?? deal?.gameId
    const s = String(raw ?? '').trim()
    if (!/^\d+$/.test(s) || seen.has(s)) return
    seen.add(s)
    out.push(s)
  }

  for (const deal of snapshot.popular || []) pushDealId(deal)
  for (const deal of snapshot.discounted || []) pushDealId(deal)
  for (const deal of snapshot.newReleases || []) pushDealId(deal)
  for (const deal of snapshot.free100 || []) pushDealId(deal)

  return out.slice(0, MAX_GAME_DETAILS)
}

async function refreshCuratedBySearch(snapshot) {
  let ok = 0
  let fail = 0
  const rows = snapshot.curatedPopular || []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row?.seed) continue
    const seed = row.seed
    try {
      const searchList = await getJson(`${CHEAP}/games?title=${encodeURIComponent(seed)}&limit=30`)
      await sleep(DELAY_MS)
      const pick = pickBestSearchMatch(seed, searchList)
      const gid = String(pick?.gameID ?? pick?.gameId ?? '').trim()
      if (!gid || !/^\d+$/.test(gid)) {
        fail++
        console.warn(`[refresh] curated eslesmedi: ${seed}`)
        await sleep(DELAY_MS)
        continue
      }
      const detail = await getJson(`${CHEAP}/games?id=${encodeURIComponent(gid)}`)
      snapshot.gameDetails = snapshot.gameDetails || {}
      snapshot.gameDetails[gid] = detail
      const info = detail?.info || {}
      const steam = String(info.steamAppID ?? pick?.steamAppID ?? '').trim()
      row.gameId = gid
      row.title = String(info.title ?? pick?.external ?? seed)
      row.thumb = info.thumb ?? pick?.thumb ?? row.thumb
      row.steamAppID = steam && steam !== '0' ? steam : null
      ok++
      await flushSnapshotToDisk(snapshot)
      if ((i + 1) % 25 === 0) console.log(`[refresh] curated ... ${i + 1}/${rows.length}`)
    } catch (e) {
      fail++
      console.warn(`[refresh] curated ${seed}: ${e.message || e}`)
    }
    await sleep(DELAY_MS)
  }
  console.log(`[refresh] curated tamam: ok=${ok} fail=${fail}`)
}

function steamIdsPrioritized(snapshot, dealGameIds) {
  const ids = []
  const seen = new Set()
  const push = (sid) => {
    const s = String(sid ?? '').trim()
    if (!s || s === '0' || seen.has(s)) return
    seen.add(s)
    ids.push(s)
  }

  for (const row of snapshot.curatedPopular || []) {
    push(row?.steamAppID)
  }
  for (const gid of dealGameIds) {
    const sid = snapshot.gameDetails?.[gid]?.info?.steamAppID
    push(sid)
  }
  return ids.slice(0, STEAM_DETAILS_CAP)
}

async function fetchSteamAppDetailsRaw(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&l=turkish&cc=tr`
  const data = await getJson(url, { retriesPerWave: 3, waves: 3 })
  const block = data?.[String(appId)]
  if (block?.success !== true || !block.data) return null
  return block.data
}

async function main() {
  const raw = await readFile(SNAPSHOT_PUBLIC, 'utf8')
  const snapshot = JSON.parse(raw)

  if (START_PAUSE_MS > 0) {
    console.log(`[refresh] baslangic beklemesi ${START_PAUSE_MS / 1000}s (API limit)`)
    await sleep(START_PAUSE_MS)
  }

  console.log('[refresh] Asama 1: vitrin (curated) baslik + detay')
  await refreshCuratedBySearch(snapshot)

  const ids = CURATED_ONLY ? [] : prioritizedDealGameIds(snapshot)
  if (!CURATED_ONLY) {
    console.log(`[refresh] Asama 2: CheapShark games?id — ${ids.length} oyun (deal gameID, max ${MAX_GAME_DETAILS})`)
  }

  let ok = 0
  let fail = 0
  let sinceFlush = 0
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    try {
      const detail = await getJson(`${CHEAP}/games?id=${encodeURIComponent(id)}`)
      snapshot.gameDetails = snapshot.gameDetails || {}
      snapshot.gameDetails[id] = detail
      ok++
      sinceFlush++
      if (sinceFlush >= SAVE_EVERY_N_DEALS) {
        sinceFlush = 0
        await flushSnapshotToDisk(snapshot)
      }
      if ((i + 1) % 50 === 0) console.log(`[refresh] deal-id ... ${i + 1}/${ids.length}`)
    } catch (e) {
      fail++
      if (fail <= 30) console.warn(`[refresh] game ${id}: ${e.message || e}`)
    }
    await sleep(DELAY_MS)
  }
  if (!CURATED_ONLY && ids.length > 0) {
    console.log(`[refresh] deal-id tamam: ok=${ok} fail=${fail}`)
  }

  if (STEAM_DETAILS_CAP > 0) {
    const steamIds = steamIdsPrioritized(snapshot, ids)
    console.log(`[refresh] Asama 3: Steam appdetails — ${steamIds.length} (cap ${STEAM_DETAILS_CAP})`)
    let sOk = 0
    for (const sid of steamIds) {
      try {
        const d = await fetchSteamAppDetailsRaw(sid)
        if (d) {
          snapshot.steamAppDetails = snapshot.steamAppDetails || {}
          snapshot.steamAppDetails[sid] = d
          sOk++
        }
      } catch (e) {
        console.warn(`[refresh] steam ${sid}: ${e.message || e}`)
      }
      await sleep(STEAM_DELAY_MS)
    }
    console.log(`[refresh] Steam tamam: ${sOk}`)
  }

  await flushSnapshotToDisk(snapshot)
  console.log(`[refresh] son yazim: ${SNAPSHOT_PUBLIC}`)

  const noDeals = (snapshot.curatedPopular || []).filter((r) => {
    const gid = String(r?.gameId ?? '').trim()
    return !gid || !hasDeals(snapshot.gameDetails?.[gid])
  })
  console.log(`[refresh] curated fiyatsiz kalan: ${noDeals.length}`)
}

main().catch((e) => {
  console.error('[refresh] failed:', e)
  process.exit(1)
})
