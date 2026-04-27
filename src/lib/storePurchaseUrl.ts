import { apiBaseAbsolute } from '../config'
import type { PriceRow } from '../types'

export function steamStoreAppUrl(steamAppId: string): string {
  return `https://store.steampowered.com/app/${encodeURIComponent(steamAppId)}/`
}

/** Sunucu CheapShark yönlendirmesini takip edip 302 ile mağaza sitesine iletir (tarayıcı adresi CheapShark olmaz). */
export function storeDealResolveUrl(dealId: string): string | null {
  const id = dealId?.trim()
  if (!id || !/^\d+$/.test(id)) return null
  return `${apiBaseAbsolute()}/cheapshark/resolve-deal?dealID=${encodeURIComponent(id)}`
}

export function storePurchaseUrl(row: PriceRow, steamAppId: string | null | undefined): string | null {
  if (row.isSteamDirect) {
    const sid = steamAppId?.trim()
    if (sid) return steamStoreAppUrl(sid)
    return null
  }
  return storeDealResolveUrl(row.dealId)
}

export function formatDiscountPercent(savingsRaw: string): string {
  const n = parseFloat(String(savingsRaw))
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}
