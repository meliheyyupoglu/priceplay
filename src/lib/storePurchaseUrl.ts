import type { PriceRow } from '../types'

export function steamStoreAppUrl(steamAppId: string): string {
  return `https://store.steampowered.com/app/${encodeURIComponent(steamAppId)}/`
}

function isBlockedAffiliateUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const h = u.hostname.toLowerCase()
    return h.includes('cheapshark.com')
  } catch {
    return false
  }
}

function safeDirectPurchaseUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  if (!t || !/^https?:\/\//i.test(t)) return null
  if (isBlockedAffiliateUrl(t)) return null
  return t
}

/** CheapShark `storeID` ile mağaza sitesine (CheapShark değil) yönlendirme — tam ürün URL’si yoksa arama sayfası. */
export function deriveStoreListingUrl(
  row: PriceRow,
  steamAppId: string | null | undefined,
  gameTitle: string,
): string | null {
  const sid = String(row.storeId).trim()
  const steam = steamAppId?.trim() ?? ''
  const title = gameTitle.trim() || 'game'
  const q = encodeURIComponent(title)

  if (row.isSteamDirect && steam) return steamStoreAppUrl(steam)
  if (sid === '1' && steam) return steamStoreAppUrl(steam)

  if (sid === '25') {
    return `https://store.epicgames.com/en-US/browse?q=${q}`
  }
  if (sid === '7') {
    return `https://www.gog.com/en/games?search=${q}`
  }
  if (sid === '11') {
    return `https://www.humblebundle.com/store/search?search=${q}`
  }
  if (sid === '3') {
    return `https://www.greenmangaming.com/en/search?query=${q}`
  }
  if (sid === '15') {
    return `https://www.fanatical.com/en/search?search=${q}`
  }
  if (sid === '23') {
    return `https://www.gamebillet.com/catalogsearch/result/?q=${q}`
  }
  if (sid === '29') {
    return `https://2game.com/en/catalogsearch/result/?q=${q}`
  }
  if (sid === '2') {
    return `https://www.gamersgate.com/en/games?query=${q}`
  }
  if (sid === '27') {
    return `https://www.voidu.com/en/search?q=${q}`
  }
  if (sid === '28') {
    return `https://www.gamesload.com/en/search?q=${q}`
  }

  return null
}

/**
 * Mağaza satırı için tıklanabilir hedef: önce güvenli `purchaseUrl`, yoksa bilinen mağaza + Steam başlığından türetilen link.
 * CheapShark yönlendirme URL'leri asla dönülmez.
 */
export function storePurchaseUrl(
  row: PriceRow,
  steamAppId: string | null | undefined,
  _gameId?: string | null,
  gameTitle?: string | null,
): string | null {
  const direct = safeDirectPurchaseUrl(row.purchaseUrl ?? null)
  if (direct) return direct
  return deriveStoreListingUrl(row, steamAppId, String(gameTitle ?? '').trim() || 'game')
}

export function formatDiscountPercent(savingsRaw: string): string {
  const n = parseFloat(String(savingsRaw))
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}
