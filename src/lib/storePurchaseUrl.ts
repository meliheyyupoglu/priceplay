import type { PriceRow } from '../types'

export function steamStoreAppUrl(steamAppId: string): string {
  return `https://store.steampowered.com/app/${encodeURIComponent(steamAppId)}/`
}

/** CheapShark yönlendirmesi (dealID sayı veya kodlu olabilir). */
export function storeDealResolveUrl(dealId: string): string | null {
  const id = dealId?.trim()
  if (!id) return null
  return `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(id)}`
}

export function storePurchaseUrl(row: PriceRow, steamAppId: string | null | undefined): string | null {
  const direct = row.purchaseUrl?.trim()
  if (direct) return direct

  const steamApp = steamAppId?.trim() ?? ''

  if (row.isSteamDirect) {
    if (steamApp) return steamStoreAppUrl(steamApp)
    return null
  }

  // Steam satiri (CheapShark) + bilinen app id: dogrudan Steam oyun sayfasi
  if (row.storeId === '1' && steamApp) {
    return steamStoreAppUrl(steamApp)
  }

  // GOG, Humble, digerleri: CheapShark yonlendirmesi genelde magaza urun sayfasina acar
  return storeDealResolveUrl(row.dealId)
}

export function formatDiscountPercent(savingsRaw: string): string {
  const n = parseFloat(String(savingsRaw))
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}
