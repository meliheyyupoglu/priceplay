import type { DemoSnapshot, Game, PriceRow } from '../types'

function parseGame(raw: Record<string, unknown>): Game | null {
  const gameId = String(raw.gameID ?? raw.gameId ?? '').trim()
  const title = String(raw.title ?? raw.external ?? 'Unknown Game').trim() || 'Unknown Game'
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
    cheapestDealId: raw.cheapestDealID != null ? String(raw.cheapestDealID) : raw.dealID != null ? String(raw.dealID) : null,
    thumb: raw.thumb != null ? String(raw.thumb) : null,
    metacriticScore:
      raw.metacriticScore != null && String(raw.metacriticScore).trim() !== '' ? String(raw.metacriticScore) : null,
    steamRatingText:
      raw.steamRatingText != null && String(raw.steamRatingText).trim() !== '' ? String(raw.steamRatingText) : null,
    releaseDate: raw.releaseDate != null && String(raw.releaseDate).trim() !== '' ? String(raw.releaseDate) : null,
  }
}

function parseGamesFromUnknownArray(list: unknown[] | undefined): Game[] {
  if (!Array.isArray(list)) return []
  const out: Game[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const g = parseGame(raw as Record<string, unknown>)
    if (!g) continue
    const key = g.gameId || g.title
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(g)
  }
  return out
}

function metacriticNum(g: Game): number {
  const n = parseInt(String(g.metacriticScore ?? '0'), 10)
  return Number.isFinite(n) ? n : 0
}

function rotateByDailyOffset<T>(items: T[]): T[] {
  if (items.length === 0) return items
  const now = new Date()
  const jan1 = new Date(now.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000)
  const offset = dayOfYear % items.length
  if (offset === 0) return [...items]
  return [...items.slice(offset), ...items.slice(0, offset)]
}

function releaseTs(game: Game): number {
  const n = parseInt(String(game.releaseDate ?? '0'), 10)
  return Number.isFinite(n) ? n : 0
}

function buildFallbackGamePayloadFromSnapshot(gameId: string, snap: DemoSnapshot): Record<string, unknown> | null {
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
    info: { title, thumb, steamAppID: steamAppID ?? null },
    deals: matchedDeals,
  }
}

export function createLocalCheapsharkApi(snapshot: DemoSnapshot) {
  async function fetchStoreNames(): Promise<Record<string, string>> {
    const list = snapshot.stores ?? []
    const map: Record<string, string> = {}
    for (const e of list) {
      if (!e || typeof e !== 'object') continue
      const o = e as Record<string, unknown>
      const id = String(o.storeID ?? '')
      if (!id) continue
      map[id] = String(o.storeName ?? `Store ${id}`)
    }
    return map
  }

  async function fetchPopularGames(pageCount = 4): Promise<Game[]> {
    const curated = parseGamesFromUnknownArray(snapshot.curatedPopular)
    if (curated.length > 0) return curated.slice(0, Math.max(1, pageCount) * 60)
    const list = parseGamesFromUnknownArray(snapshot.popular)
    return list.slice(0, Math.max(1, pageCount) * 60)
  }

  async function fetchDiscountedGames(pageCount = 4): Promise<Game[]> {
    const list = parseGamesFromUnknownArray(snapshot.discounted)
    return list.slice(0, Math.max(1, pageCount) * 60)
  }

  async function fetchNewReleaseDeals(maxGames = 20, pageCount = 16): Promise<Game[]> {
    const list = parseGamesFromUnknownArray(snapshot.newReleases)
    const cap = Math.max(maxGames, pageCount * 60)
    const sorted = [...list].sort((a, b) => releaseTs(b) - releaseTs(a))
    return sorted.slice(0, cap)
  }

  async function fetchHundredPercentFreeDeals(maxGames = 20, maxPages = 10): Promise<Game[]> {
    const list = parseGamesFromUnknownArray(snapshot.free100)
    const cap = Math.max(maxGames, maxPages * 60)
    return list.slice(0, cap)
  }

  async function fetchAllKnownGames(maxGames = 2000): Promise<Game[]> {
    const merged = [
      ...parseGamesFromUnknownArray(snapshot.curatedPopular),
      ...parseGamesFromUnknownArray(snapshot.popular),
      ...parseGamesFromUnknownArray(snapshot.discounted),
      ...parseGamesFromUnknownArray(snapshot.newReleases),
      ...parseGamesFromUnknownArray(snapshot.free100),
    ]
    const uniq = new Map<string, Game>()
    for (const g of merged) {
      const key = g.gameId || g.title
      if (!key || uniq.has(key)) continue
      uniq.set(key, g)
    }
    return [...uniq.values()].slice(0, maxGames)
  }

  async function fetchCuratedFreeToPlayByMetacritic(maxGames = 24): Promise<Game[]> {
    const pool = parseGamesFromUnknownArray(snapshot.free100).filter((g) => {
      const p = parseFloat(String(g.cheapest ?? '').replace(',', '.'))
      return Number.isFinite(p) && p <= 0.02
    })
    const sorted = [...pool].sort((a, b) => {
      const d = metacriticNum(b) - metacriticNum(a)
      if (d !== 0) return d
      return a.title.localeCompare(b.title)
    })
    return sorted.slice(0, maxGames)
  }

  async function searchGames(title: string, limit = 20): Promise<Game[]> {
    const q = title.trim().toLowerCase()
    const exact = parseGamesFromUnknownArray(snapshot.searches?.[q])
    if (exact.length > 0) return exact.slice(0, limit)

    const pool = await fetchAllKnownGames(5000)
    const byTitle = pool.filter((g) => g.title.toLowerCase().includes(q))
    return rotateByDailyOffset(byTitle).slice(0, limit)
  }

  async function fetchGameJson(gameId: string): Promise<Record<string, unknown>> {
    const hit = snapshot.gameDetails?.[String(gameId)]
    if (hit && typeof hit === 'object') return hit
    const fallback = buildFallbackGamePayloadFromSnapshot(String(gameId), snapshot)
    if (fallback) return fallback
    return { info: { title: String(gameId || 'Unknown Game'), steamAppID: null, thumb: null }, deals: [] }
  }

  async function buildPriceRows(game: Game, gamePayload: Record<string, unknown>): Promise<PriceRow[]> {
    const storeNames = await fetchStoreNames()
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
      rows.push({
        storeId: sid,
        storeName: storeNames[sid] ?? `Store ${sid}`,
        salePrice,
        retailPrice: String(d.retailPrice ?? '0'),
        savings: String(d.savings ?? '0'),
        dealRating: String(d.dealRating ?? '0'),
        dealId,
        releaseDate: String(d.releaseDate ?? game.releaseDate ?? ''),
        isSteamDirect: false,
      })
    }

    rows.sort((a, b) => {
      const pa = parseFloat(a.salePrice) || 0
      const pb = parseFloat(b.salePrice) || 0
      return pa - pb
    })
    return rows
  }

  return {
    fetchStoreNames,
    fetchPopularGames,
    fetchDiscountedGames,
    fetchNewReleaseDeals,
    fetchHundredPercentFreeDeals,
    fetchAllKnownGames,
    fetchCuratedFreeToPlayByMetacritic,
    searchGames,
    fetchGameJson,
    buildPriceRows,
  }
}
