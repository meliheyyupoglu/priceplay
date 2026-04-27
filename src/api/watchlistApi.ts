import { API_BASE } from '../config'
import type { Game, WatchlistItem } from '../types'

export async function listWatchlist(userId: string): Promise<WatchlistItem[]> {
  const r = await fetch(`${API_BASE}/watchlist`, {
    headers: { Accept: 'application/json', 'x-user-id': userId },
  })
  if (!r.ok) throw new Error('Takip listesi alınamadı')
  const raw = await r.json()
  return Array.isArray(raw) ? (raw as WatchlistItem[]) : []
}

export async function addWatchlist(
  userId: string,
  game: Game,
  targetPrice: number | null,
): Promise<void> {
  const r = await fetch(`${API_BASE}/watchlist`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({
      gameId: game.gameId,
      gameTitle: game.title,
      ...(targetPrice != null ? { targetPrice } : {}),
    }),
  })
  if (r.status !== 201) {
    const j = (await r.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? 'Takibe eklenemedi')
  }
}

export async function removeWatchlist(userId: string, gameId: string): Promise<void> {
  const r = await fetch(`${API_BASE}/watchlist/${encodeURIComponent(gameId)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', 'x-user-id': userId },
  })
  if (!r.ok) throw new Error('Takipten kaldırılamadı')
}
