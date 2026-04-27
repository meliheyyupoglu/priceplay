import { fetchGameJson } from './cheapshark'
import type { Game } from '../types'

/** CheapShark `game` + gerekirse `/games?id=` ile Steam app id çözümü. */
export async function resolveSteamAppId(game: Game): Promise<string | null> {
  const direct = game.steamAppId?.trim()
  if (direct && direct !== '0') return direct
  if (!game.gameId?.trim()) return null
  try {
    const payload = await fetchGameJson(game.gameId)
    const info = payload.info as Record<string, unknown> | undefined
    const sid = info?.steamAppID != null ? String(info.steamAppID).trim() : ''
    if (sid && sid !== '0') return sid
  } catch {
    /* CheapShark yok */
  }
  return null
}
