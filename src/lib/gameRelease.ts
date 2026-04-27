import type { Game } from '../types'

export function parseGameReleaseDate(g: Game): Date | null {
  const raw = g.releaseDate
  if (raw == null || String(raw).trim() === '') return null
  const n = parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = n < 1e12 ? n * 1000 : n
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

export function releaseYearFromGame(g: Game): number | null {
  const d = parseGameReleaseDate(g)
  return d ? d.getFullYear() : null
}

/** Kartta tek satır çıkış tarihi (tr-TR). */
export function formatGameReleaseDateTr(g: Game): string | null {
  const d = parseGameReleaseDate(g)
  if (!d) return null
  return d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' })
}
