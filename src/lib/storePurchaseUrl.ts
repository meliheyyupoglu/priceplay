import type { PriceRow } from '../types'

export function steamStoreAppUrl(steamAppId: string): string {
  return `https://store.steampowered.com/app/${encodeURIComponent(steamAppId)}/`
}

/** Sunucusuz mod: doğrudan CheapShark redirect adresine gider. */
export function storeDealResolveUrl(dealId: string): string | null {
  const id = dealId?.trim()
  if (!id || !/^\d+$/.test(id)) return null
  return `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(id)}`
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
