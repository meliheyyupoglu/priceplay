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

/**
 * Gelistirmede / vite preview: ayni origin proxy (vite.config) uzerinden yonlendirme;
 * tarayici cheapshark.com adresine gitmez, magaza 302 zinciri gorunur.
 * Uretim: `VITE_CHEAPSHARK_PROXY=1` ise ayni path (hostta /cheapshark-redirect reverse proxy gerekir).
 */
export function cheapsharkRedirectHref(dealId: string): string | null {
  const id = dealId?.trim()
  if (!id) return null
  const useProxy =
    import.meta.env.DEV === true ||
    String(import.meta.env.VITE_CHEAPSHARK_PROXY ?? '').trim() === '1'
  if (useProxy) {
    return `/cheapshark-redirect?dealID=${encodeURIComponent(id)}`
  }
  return storeDealResolveUrl(id)
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

  return cheapsharkRedirectHref(row.dealId)
}

export function formatDiscountPercent(savingsRaw: string): string {
  const n = parseFloat(String(savingsRaw))
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}
