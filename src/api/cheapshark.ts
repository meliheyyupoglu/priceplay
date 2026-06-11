import { CHEAPSHARK_BASE } from '../config'
import { genreLabelFor } from '../lib/genreTags'
import { releaseYearFromGame } from '../lib/gameRelease'
import type { Game, PriceRow } from '../types'
import { fetchSteamPriceOverview } from './steam'

const headers = {
  Accept: 'application/json',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'User-Agent': 'PricePlayWeb/1.0',
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers })
  if (!r.ok) {
    throw new Error(`CheapShark yanit hatasi: ${r.status}`)
  }
  return (await r.json()) as T
}

function parseGame(raw: Record<string, unknown>): Game | null {
  const gameId = String(raw.gameID ?? raw.gameId ?? '').trim() || ''
  const title = String(raw.title ?? raw.external ?? 'Bilinmeyen oyun').trim() || 'Bilinmeyen oyun'
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

function isNearlyFreePrice(g: Game): boolean {
  const p = parseFloat(String(g.cheapest ?? '').replace(',', '.'))
  return Number.isFinite(p) && p >= 0 && p < 0.05
}

function isHundredPercentDeal(g: Game): boolean {
  const sale = parseFloat(String(g.cheapest ?? '999').replace(',', '.'))
  const retail = parseFloat(String(g.normalPrice ?? '0').replace(',', '.'))
  const sav = parseFloat(String(g.savings ?? '0').replace(',', '.'))
  if (!Number.isFinite(sale) || sale > 0.05) return false
  if (!Number.isFinite(retail) || retail < 0.5) return false
  if (!Number.isFinite(sav) || sav < 99) return false
  return true
}

let storeNameCache: Record<string, string> | null = null
let storeNameFetched = 0
const STORE_TTL_MS = 60 * 60 * 1000

export async function fetchStoreNames(): Promise<Record<string, string>> {
  const now = Date.now()
  if (storeNameCache && now - storeNameFetched < STORE_TTL_MS) return storeNameCache

  const list = await fetchJson<unknown[]>(`${CHEAPSHARK_BASE}/stores`)
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

/** CheapShark Deal Rating sıralaması — popüler fırsatlar. */
export async function fetchPopularGames(pageCount = 1): Promise<Game[]> {
  const seen = new Set<string>()
  const out: Game[] = []
  for (let page = 0; page < pageCount; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?sortBy=Deal%20Rating&pageSize=60&pageNumber=${page}`
    const data = await fetchJson<unknown[]>(url)
    uniqueDealsToGames(data, seen, out)
  }
  return out
}

/** İndirimdeki oyunlar — Savings sıralaması. */
export async function fetchDiscountedGames(pageCount = 1): Promise<Game[]> {
  const seen = new Set<string>()
  const out: Game[] = []
  for (let page = 0; page < pageCount; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?onSale=1&sortBy=Savings&pageSize=60&pageNumber=${page}`
    const data = await fetchJson<unknown[]>(url)
    uniqueDealsToGames(data, seen, out)
  }
  return out
}

/** Popüler + indirimli listelerden sınırlı keşif havuzu (tüm oyun kataloğu yok). */
export async function fetchDiscoverDeals(maxGames = 60): Promise<Game[]> {
  const [popular, discounted] = await Promise.all([
    fetchPopularGames(2),
    fetchDiscountedGames(2),
  ])
  const uniq = new Map<string, Game>()
  for (const g of [...popular, ...discounted]) {
    const k = g.gameId || g.title
    if (!k || uniq.has(k)) continue
    uniq.set(k, g)
  }
  return [...uniq.values()].slice(0, maxGames)
}

/** Popüler/indirimli listelerden sürekli ücretsiz (F2P) adayları. */
export async function fetchFreePopularGames(maxGames = 24): Promise<Game[]> {
  const [popular, discounted] = await Promise.all([
    fetchPopularGames(2),
    fetchDiscountedGames(1),
  ])
  const seen = new Set<string>()
  const out: Game[] = []
  for (const g of [...popular, ...discounted]) {
    if (!isNearlyFreePrice(g) || isHundredPercentDeal(g)) continue
    const k = g.gameId || g.title
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(g)
    if (out.length >= maxGames) break
  }
  return out
}

export async function fetchNewReleaseDeals(maxGames = 20, pageCount = 4): Promise<Game[]> {
  const poolSeen = new Set<string>()
  const pool: Game[] = []
  const sortBy = encodeURIComponent('Release')
  for (let page = 0; page < pageCount; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?sortBy=${sortBy}&pageSize=60&pageNumber=${page}`
    const data = await fetchJson<unknown[]>(url)
    for (const raw of data) {
      if (!raw || typeof raw !== 'object') continue
      const g = parseGame(raw as Record<string, unknown>)
      if (!g) continue
      const k = g.gameId || g.title
      if (!k || poolSeen.has(k)) continue
      poolSeen.add(k)
      pool.push(g)
    }
    if (pool.length >= maxGames * 2) break
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
  return [...withDate, ...withoutDate].slice(0, maxGames)
}

export async function fetchHundredPercentFreeDeals(maxGames = 20, maxPages = 5): Promise<Game[]> {
  const seen = new Set<string>()
  const out: Game[] = []
  for (let page = 0; page < maxPages && out.length < maxGames; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?onSale=1&sortBy=Savings&pageSize=60&pageNumber=${page}`
    const data = await fetchJson<unknown[]>(url)
    for (const raw of data) {
      if (!raw || typeof raw !== 'object') continue
      const g = parseGame(raw as Record<string, unknown>)
      if (!g || !isHundredPercentDeal(g)) continue
      const k = g.gameId || g.title
      if (!k || seen.has(k)) continue
      seen.add(k)
      out.push(g)
      if (out.length >= maxGames) break
    }
  }
  return out
}

export async function fetchGamesByCategory(categoryKey: string, maxGames = 60): Promise<Game[]> {
  const pool = await fetchDiscoverDeals(240)
  const out: Game[] = []
  for (const g of pool) {
    if (genreLabelFor(g.title) !== categoryKey) continue
    out.push(g)
    if (out.length >= maxGames) break
  }
  return out
}

export async function searchGames(title: string, limit = 20): Promise<Game[]> {
  const q = encodeURIComponent(title.trim())
  const url = `${CHEAPSHARK_BASE}/games?title=${q}&limit=${limit}`
  const data = await fetchJson<unknown[]>(url)
  const out: Game[] = []
  for (const e of data) {
    if (!e || typeof e !== 'object') continue
    const g = parseGame(e as Record<string, unknown>)
    if (g) out.push(g)
  }
  return out
}

export async function fetchGameJson(gameId: string): Promise<Record<string, unknown>> {
  const url = `${CHEAPSHARK_BASE}/games?id=${encodeURIComponent(gameId)}`
  const r = await fetch(url, { headers })
  if (!r.ok) {
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
  const seenDealRows = new Set<string>()
  for (const raw of deals) {
    if (!raw || typeof raw !== 'object') continue
    const d = raw as Record<string, unknown>
    const sid = String(d.storeID ?? '')
    const dealId = String(d.dealID ?? '')
    const salePrice = String(d.salePrice ?? d.price ?? '0')
    const dedupeKey = `${sid}|${dealId}|${salePrice}`
    if (seenDealRows.has(dedupeKey)) continue
    seenDealRows.add(dedupeKey)
    const name = storeNames[sid] ?? `Mağaza ${sid}`
    const purchaseUrlRaw = d.purchaseUrl ?? d.purchase_url
    let purchaseUrl: string | undefined =
      purchaseUrlRaw != null && String(purchaseUrlRaw).trim() ? String(purchaseUrlRaw).trim() : undefined
    if (purchaseUrl && /cheapshark\.com/i.test(purchaseUrl)) purchaseUrl = undefined
    rows.push({
      storeId: sid,
      storeName: name,
      salePrice,
      retailPrice: String(d.retailPrice ?? '0'),
      savings: String(d.savings ?? '0'),
      dealRating: String(d.dealRating ?? '0'),
      dealId,
      releaseDate: String(d.releaseDate ?? ''),
      isSteamDirect: false,
      purchaseUrl: purchaseUrl ?? null,
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
