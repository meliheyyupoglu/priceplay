import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const CHEAPSHARK_BASE = 'https://www.cheapshark.com/api/1.0'
const DB_FILE = process.env.DEMO_DB_FILE || path.join(process.cwd(), 'data', 'cheapshark-db.json')
const OUT_FILE = process.env.DEMO_SNAPSHOT_OUT || path.join(process.cwd(), 'public', 'demo-snapshot.json')
const PAGE_SIZE = Number(process.env.DEMO_PAGE_SIZE || 60)
const PAGES_PER_RUN = Number(process.env.DEMO_PAGES_PER_RUN || 3)
const DETAILS_PER_RUN = Number(process.env.DEMO_DETAILS_PER_RUN || 60)
const STEAM_DETAILS_PER_RUN = Number(process.env.DEMO_STEAM_DETAILS_PER_RUN || 80)
// CheapShark'ın çözemediği başlıkları doğrudan Steam store search ile appId'e çevirip:
// steamAppDetails + gameDetails + curatedPopular backfill etmek için.
const STEAM_TITLE_RESOLVE_PER_RUN = Number(process.env.DEMO_STEAM_TITLE_RESOLVE_PER_RUN || 30)
const CURATED_PER_RUN = Number(process.env.DEMO_CURATED_PER_RUN || 20)
const SKIP_SEARCH = String(process.env.DEMO_SKIP_SEARCH || '0').trim() === '1'
const ONLY_BACKFILL_EXISTING = String(process.env.DEMO_ONLY_BACKFILL_EXISTING || '0').trim() === '1'
const ONLY_MISSING_PRICES = String(process.env.DEMO_ONLY_MISSING_PRICES || '0').trim() === '1'
const MISSING_PRICE_PER_RUN = Number(process.env.DEMO_MISSING_PRICE_PER_RUN || 30)

const CURATED_POPULAR_TITLES = [
  'Counter-Strike 2',
  'Apex Legends',
  'PUBG: BATTLEGROUNDS',
  "Tom Clancy's Rainbow Six Siege",
  'Call of Duty: Modern Warfare III',
  'Warzone',
  'Team Fortress 2',
  'Destiny 2',
  'Overwatch 2',
  'Hunt: Showdown',
  'Battlefield 2042',
  'Battlefield V',
  'Halo Infinite',
  'Insurgency: Sandstorm',
  'Quake Champions',
  "Baldur's Gate 3",
  'Elden Ring',
  'Cyberpunk 2077',
  'The Witcher 3: Wild Hunt',
  'Red Dead Redemption 2',
  'Grand Theft Auto V',
  "Dragon's Dogma 2",
  'Starfield',
  'Hogwarts Legacy',
  'Monster Hunter: World',
  'Monster Hunter Rise',
  'Dark Souls III',
  'Sekiro: Shadows Die Twice',
  'Ghost of Tsushima',
  'Horizon Forbidden West',
  'God of War',
  "Assassin's Creed Valhalla",
  'Fallout 4',
  'Fallout 76',
  'Skyrim Special Edition',
  'Lies of P',
  'Final Fantasy VII Rebirth',
  'Final Fantasy VII Remake',
  'Yakuza: Like a Dragon',
  'Like a Dragon: Infinite Wealth',
  'Persona 5 Royal',
  'Palworld',
  'Rust',
  'DayZ',
  'ARK: Survival Ascended',
  'Sons of the Forest',
  'The Forest',
  'Enshrouded',
  'Valheim',
  '7 Days to Die',
  'Project Zomboid',
  'Lethal Company',
  'Dead by Daylight',
  'Phasmophobia',
  'Subnautica',
  'Terraria',
  'Minecraft',
  'Raft',
  'Green Hell',
  'SCUM',
  'Resident Evil 4 Remake',
  'Manor Lords',
  'Hearts of Iron IV',
  'Europa Universalis IV',
  'Crusader Kings III',
  "Sid Meier's Civilization VI",
  'Cities: Skylines II',
  'Cities: Skylines',
  'Stellaris',
  'Age of Empires II: Definitive Edition',
  'Age of Empires IV',
  'Total War: WARHAMMER III',
  'Football Manager 2024',
  'Farming Simulator 22',
  'Euro Truck Simulator 2',
  'American Truck Simulator',
  'RimWorld',
  'Factorio',
  'Satisfactory',
  'Anno 1800',
  'Microsoft Flight Simulator',
  'Hades II',
  'Hades',
  'Balatro',
  'Vampire Survivors',
  'Slay the Spire',
  'Dead Cells',
  'Hollow Knight',
  'Stardew Valley',
  'Dave the Diver',
  'Outer Wilds',
  'Risk of Rain 2',
  'Cult of the Lamb',
  'Deep Rock Galactic',
  'Sea of Thieves',
  "No Man's Sky",
  'EA SPORTS FC 24',
  'Forza Horizon 5',
  'Rocket League',
  'Assetto Corsa',
  'War Thunder',
]

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
    cursors: { popular: 0, discounted: 0, newReleases: 0, free100: 0, curatedSeedIndex: 0 },
    stores: [],
    deals: { popular: [], discounted: [], newReleases: [], free100: [] },
    searches: {},
    gameDetails: {},
    steamAppDetails: {},
    curatedPopular: {},
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

function hasDeals(payload) {
  const deals = payload?.deals
  return Array.isArray(deals) && deals.length > 0
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
      const o = x
      const title = String(o.external ?? o.title ?? '').trim()
      const t = normText(title)
      let score = 0
      if (t === want) score += 1000
      if (t.includes(want)) score += 400
      if (want.includes(t)) score += 250
      const words = want.split(' ').filter((w) => w.length > 2)
      for (const w of words) {
        if (t.includes(w)) score += 30
      }
      return { raw: o, score }
    })
    .sort((a, b) => b.score - a.score)
  return scored[0]?.raw ?? null
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

async function fetchSteamAppDetailsRaw(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&l=turkish&cc=tr`
  const data = await getJson(url)
  if (!data || typeof data !== 'object') return null
  const block = data[String(appId)]
  if (!block || typeof block !== 'object') return null
  if (block.success !== true || !block.data || typeof block.data !== 'object') return null
  return block.data
}

function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function pickBestSteamSearchMatch(wantTitle, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const want = normText(wantTitle)

  const scored = candidates
    .filter((c) => c && typeof c === 'object' && c.appId && c.title)
    .map((c) => {
      const t = normText(c.title)
      let score = 0
      if (t === want) score += 1000
      if (t.includes(want)) score += 400
      if (want.includes(t)) score += 250
      const words = want.split(' ').filter((w) => w.length > 2)
      for (const w of words) {
        if (t.includes(w)) score += 30
      }
      return { raw: c, score }
    })
    .sort((a, b) => b.score - a.score)

  const top = scored[0]
  if (!top) return null
  return { ...top.raw, score: top.score }
}

async function fetchSteamSearchCandidates(term) {
  const url = `https://store.steampowered.com/search/?term=${encodeURIComponent(term)}`
  const r = await fetch(url, { headers: { Accept: 'text/html' } })
  if (!r.ok) return []
  const html = await r.text()

  const rowRe =
    /data-ds-appid\s*=\s*"(\d+)"[\s\S]{0,4000}?<span[^>]*class\s*=\s*"title"[^>]*>([^<]*)<\/span>/g

  const out = []
  for (const m of html.matchAll(rowRe)) {
    const appId = String(m[1] || '').trim()
    const title = decodeHtmlEntities(String(m[2] || '').trim())
    if (!appId || !title) continue
    out.push({ appId, title })
  }
  return out
}

async function main() {
  const db = await loadDb()
  console.log('[demo-snapshot] harvest source:', CHEAPSHARK_BASE)
  let hit429 = false
  const runStage = async (fn) => {
    try {
      await fn()
      return true
    } catch (e) {
      if (e?.code === 'RATE_LIMIT') {
        hit429 = true
        return false
      }
      throw e
    }
  }

  try {
    if (!Array.isArray(db.stores) || db.stores.length === 0) {
      db.stores = await getJson(`${CHEAPSHARK_BASE}/stores`, { allow429: true })
    }
    if (!ONLY_BACKFILL_EXISTING && !ONLY_MISSING_PRICES) {
      await runStage(async () =>
        harvestDeals(db, 'popular', (page) => ({
          sortBy: 'Deal Rating',
          pageSize: String(PAGE_SIZE),
          pageNumber: String(page),
        })),
      )
      await runStage(async () =>
        harvestDeals(db, 'discounted', (page) => ({
          onSale: '1',
          sortBy: 'Savings',
          pageSize: String(PAGE_SIZE),
          pageNumber: String(page),
        })),
      )
      await runStage(async () =>
        harvestDeals(db, 'newReleases', (page) => ({
          sortBy: 'Release',
          pageSize: String(PAGE_SIZE),
          pageNumber: String(page),
        })),
      )
      await runStage(async () =>
        harvestDeals(db, 'free100', (page) => ({
          onSale: '1',
          sortBy: 'Savings',
          pageSize: String(PAGE_SIZE),
          pageNumber: String(page),
        })),
      )
    }

    if (!SKIP_SEARCH && !ONLY_BACKFILL_EXISTING && !ONLY_MISSING_PRICES) {
      await runStage(async () => {
        for (const term of SEARCH_TERMS) {
          const q = term.toLowerCase()
          if (Array.isArray(db.searches[q]) && db.searches[q].length > 0) continue
          const list = await getJson(`${CHEAPSHARK_BASE}/games?title=${encodeURIComponent(term)}&limit=40`, {
            allow429: true,
          })
          db.searches[q] = Array.isArray(list) ? list : []
          await new Promise((r) => setTimeout(r, 90))
        }
      })
    }

    await runStage(async () => {
      let idx = Number(db.cursors.curatedSeedIndex || 0)
      let processed = 0
      while (idx < CURATED_POPULAR_TITLES.length && processed < CURATED_PER_RUN) {
        const seed = CURATED_POPULAR_TITLES[idx]
        const searchList = await getJson(
          `${CHEAPSHARK_BASE}/games?title=${encodeURIComponent(seed)}&limit=30`,
          { allow429: true },
        )
        const pick = pickBestSearchMatch(seed, searchList)
        if (pick) {
          const gameId = String(pick.gameID ?? pick.gameId ?? '').trim()
          if (gameId) {
            if (!db.gameDetails[gameId]) {
              const detail = await getJson(`${CHEAPSHARK_BASE}/games?id=${encodeURIComponent(gameId)}`, {
                allow429: true,
              })
              db.gameDetails[gameId] = detail
              await new Promise((r) => setTimeout(r, 70))
            }
            const payload = db.gameDetails[gameId] || {}
            const info = payload.info || {}
            const steamId = String(info.steamAppID ?? pick.steamAppID ?? '').trim()
            db.curatedPopular[seed] = {
              seed,
              gameId,
              title: String(info.title ?? pick.external ?? seed),
              thumb: info.thumb ?? pick.thumb ?? null,
              steamAppID: steamId && steamId !== '0' ? steamId : null,
            }
            if (steamId && steamId !== '0' && !db.steamAppDetails[steamId]) {
              try {
                const steamData = await fetchSteamAppDetailsRaw(steamId)
                if (steamData) db.steamAppDetails[steamId] = steamData
              } catch {
                // no-op
              }
              await new Promise((r) => setTimeout(r, 70))
            }
          }
        }
        idx += 1
        processed += 1
      }
      db.cursors.curatedSeedIndex = idx
    })

    await runStage(async () => {
      const candidates = CURATED_POPULAR_TITLES.filter((seed) => {
        const cur = db.curatedPopular?.[seed]
        if (!cur) return true
        const gid = String(cur.gameId ?? '').trim()
        if (!gid) return true
        return !hasDeals(db.gameDetails?.[gid])
      }).slice(0, MISSING_PRICE_PER_RUN)

      for (const seed of candidates) {
        const cur = db.curatedPopular?.[seed] || {}
        let gid = String(cur.gameId ?? '').trim()
        let detail = null

        if (gid) {
          try {
            detail = await getJson(`${CHEAPSHARK_BASE}/games?id=${encodeURIComponent(gid)}`, { allow429: true })
            db.gameDetails[gid] = detail
            await new Promise((r) => setTimeout(r, 70))
          } catch {
            detail = null
          }
        }

        if (!hasDeals(detail)) {
          const searchList = await getJson(
            `${CHEAPSHARK_BASE}/games?title=${encodeURIComponent(seed)}&limit=30`,
            { allow429: true },
          )
          const pick = pickBestSearchMatch(seed, searchList)
          const altId = String(pick?.gameID ?? pick?.gameId ?? '').trim()
          if (altId) {
            const altDetail = await getJson(`${CHEAPSHARK_BASE}/games?id=${encodeURIComponent(altId)}`, {
              allow429: true,
            })
            db.gameDetails[altId] = altDetail
            if (hasDeals(altDetail)) {
              gid = altId
              const info = altDetail?.info || {}
              const sid = String(info?.steamAppID ?? pick?.steamAppID ?? '').trim()
              db.curatedPopular[seed] = {
                seed,
                gameId: gid,
                title: String(info?.title ?? pick?.external ?? seed),
                thumb: info?.thumb ?? pick?.thumb ?? null,
                steamAppID: sid && sid !== '0' ? sid : null,
              }
            }
            await new Promise((r) => setTimeout(r, 70))
          }
        }
      }
    })

    // CheapShark'tan çözülemeyen / db'de olmayan başlıkları direkt Steam'den appId'e çevirip backfill et.
    // (Amaç: kullanıcı listesini Steam görselleri + Steam appdetails ile desteklemek.)
    await (async () => {
      const missingSeeds = CURATED_POPULAR_TITLES.filter((seed) => {
        const entry = db.curatedPopular?.[seed]
        const sid = entry?.steamAppID != null ? String(entry.steamAppID).trim() : null
        if (!sid || sid === '0') return true
        if (!db.steamAppDetails?.[sid]) return true

        // Seed başlığı ile Steam'deki ad eşleşmiyorsa (örn. Valorant -> Valor gibi) yeniden resolve et.
        const steamName = db.steamAppDetails?.[sid]?.name ?? db.gameDetails?.[sid]?.info?.title ?? ''
        if (steamName && normText(steamName) !== normText(seed)) return true

        return false
      }).slice(0, STEAM_TITLE_RESOLVE_PER_RUN)

      for (const seed of missingSeeds) {
        try {
          const candidates = await fetchSteamSearchCandidates(seed)
          const best = pickBestSteamSearchMatch(seed, candidates)

          // Çok zayıf eşleşme ihtimalinde yanlış appId yazmak yerine "bulunamadı" olarak işaretle.
          if (!best?.appId || best.score < 600) {
            // Seed'i başlıkla tut, ama steamAppID boş kalsın.
            if (!db.gameDetails[seed]) {
              db.gameDetails[seed] = {
                info: { title: seed, steamAppID: null, thumb: null },
                deals: [],
              }
            } else {
              const existingInfo = db.gameDetails[seed]?.info || {}
              db.gameDetails[seed].info = {
                ...existingInfo,
                title: seed,
                thumb: existingInfo.thumb ?? null,
                steamAppID: null,
              }
              if (!Array.isArray(db.gameDetails[seed].deals)) db.gameDetails[seed].deals = []
            }

            db.curatedPopular[seed] = {
              seed,
              gameId: seed,
              title: seed,
              thumb: null,
              steamAppID: null,
            }

            continue
          }

          const appId = best.appId
          const steamData = db.steamAppDetails?.[appId] || (await fetchSteamAppDetailsRaw(appId))
          if (!steamData) continue

          db.steamAppDetails[appId] = steamData

          const title = String(steamData.name ?? best?.title ?? seed).trim() || seed
          const thumb = steamData.header_image != null ? String(steamData.header_image) : null

          if (!db.gameDetails[appId]) {
            db.gameDetails[appId] = {
              info: { title, steamAppID: String(appId), thumb },
              deals: [],
            }
          } else {
            const existingInfo = db.gameDetails[appId]?.info || {}
            db.gameDetails[appId].info = {
              ...existingInfo,
              title,
              thumb: existingInfo.thumb ?? thumb,
              steamAppID: existingInfo.steamAppID ?? String(appId),
            }
            if (!Array.isArray(db.gameDetails[appId].deals)) db.gameDetails[appId].deals = []
          }

          db.curatedPopular[seed] = {
            seed,
            gameId: String(appId),
            title,
            thumb,
            steamAppID: String(appId),
          }
        } catch {
          // tek seed'de hata olursa durma
        }

        await new Promise((r) => setTimeout(r, 140))
      }
    })()

    await runStage(async () => {
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
    })

    const steamIds = []
    const steamSeen = new Set()
    for (const payload of Object.values(db.gameDetails || {})) {
      const info = payload?.info
      const sid = info?.steamAppID != null ? String(info.steamAppID).trim() : ''
      if (!sid || sid === '0' || steamSeen.has(sid)) continue
      steamSeen.add(sid)
      steamIds.push(sid)
    }
    const missingSteamIds = steamIds.filter((sid) => !db.steamAppDetails[sid]).slice(0, STEAM_DETAILS_PER_RUN)
    for (const sid of missingSteamIds) {
      try {
        const steamData = await fetchSteamAppDetailsRaw(sid)
        if (steamData) db.steamAppDetails[sid] = steamData
      } catch (_e) {
        // Steam tarafındaki tekil hatalar toplam hasadı durdurmasın.
      }
      await new Promise((r) => setTimeout(r, 70))
    }
  } catch (e) {
    throw e
  }

  if (hit429) {
    console.warn('[demo-snapshot] 429 alindi, bu turda CheapShark asamalari kisitlandi.')
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
    steamAppDetails: db.steamAppDetails || {},
    curatedPopular: CURATED_POPULAR_TITLES.map((seed) => db.curatedPopular?.[seed]).filter(Boolean),
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(snapshot), 'utf8')
  console.log(`[demo-snapshot] db: ${DB_FILE}`)
  console.log(`[demo-snapshot] written: ${OUT_FILE}`)
  console.log(
    `[demo-snapshot] sizes curated=${snapshot.curatedPopular.length} popular=${snapshot.popular.length} discounted=${snapshot.discounted.length} new=${snapshot.newReleases.length} free=${snapshot.free100.length} details=${Object.keys(snapshot.gameDetails).length} steam=${Object.keys(snapshot.steamAppDetails).length}`,
  )
  const curatedNoDeals = CURATED_POPULAR_TITLES.filter((seed) => {
    const cur = db.curatedPopular?.[seed]
    const gid = String(cur?.gameId ?? '').trim()
    if (!gid) return true
    return !hasDeals(db.gameDetails?.[gid])
  })
  console.log(`[demo-snapshot] curated_no_price_count=${curatedNoDeals.length}`)
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
