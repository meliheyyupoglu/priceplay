import type { Game, PriceRow } from '../types'

const CHEAPSHARK_BASE = 'https://www.cheapshark.com/api/1.0'

const headers = {
  Accept: 'application/json',
  'User-Agent': 'PricePlay/1.0',
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`CheapShark error: ${r.status}`)
  return (await r.json()) as T
}

function parseGame(raw: Record<string, unknown>): Game | null {
  const gameId = String(raw.gameID ?? raw.gameId ?? '').trim()
  const title = String(raw.title ?? raw.external ?? 'Unknown Game').trim() || 'Unknown Game'
  const sid = raw.steamAppID ?? raw.steamAppId
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
      raw.cheapestDealID != null ? String(raw.cheapestDealID) : raw.dealID != null ? String(raw.dealID) : null,
    thumb: raw.thumb != null ? String(raw.thumb) : null,
    metacriticScore:
      raw.metacriticScore != null && String(raw.metacriticScore).trim() !== '' ? String(raw.metacriticScore) : null,
    steamRatingText:
      raw.steamRatingText != null && String(raw.steamRatingText).trim() !== '' ? String(raw.steamRatingText) : null,
    releaseDate:
      raw.releaseDate != null && String(raw.releaseDate).trim() !== '' ? String(raw.releaseDate) : null,
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

function isHundredPercentDeal(g: Game): boolean {
  const sale = parseFloat(String(g.cheapest ?? '999').replace(',', '.'))
  const retail = parseFloat(String(g.normalPrice ?? '0').replace(',', '.'))
  const sav = parseFloat(String(g.savings ?? '0').replace(',', '.'))
  return Number.isFinite(sale) && sale <= 0.05 && Number.isFinite(retail) && retail >= 0.5 && Number.isFinite(sav) && sav >= 99
}

export function createLiveCheapsharkApi() {
  async function fetchStoreNames(): Promise<Record<string, string>> {
    const list = await fetchJson<unknown[]>(`${CHEAPSHARK_BASE}/stores`)
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

  async function fetchPopularGames(pageCount = 1): Promise<Game[]> {
    const seen = new Set<string>()
    const out: Game[] = []
    for (let page = 0; page < pageCount; page++) {
      const url = `${CHEAPSHARK_BASE}/deals?sortBy=Deal%20Rating&pageSize=60&pageNumber=${page}`
      const data = await fetchJson<unknown[]>(url)
      uniqueDealsToGames(data, seen, out)
    }
    return out
  }

  async function fetchDiscountedGames(pageCount = 1): Promise<Game[]> {
    const seen = new Set<string>()
    const out: Game[] = []
    for (let page = 0; page < pageCount; page++) {
      const url = `${CHEAPSHARK_BASE}/deals?onSale=1&sortBy=Savings&pageSize=60&pageNumber=${page}`
      const data = await fetchJson<unknown[]>(url)
      uniqueDealsToGames(data, seen, out)
    }
    return out
  }

  async function fetchHundredPercentFreeDeals(maxGames = 20, maxPages = 5): Promise<Game[]> {
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

  async function searchGames(title: string, limit = 20): Promise<Game[]> {
    const q = encodeURIComponent(title.trim())
    const data = await fetchJson<unknown[]>(`${CHEAPSHARK_BASE}/games?title=${q}&limit=${limit}`)
    const out: Game[] = []
    for (const e of data) {
      if (!e || typeof e !== 'object') continue
      const g = parseGame(e as Record<string, unknown>)
      if (g) out.push(g)
    }
    return out
  }

  async function fetchGameJson(gameId: string): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${CHEAPSHARK_BASE}/games?id=${encodeURIComponent(gameId)}`)
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

    rows.sort((a, b) => (parseFloat(a.salePrice) || 0) - (parseFloat(b.salePrice) || 0))
    return rows
  }

  return {
    fetchStoreNames,
    fetchPopularGames,
    fetchDiscountedGames,
    fetchHundredPercentFreeDeals,
    searchGames,
    fetchGameJson,
    buildPriceRows,
  }
}
