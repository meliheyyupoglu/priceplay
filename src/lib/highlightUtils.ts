import type { Game } from '../types'

function metacriticNum(g: Game): number {
  const n = parseInt(String(g.metacriticScore ?? '0'), 10)
  return Number.isFinite(n) ? n : 0
}

/** Ana sayfa “Popüler”: Deal Rating yerine önce yüksek Metacritic. */
export function popularPreviewByMetacritic(popularPool: Game[], n: number): Game[] {
  const sorted = [...popularPool].sort((a, b) => {
    const d = metacriticNum(b) - metacriticNum(a)
    if (d !== 0) return d
    return a.title.localeCompare(b.title)
  })
  const seen = new Set<string>()
  const out: Game[] = []
  for (const g of sorted) {
    const key = g.gameId || g.title
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(g)
    if (out.length >= n) break
  }
  return out
}

export function sortGamesByMetacriticDesc(games: Game[]): Game[] {
  return [...games].sort((a, b) => {
    const d = metacriticNum(b) - metacriticNum(a)
    if (d !== 0) return d
    return a.title.localeCompare(b.title)
  })
}

/** Mobil `_rotateByDailyOffset` ile aynı mantık. */
export function rotateByDailyOffset<T>(input: T[]): T[] {
  if (input.length === 0) return input
  const now = new Date()
  const jan1 = new Date(now.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000)
  const offset = dayOfYear % input.length
  if (offset === 0) return [...input]
  return [...input.slice(offset), ...input.slice(0, offset)]
}

/** Ana sayfa popüler önizleme: döndürülmüş havuzdan en fazla `n` benzersiz oyun. */
export function popularPreview(popularPool: Game[], n: number): Game[] {
  const ordered = rotateByDailyOffset(popularPool)
  const seen = new Set<string>()
  const out: Game[] = []
  for (const g of ordered) {
    const key = g.gameId || g.title
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(g)
    if (out.length >= n) break
  }
  return out
}

export function uniqueByGameKey(games: Game[]): Game[] {
  const seen = new Set<string>()
  const out: Game[] = []
  for (const g of games) {
    const key = g.gameId || g.title
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(g)
  }
  return out
}
