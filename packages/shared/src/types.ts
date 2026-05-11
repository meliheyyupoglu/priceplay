export type Game = {
  gameId: string
  title: string
  steamAppId?: string | null
  cheapest?: string | null
  normalPrice?: string | null
  savings?: string | null
  cheapestDealId?: string | null
  thumb?: string | null
  metacriticScore?: string | null
  steamRatingText?: string | null
  releaseDate?: string | null
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
}

export type DemoSnapshot = {
  generatedAt: string
  stores?: unknown[]
  popular?: unknown[]
  discounted?: unknown[]
  newReleases?: unknown[]
  free100?: unknown[]
  searches?: Record<string, unknown[]>
  gameDetails?: Record<string, Record<string, unknown>>
  steamAppDetails?: Record<string, Record<string, unknown>>
  curatedPopular?: unknown[]
}
