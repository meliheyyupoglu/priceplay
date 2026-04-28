import { CHEAPSHARK_BASE } from '../config'
import { releaseYearFromGame } from '../lib/gameRelease'
import { F2P_POPULAR_SEEDS } from '../lib/freeToPlaySeeds'
import type { Game, PriceRow } from '../types'
import { fetchSteamPriceOverview } from './steam'

const headers = {
  Accept: 'application/json',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'User-Agent': 'PricePlayWeb/1.0',
}

type DemoSnapshot = {
  generatedAt: string
  stores?: unknown[]
  popular?: unknown[]
  discounted?: unknown[]
  newReleases?: unknown[]
  free100?: unknown[]
  searches?: Record<string, unknown[]>
  gameDetails?: Record<string, Record<string, unknown>>
  steamAppDetails?: Record<string, Record<string, unknown>>
}

const DEMO_SNAPSHOT_MODE = String(import.meta.env.VITE_DEMO_SNAPSHOT_MODE ?? '1').trim() === '1'
let demoSnapshotCache: DemoSnapshot | null = null

async function getDemoSnapshot(): Promise<DemoSnapshot> {
  if (!DEMO_SNAPSHOT_MODE) throw new Error('DEMO snapshot mode disabled')
  if (demoSnapshotCache) return demoSnapshotCache
  const r = await fetch('/demo-snapshot.json', {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`Demo snapshot yuklenemedi: ${r.status}`)
  const data = (await r.json()) as DemoSnapshot
  demoSnapshotCache = data
  return data
}

function parseGamesFromUnknownArray(list: unknown[] | undefined): Game[] {
  if (!Array.isArray(list)) return []
  const out: Game[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const g = parseGame(raw as Record<string, unknown>)
    if (!g) continue
    const k = g.gameId || g.title
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(g)
  }
  return out
}

function buildFallbackGamePayloadFromSnapshot(
  gameId: string,
  snap: DemoSnapshot,
): Record<string, unknown> | null {
  const pools = [snap.popular ?? [], snap.discounted ?? [], snap.newReleases ?? [], snap.free100 ?? []]
  const matchedDeals: Record<string, unknown>[] = []
  let title = gameId
  let thumb: string | null = null
  let steamAppID: string | null = null

  for (const pool of pools) {
    for (const raw of pool) {
      if (!raw || typeof raw !== 'object') continue
      const o = raw as Record<string, unknown>
      const id = String(o.gameID ?? o.gameId ?? '').trim()
      if (id !== gameId) continue
      title = String(o.title ?? o.external ?? title).trim() || title
      if (!thumb && o.thumb != null) thumb = String(o.thumb)
      const sid = o.steamAppID != null ? String(o.steamAppID).trim() : ''
      if (!steamAppID && sid && sid !== '0') steamAppID = sid
      matchedDeals.push({
        storeID: String(o.storeID ?? ''),
        salePrice: String(o.salePrice ?? o.price ?? '0'),
        retailPrice: String(o.normalPrice ?? o.retailPrice ?? '0'),
        savings: String(o.savings ?? '0'),
        dealRating: String(o.dealRating ?? '0'),
        dealID: String(o.dealID ?? ''),
        releaseDate: String(o.releaseDate ?? ''),
      })
    }
  }

  if (matchedDeals.length === 0) return null
  return {
    info: {
      title,
      thumb,
      steamAppID: steamAppID ?? null,
    },
    deals: matchedDeals,
  } as Record<string, unknown>
}

async function fetchJsonOrFallback<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url, { headers })
    if (!r.ok) {
      if (r.status >= 500 || r.status === 429 || r.status === 503) return fallback
      throw new Error(`CheapShark yanit hatasi: ${r.status}`)
    }
    return (await r.json()) as T
  } catch {
    return fallback
  }
}

function parseGame(raw: Record<string, unknown>): Game | null {
  const gameId =
    String(raw.gameID ?? raw.gameId ?? '')
      .trim() || ''
  const title =
    String(raw.title ?? raw.external ?? 'Bilinmeyen oyun').trim() || 'Bilinmeyen oyun'
  const sid = raw.steamAppID ?? raw.steamAppId ?? raw.steam_app_id
  const steamStr = sid != null ? String(sid).trim() : ''
  const steamAppId = steamStr && steamStr !== '0' ? steamStr : null
  if (!gameId && !title) return null
  return {
    gameId,
    title,
    steamAppId,
    cheapest: raw.salePrice != null ? String(raw.salePrice) : raw.cheapest != null ? String(raw.cheapest) : null,
    normalPrice: raw.normalPrice != null ? String(raw.normalPrice) : null,
    savings: raw.savings != null ? String(raw.savings) : null,
    cheapestDealId:
      raw.cheapestDealID != null
        ? String(raw.cheapestDealID)
        : raw.dealID != null
          ? String(raw.dealID)
          : null,
    thumb: raw.thumb != null ? String(raw.thumb) : null,
    metacriticScore:
      raw.metacriticScore != null && String(raw.metacriticScore).trim() !== ''
        ? String(raw.metacriticScore)
        : null,
    steamRatingText:
      raw.steamRatingText != null && String(raw.steamRatingText).trim() !== ''
        ? String(raw.steamRatingText)
        : null,
    releaseDate:
      raw.releaseDate != null && String(raw.releaseDate).trim() !== ''
        ? String(raw.releaseDate)
        : null,
  }
}

function metacriticNum(g: Game): number {
  const n = parseInt(String(g.metacriticScore ?? '0'), 10)
  return Number.isFinite(n) ? n : 0
}

function isNearlyFreePrice(g: Game): boolean {
  const p = parseFloat(String(g.cheapest ?? '').replace(',', '.'))
  return Number.isFinite(p) && p < 0.05
}

/** Listede fiyatı varken geçici %100 indirim — F2P vitrininden çıkarılır. */
function isEphemeralHundredPercentFree(g: Game): boolean {
  const sale = parseFloat(String(g.cheapest ?? '999').replace(',', '.'))
  const retail = parseFloat(String(g.normalPrice ?? '0').replace(',', '.'))
  const sav = parseFloat(String(g.savings ?? '0').replace(',', '.'))
  if (!Number.isFinite(sale) || sale > 0.05) return false
  if (!Number.isFinite(retail) || retail < 0.5) return false
  if (!Number.isFinite(sav) || sav < 99) return false
  return true
}

function pickPermanentF2PCandidate(results: Game[], seed: string): Game | null {
  if (!results.length) return null
  const s = seed.toLowerCase().trim()
  const words = s.split(/\s+/).filter((w) => w.length > 1)

  const pool = results.filter(isNearlyFreePrice).filter((g) => !isEphemeralHundredPercentFree(g))
  const use = pool.length ? pool : []

  if (!use.length) return null

  const exact = use.find((g) => g.title.trim().toLowerCase() === s)
  if (exact) return exact

  const inc = use.find((g) => g.title.toLowerCase().includes(s))
  if (inc) return inc

  const wordMatch = use.find(
    (g) => words.length > 0 && words.every((w) => w.length > 2 && g.title.toLowerCase().includes(w)),
  )
  if (wordMatch) return wordMatch

  return use[0] ?? null
}

function readMetacriticFromGamePayload(payload: Record<string, unknown>): string | null {
  const info = payload.info as Record<string, unknown> | undefined
  const raw = info?.metacriticScore ?? info?.metacritic ?? payload.metacriticScore
  if (raw == null) return null
  const t = String(raw).trim()
  if (t === '' || t === '0') return null
  return t
}

async function enrichGameFromDetail(g: Game): Promise<Game> {
  if (!g.gameId?.trim()) return g
  try {
    const payload = await fetchGameJson(g.gameId)
    const info = payload.info as Record<string, unknown> | undefined
    const m = readMetacriticFromGamePayload(payload)
    const st =
      info?.steamRatingText != null && String(info.steamRatingText).trim()
        ? String(info.steamRatingText)
        : g.steamRatingText
    const thumb = g.thumb?.trim() ? g.thumb : info?.thumb != null ? String(info.thumb) : g.thumb
    return {
      ...g,
      metacriticScore: m ?? g.metacriticScore,
      steamRatingText: st ?? g.steamRatingText,
      thumb: thumb ?? null,
    }
  } catch {
    return g
  }
}

async function enrichGamesInBatches(games: Game[], concurrency: number): Promise<Game[]> {
  const out: Game[] = []
  for (let i = 0; i < games.length; i += concurrency) {
    const chunk = games.slice(i, i + concurrency)
    const done = await Promise.all(chunk.map((g) => enrichGameFromDetail(g)))
    out.push(...done)
    if (i + concurrency < games.length) await new Promise((r) => setTimeout(r, 100))
  }
  return out
}

/**
 * Sürekli ücretsiz (F2P) bilinen başlıklar; geçici %100 indirimli ücretsiz teklifler hariç.
 * Metacritic için oyun detayı çağrılır, skora göre yüksekten düşüğe sıralanır.
 */
export async function fetchCuratedFreeToPlayByMetacritic(maxGames = 24): Promise<Game[]> {
  const seen = new Set<string>()
  const picks: Game[] = []
  for (const seed of F2P_POPULAR_SEEDS) {
    if (seen.size >= Math.max(maxGames * 2, 48)) break
    try {
      const list = await searchGames(seed, 18)
      const pick = pickPermanentF2PCandidate(list, seed)
      if (!pick) continue
      const k = pick.gameId || pick.title
      if (!k || seen.has(k)) continue
      seen.add(k)
      picks.push(pick)
    } catch {
      /* tek tohum atlanır */
    }
    await new Promise((r) => setTimeout(r, 85))
  }
  const enriched = await enrichGamesInBatches(picks, 4)
  enriched.sort((a, b) => {
    const d = metacriticNum(b) - metacriticNum(a)
    if (d !== 0) return d
    return a.title.localeCompare(b.title)
  })
  return enriched.slice(0, maxGames)
}

let storeNameCache: Record<string, string> | null = null
let storeNameFetched = 0
const STORE_TTL_MS = 24 * 60 * 60 * 1000

export async function fetchStoreNames(): Promise<Record<string, string>> {
  const now = Date.now()
  if (storeNameCache && now - storeNameFetched < STORE_TTL_MS) return storeNameCache

  const list = DEMO_SNAPSHOT_MODE
    ? ((await getDemoSnapshot()).stores ?? [])
    : await fetchJsonOrFallback<unknown[]>(`${CHEAPSHARK_BASE}/stores`, [])
  const map: Record<string, string> = {}
  for (const e of list) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    const id = String(o.storeID ?? '')
    if (!id) continue
    map[id] = String(o.storeName ?? `Mağaza ${id}`)
  }
  storeNameCache = map
  storeNameFetched = now
  return map
}

function uniqueDealsToGames(data: unknown[], seen: Set<string>, out: Game[]) {
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue
    const g = parseGame(raw as Record<string, unknown>)
    if (!g) continue
    const k = g.gameId || g.title
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(g)
  }
}

export async function fetchPopularGames(pageCount = 4): Promise<Game[]> {
  if (DEMO_SNAPSHOT_MODE) {
    const snap = await getDemoSnapshot()
    const list = parseGamesFromUnknownArray(snap.popular)
    return list.slice(0, Math.max(1, pageCount) * 60)
  }
  const seen = new Set<string>()
  const out: Game[] = []
  for (let page = 0; page < pageCount; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?sortBy=Deal%20Rating&pageSize=60&pageNumber=${page}`
    const data = await fetchJsonOrFallback<unknown[]>(url, [])
    uniqueDealsToGames(data, seen, out)
    if (page < pageCount - 1) await new Promise((res) => setTimeout(res, 120))
  }
  return out
}

export async function fetchDiscountedGames(pageCount = 4): Promise<Game[]> {
  if (DEMO_SNAPSHOT_MODE) {
    const snap = await getDemoSnapshot()
    const list = parseGamesFromUnknownArray(snap.discounted)
    return list.slice(0, Math.max(1, pageCount) * 60)
  }
  const seen = new Set<string>()
  const out: Game[] = []
  for (let page = 0; page < pageCount; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?onSale=1&sortBy=Savings&pageSize=60&pageNumber=${page}`
    const data = await fetchJsonOrFallback<unknown[]>(url, [])
    uniqueDealsToGames(data, seen, out)
    if (page < pageCount - 1) await new Promise((res) => setTimeout(res, 120))
  }
  return out
}

/** Eskiden ücretli, şu an ~ücretsiz (%100’e yakın indirim, liste fiyatı > 0). */

/**
 * CheapShark `sortBy=Release` ile sayfalar; çıkış tarihi bilinenleri en yeni tarihe göre sıralar.
 * Tarihi bilinmeyenleri en sona koyup listeyi doldurur, böylece vitrin boş kalmaz.
 */
export async function fetchNewReleaseDeals(maxGames = 20, pageCount = 16): Promise<Game[]> {
  if (DEMO_SNAPSHOT_MODE) {
    const snap = await getDemoSnapshot()
    const list = parseGamesFromUnknownArray(snap.newReleases)
    const cap = Math.max(maxGames, pageCount * 60)
    return list.slice(0, cap)
  }
  const poolSeen = new Set<string>()
  const pool: Game[] = []
  const sortBy = encodeURIComponent('Release')
  for (let page = 0; page < pageCount; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?sortBy=${sortBy}&pageSize=60&pageNumber=${page}`
    const data = await fetchJsonOrFallback<unknown[]>(url, [])
    for (const raw of data) {
      if (!raw || typeof raw !== 'object') continue
      const g = parseGame(raw as Record<string, unknown>)
      if (!g) continue
      const k = g.gameId || g.title
      if (!k || poolSeen.has(k)) continue
      poolSeen.add(k)
      pool.push(g)
    }
    if (pool.length >= Math.max(maxGames * 4, 72)) break
    if (page < pageCount - 1) await new Promise((res) => setTimeout(res, 130))
  }
  if (pool.length === 0) return []
  const withDate = pool
    .filter((g) => releaseYearFromGame(g) != null)
    .sort((a, b) => {
      const ta = parseInt(String(a.releaseDate ?? '0'), 10)
      const tb = parseInt(String(b.releaseDate ?? '0'), 10)
      return tb - ta
    })
  const withoutDate = pool.filter((g) => releaseYearFromGame(g) == null)
  const ordered = [...withDate, ...withoutDate]
  const enrichCap = Math.min(ordered.length, 96)
  const enriched = await enrichGamesInBatches(ordered.slice(0, enrichCap), 3)
  return enriched.slice(0, maxGames)
}

export async function fetchHundredPercentFreeDeals(maxGames = 20, maxPages = 10): Promise<Game[]> {
  if (DEMO_SNAPSHOT_MODE) {
    const snap = await getDemoSnapshot()
    const list = parseGamesFromUnknownArray(snap.free100)
    const cap = Math.max(maxGames, maxPages * 60)
    return list.slice(0, cap)
  }
  const seen = new Set<string>()
  const out: Game[] = []
  for (let page = 0; page < maxPages && out.length < maxGames; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?onSale=1&sortBy=Savings&pageSize=60&pageNumber=${page}`
    const data = await fetchJsonOrFallback<unknown[]>(url, [])
    for (const raw of data) {
      if (!raw || typeof raw !== 'object') continue
      const g = parseGame(raw as Record<string, unknown>)
      if (!g) continue
      const sale = parseFloat(g.cheapest ?? '999')
      const retail = parseFloat(g.normalPrice ?? '0')
      const sav = parseFloat(g.savings ?? '0')
      if (!Number.isFinite(sale) || sale > 0.05) continue
      if (!Number.isFinite(retail) || retail < 0.5) continue
      if (!Number.isFinite(sav) || sav < 99) continue
      const k = g.gameId || g.title
      if (!k || seen.has(k)) continue
      seen.add(k)
      out.push(g)
      if (out.length >= maxGames) break
    }
    if (page < maxPages - 1) await new Promise((r) => setTimeout(r, 100))
  }
  return out
}

export async function searchGames(title: string, limit = 20): Promise<Game[]> {
  if (DEMO_SNAPSHOT_MODE) {
    const snap = await getDemoSnapshot()
    const q = title.trim().toLowerCase()
    const exact = parseGamesFromUnknownArray(snap.searches?.[q])
    if (exact.length > 0) return exact.slice(0, limit)
    const pool = [
      ...parseGamesFromUnknownArray(snap.popular),
      ...parseGamesFromUnknownArray(snap.discounted),
      ...parseGamesFromUnknownArray(snap.newReleases),
      ...parseGamesFromUnknownArray(snap.free100),
    ]
    const uniq = new Map<string, Game>()
    for (const g of pool) {
      const k = g.gameId || g.title
      if (!k || uniq.has(k)) continue
      uniq.set(k, g)
    }
    return [...uniq.values()]
      .filter((g) => g.title.toLowerCase().includes(q))
      .slice(0, limit)
  }
  const q = encodeURIComponent(title.trim())
  const url = `${CHEAPSHARK_BASE}/games?title=${q}&limit=${limit}`
  const data = await fetchJsonOrFallback<unknown[]>(url, [])
  const out: Game[] = []
  for (const e of data) {
    if (!e || typeof e !== 'object') continue
    const g = parseGame(e as Record<string, unknown>)
    if (g) out.push(g)
  }
  return out
}

export async function fetchGameJson(gameId: string): Promise<Record<string, unknown>> {
  if (DEMO_SNAPSHOT_MODE) {
    const snap = await getDemoSnapshot()
    const hit = snap.gameDetails?.[String(gameId)]
    if (hit && typeof hit === 'object') return hit
    const fallbackFromDeals = buildFallbackGamePayloadFromSnapshot(String(gameId), snap)
    if (fallbackFromDeals) return fallbackFromDeals
    const fallbackTitle = String(gameId || 'Unknown Game').trim() || 'Unknown Game'
    return {
      info: { title: fallbackTitle, steamAppID: null, thumb: null },
      deals: [],
    } as Record<string, unknown>
  }
  const url = `${CHEAPSHARK_BASE}/games?id=${encodeURIComponent(gameId)}`
  const r = await fetch(url, { headers })
  if (!r.ok) {
    if (r.status === 429) {
      throw new Error(
        'CheapShark şu an çok meşgul (429). 30–60 saniye sonra sayfayı yenile veya biraz bekleyip tekrar dene.',
      )
    }
    let detail = ''
    try {
      const j = (await r.json()) as { detail?: string; error?: string }
      detail = j.detail || j.error || ''
    } catch {
      /* gövde JSON değil */
    }
    throw new Error(detail ? `Oyun detayı (${r.status}): ${detail}` : `Oyun detayı: ${r.status}`)
  }
  return (await r.json()) as Record<string, unknown>
}

export async function buildPriceRows(
  game: Game,
  gamePayload: Record<string, unknown>,
): Promise<PriceRow[]> {
  const storeNames = await fetchStoreNames()
  const info = gamePayload.info as Record<string, unknown> | undefined
  const steamFromApi = info?.steamAppID != null ? String(info.steamAppID).trim() : ''
  const steamApp =
    game.steamAppId?.trim() ||
    (steamFromApi && steamFromApi !== '0' ? steamFromApi : null)

  const deals = gamePayload.deals as unknown[] | undefined
  if (!deals?.length) return []

  const rows: PriceRow[] = []
  for (const raw of deals) {
    if (!raw || typeof raw !== 'object') continue
    const d = raw as Record<string, unknown>
    const sid = String(d.storeID ?? '')
    const name = storeNames[sid] ?? `Mağaza ${sid}`
    const saleRaw = d.salePrice ?? d.price
    rows.push({
      storeId: sid,
      storeName: name,
      salePrice: String(saleRaw ?? '0'),
      retailPrice: String(d.retailPrice ?? '0'),
      savings: String(d.savings ?? '0'),
      dealRating: String(d.dealRating ?? '0'),
      dealId: String(d.dealID ?? ''),
      releaseDate: String(d.releaseDate ?? ''),
      isSteamDirect: false,
    })
  }

  if (steamApp) {
    try {
      const steam = await fetchSteamPriceOverview(steamApp)
      if (steam) {
        const filtered = rows.filter((p) => p.storeId !== '1')
        filtered.unshift({
          storeId: '1',
          storeName: 'Steam',
          salePrice: String(steam.final / 100),
          retailPrice: String(steam.initial / 100),
          savings: String(steam.discount_percent),
          dealRating: '10',
          dealId: '',
          releaseDate: '',
          displaySaleLabel: steam.final_formatted,
          displayRetailLabel: steam.initial_formatted,
          isSteamDirect: true,
        })
        rows.length = 0
        rows.push(...filtered)
      }
    } catch {
      /* Steam fiyatı yoksa CheapShark satırları yeter */
    }
  }

  rows.sort((a, b) => {
    const pa = parseFloat(a.salePrice) || 0
    const pb = parseFloat(b.salePrice) || 0
    return pa - pb
  })

  return rows
}
