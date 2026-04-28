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

  const r = await fetch(`${CHEAPSHARK_BASE}/stores`, { headers })
  if (!r.ok) throw new Error(`Mağaza listesi: ${r.status}`)
  const list = (await r.json()) as unknown[]
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
  const seen = new Set<string>()
  const out: Game[] = []
  for (let page = 0; page < pageCount; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?sortBy=Deal%20Rating&pageSize=60&pageNumber=${page}`
    const r = await fetch(url, { headers })
    if (!r.ok) throw new Error(`Popüler: ${r.status}`)
    const data = (await r.json()) as unknown[]
    uniqueDealsToGames(data, seen, out)
    if (page < pageCount - 1) await new Promise((res) => setTimeout(res, 120))
  }
  return out
}

export async function fetchDiscountedGames(pageCount = 4): Promise<Game[]> {
  const seen = new Set<string>()
  const out: Game[] = []
  for (let page = 0; page < pageCount; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?onSale=1&sortBy=Savings&pageSize=60&pageNumber=${page}`
    const r = await fetch(url, { headers })
    if (!r.ok) throw new Error(`İndirimli: ${r.status}`)
    const data = (await r.json()) as unknown[]
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
  const poolSeen = new Set<string>()
  const pool: Game[] = []
  const sortBy = encodeURIComponent('Release')
  for (let page = 0; page < pageCount; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?sortBy=${sortBy}&pageSize=60&pageNumber=${page}`
    const r = await fetch(url, { headers })
    if (!r.ok) throw new Error(`Yeni çıkanlar: ${r.status}`)
    const data = (await r.json()) as unknown[]
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
  const seen = new Set<string>()
  const out: Game[] = []
  for (let page = 0; page < maxPages && out.length < maxGames; page++) {
    const url = `${CHEAPSHARK_BASE}/deals?onSale=1&sortBy=Savings&pageSize=60&pageNumber=${page}`
    const r = await fetch(url, { headers })
    if (!r.ok) throw new Error(`Fırsat: ${r.status}`)
    const data = (await r.json()) as unknown[]
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
  const q = encodeURIComponent(title.trim())
  const url = `${CHEAPSHARK_BASE}/games?title=${q}&limit=${limit}`
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`Arama: ${r.status}`)
  const data = (await r.json()) as unknown[]
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
