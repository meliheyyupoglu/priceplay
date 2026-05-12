export type Game = {
  gameId: string
  title: string
  steamAppId?: string | null
  cheapest?: string | null
  /** Liste fiyatı (CheapShark `normalPrice`) — indirim kartları için */
  normalPrice?: string | null
  savings?: string | null
  cheapestDealId?: string | null
  thumb?: string | null
  /** CheapShark deal `metacriticScore` (0 = yok / gelmemiş) */
  metacriticScore?: string | null
  /** CheapShark `steamRatingText` (örn. Very Positive) */
  steamRatingText?: string | null
  /** CheapShark deal `releaseDate` (çoğunlukla Unix saniye) */
  releaseDate?: string | null
  /** Örn. Epic Games ücretsiz kampanyası — vitrin açıklaması için */
  promoSource?: 'epic' | null
}

export type User = {
  id: string
  firstName: string
  lastName: string
  nickname: string
  email: string
  phone: string
  createdAt?: string | null
}

export type PriceRow = {
  storeId: string
  storeName: string
  salePrice: string
  retailPrice: string
  savings: string
  dealRating: string
  dealId: string
  releaseDate: string
  displaySaleLabel?: string | null
  displayRetailLabel?: string | null
  isSteamDirect: boolean
  /** Varsa tiklamada bu URL kullanilir (demo sabit fiyat / dogrudan magaza). */
  purchaseUrl?: string | null
}

export type SteamPriceOverview = {
  discount_percent: number
  final: number
  initial: number
  final_formatted: string
  initial_formatted: string
}

export type WatchlistItem = {
  id: string
  userId: string
  gameId: string
  gameTitle: string
  targetPrice: number | null
  lastPrice: number | null
  isActive?: boolean
  updatedAt?: string
  createdAt?: string
}
