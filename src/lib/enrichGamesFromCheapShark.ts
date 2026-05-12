import { CHEAPSHARK_BASE } from '../config'
import type { Game } from '../types'

const headers = {
  Accept: 'application/json',
  'User-Agent': 'PricePlayWeb/1.0',
}

export type EnrichGamesResult = { games: Game[]; hitRateLimit: boolean }

/**
 * CheapShark `games?id=` ile seçili oyunların `cheapest` / `normalPrice` / `savings` alanlarını günceller.
 * 429 alınırsa döngü durur; kısmi güncellemeler korunur.
 */
export async function enrichGamesByCheapSharkGameDetail(
  games: Game[],
  gameIds: Iterable<string>,
  delayMs = 220,
): Promise<EnrichGamesResult> {
  const ids = [...new Set([...gameIds].map((x) => String(x).trim()).filter(Boolean))]
  const patches = new Map<string, Partial<Game>>()
  let hitRateLimit = false

  for (const id of ids) {
    try {
      const r = await fetch(`${CHEAPSHARK_BASE}/games?id=${encodeURIComponent(id)}`, { headers })
      if (r.status === 429) {
        hitRateLimit = true
        break
      }
      if (!r.ok) {
        await new Promise((res) => setTimeout(res, delayMs))
        continue
      }
      const j = (await r.json()) as {
        deals?: Array<{ price?: unknown; salePrice?: unknown; retailPrice?: unknown; savings?: unknown }>
      }
      const deals = j.deals ?? []
      let bestPrice = Infinity
      let best: (typeof deals)[0] | undefined
      for (const d of deals) {
        const p = parseFloat(String(d.price ?? d.salePrice ?? '999'))
        if (Number.isFinite(p) && p < bestPrice) {
          bestPrice = p
          best = d
        }
      }
      if (best) {
        patches.set(id, {
          cheapest: String(best.price ?? best.salePrice ?? '0'),
          normalPrice: String(best.retailPrice ?? '0'),
          savings: String(best.savings ?? '0'),
        })
      }
    } catch {
      /* ağ / parse */
    }
    await new Promise((res) => setTimeout(res, delayMs))
  }

  const out = games.map((g) => {
    const id = String(g.gameId || '').trim()
    const p = patches.get(id)
    return p ? { ...g, ...p } : g
  })
  return { games: out, hitRateLimit }
}
