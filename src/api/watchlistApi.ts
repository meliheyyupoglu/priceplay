import type { Game, WatchlistItem } from '../types'

const WATCHLIST_KEY = 'pp_local_watchlist_v1'

function readAll(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY)
    const data = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(data) ? (data as WatchlistItem[]) : []
  } catch {
    return []
  }
}

function writeAll(list: WatchlistItem[]) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list))
}

export async function listWatchlist(userId: string): Promise<WatchlistItem[]> {
  return readAll().filter((x) => x.userId === userId && x.isActive !== false)
}

export async function addWatchlist(
  userId: string,
  game: Game,
  targetPrice: number | null,
): Promise<void> {
  const all = readAll()
  const gameId = String(game.gameId || '').trim()
  if (!gameId) throw new Error('Geçersiz oyun kimliği')
  const idx = all.findIndex((x) => x.userId === userId && x.gameId === gameId)
  const now = new Date().toISOString()
  const row: WatchlistItem = {
    id:
      idx >= 0
        ? String(all[idx].id || `${userId}:${gameId}`)
        : `${userId}:${gameId}`,
    userId,
    gameId,
    gameTitle: String(game.title || '').trim(),
    targetPrice,
    lastPrice: idx >= 0 ? all[idx].lastPrice ?? null : null,
    isActive: true,
    createdAt: idx >= 0 ? all[idx].createdAt : now,
    updatedAt: now,
  }
  if (idx >= 0) all[idx] = row
  else all.push(row)
  writeAll(all)
}

export async function removeWatchlist(userId: string, gameId: string): Promise<void> {
  const all = readAll()
  const next = all.filter((x) => !(x.userId === userId && x.gameId === gameId))
  writeAll(next)
}
