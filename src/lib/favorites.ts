import type { Game } from '../types'

const PREFIX = 'priceplay_favorites_v1'
const MAX = 60

export function gameKey(g: Game): string {
  return g.gameId.trim() ? g.gameId : `t:${g.title}`
}

function storageKey(userId: string) {
  return `${PREFIX}:${userId}`
}

export function loadFavorites(userId: string): Game[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const list = JSON.parse(raw) as unknown[]
    if (!Array.isArray(list)) return []
    return list
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map((e) => ({
        gameId: String(e.gameID ?? e.gameId ?? ''),
        title: String(e.title ?? 'Oyun'),
        steamAppId: e.steamAppID != null ? String(e.steamAppID) : e.steamAppId != null ? String(e.steamAppId) : null,
        cheapest: e.cheapest != null ? String(e.cheapest) : null,
        normalPrice: e.normalPrice != null ? String(e.normalPrice) : null,
        savings: e.savings != null ? String(e.savings) : null,
        cheapestDealId: e.cheapestDealID != null ? String(e.cheapestDealID) : null,
        thumb: e.thumb != null ? String(e.thumb) : null,
        metacriticScore: e.metacriticScore != null ? String(e.metacriticScore) : null,
        steamRatingText: e.steamRatingText != null ? String(e.steamRatingText) : null,
      }))
  } catch {
    return []
  }
}

function saveFavorites(userId: string, games: Game[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(games.map(toStoredJson)))
}

function toStoredJson(g: Game) {
  return {
    gameID: g.gameId,
    title: g.title,
    ...(g.steamAppId ? { steamAppID: g.steamAppId } : {}),
    ...(g.cheapest != null ? { cheapest: g.cheapest } : {}),
    ...(g.normalPrice != null ? { normalPrice: g.normalPrice } : {}),
    ...(g.savings != null ? { savings: g.savings } : {}),
    ...(g.cheapestDealId != null ? { cheapestDealID: g.cheapestDealId } : {}),
    ...(g.thumb != null ? { thumb: g.thumb } : {}),
    ...(g.metacriticScore != null ? { metacriticScore: g.metacriticScore } : {}),
    ...(g.steamRatingText != null ? { steamRatingText: g.steamRatingText } : {}),
  }
}

export function isFavorite(userId: string, g: Game): boolean {
  const k = gameKey(g)
  return loadFavorites(userId).some((e) => gameKey(e) === k)
}

export async function toggleFavorite(
  userId: string,
  g: Game,
  hooks: {
    addWatchlist: (game: Game) => Promise<void>
    removeWatchlist: (gameId: string) => Promise<void>
  },
): Promise<boolean> {
  const list = loadFavorites(userId)
  const k = gameKey(g)
  const i = list.findIndex((e) => gameKey(e) === k)
  if (i >= 0) {
    list.splice(i, 1)
    saveFavorites(userId, list)
    if (g.gameId.trim()) {
      try {
        await hooks.removeWatchlist(g.gameId)
      } catch {
        /* sunucu takibi opsiyonel */
      }
    }
    return false
  }
  list.unshift(g)
  while (list.length > MAX) list.pop()
  saveFavorites(userId, list)
  if (g.gameId.trim()) {
    try {
      await hooks.addWatchlist(g)
    } catch {
      /* giriş / sunucu hatası — yerel favori yine de kayıtlı */
    }
  }
  return true
}
