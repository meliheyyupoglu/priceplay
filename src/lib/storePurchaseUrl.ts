import type { PriceRow } from '../types'

export function steamStoreAppUrl(steamAppId: string): string {
  return `https://store.steampowered.com/app/${encodeURIComponent(steamAppId)}/`
}

const WITCHER_3_GAME_ID = '112330'

/**
 * Mağaza linki: yalnızca Steam (app sayfası) ve The Witcher 3 (sabit purchaseUrl satırları).
 * Diğer mağazalar / CheapShark yönlendirmesi yok — tıklanabilir link üretilmez.
 */
export function storePurchaseUrl(
  row: PriceRow,
  steamAppId: string | null | undefined,
  gameId?: string | null,
): string | null {
  const gid = String(gameId ?? '').trim()

  const direct = row.purchaseUrl?.trim()
  if (direct) {
    if (gid === WITCHER_3_GAME_ID) return direct
    return null
  }

  const steamApp = steamAppId?.trim() ?? ''

  if (row.isSteamDirect) {
    if (steamApp) return steamStoreAppUrl(steamApp)
    return null
  }

  if (row.storeId === '1' && steamApp) {
    return steamStoreAppUrl(steamApp)
  }

  return null
}

export function formatDiscountPercent(savingsRaw: string): string {
  const n = parseFloat(String(savingsRaw))
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}
