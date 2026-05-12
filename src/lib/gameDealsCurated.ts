import type { Game } from '../types'

/** Oyun fırsatları listesinden çıkarılan CheapShark `gameID` değerleri. */
export const GAME_DEALS_EXCLUDED_IDS = new Set(['263462', '317776', '298615'])

/**
 * Epic Games Store ücretsiz kampanyası vb. için vitrin + liste başına eklenecek kayıtlar
 * (CheapShark `games` yanıtlarıyla uyumlu).
 */
export const GAME_DEALS_CURATED: Game[] = [
  {
    gameId: '289554',
    title: 'Arranger: A Role-Puzzling Adventure',
    steamAppId: '2596420',
    cheapest: '0.00',
    normalPrice: '19.99',
    savings: '100',
    promoSource: 'epic',
    thumb:
      'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2596420/capsule_231x87.jpg?t=1745972134',
  },
  {
    gameId: '294416',
    title: 'Trash Goblin',
    steamAppId: '2407830',
    cheapest: '0.00',
    normalPrice: '19.99',
    savings: '100',
    promoSource: 'epic',
    thumb:
      'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2407830/b5f73d55cbca5df86e2feb1a92636ce62bb1439e/capsule_231x87.jpg?t=1778170992',
  },
]

export function isExcludedFromGameDeals(game: Game): boolean {
  const id = String(game.gameId || '').trim()
  if (id && GAME_DEALS_EXCLUDED_IDS.has(id)) return true
  return false
}

export function filterExcludedGameDeals(games: Game[]): Game[] {
  return games.filter((g) => !isExcludedFromGameDeals(g))
}

/** Önce kampanya oyunları, sonra diğerleri; tekrar yok, hariç tutulanlar eklenmez. */
export function mergeGameDealsCurated(tail: Game[], max = 25): Game[] {
  const seen = new Set<string>()
  const out: Game[] = []
  for (const g of [...GAME_DEALS_CURATED, ...tail]) {
    if (isExcludedFromGameDeals(g)) continue
    const k = g.gameId || g.title
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(g)
    if (out.length >= max) break
  }
  return out
}
