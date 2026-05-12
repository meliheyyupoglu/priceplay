import type { Game, PriceRow } from '../types'

function sortRowsBySale(rows: PriceRow[]): PriceRow[] {
  return [...rows].sort((a, b) => (parseFloat(a.salePrice) || 0) - (parseFloat(b.salePrice) || 0))
}

/** Demo: The Witcher 3 — sabit fiyatlar ve doğrudan mağaza sayfaları. */
const WITCHER_ROWS: PriceRow[] = [
  {
    storeId: '11',
    storeName: 'Humble Store',
    salePrice: '7.99',
    retailPrice: '39.99',
    savings: '80',
    dealRating: '10',
    dealId: '',
    releaseDate: '',
    isSteamDirect: false,
    purchaseUrl: 'https://www.humblebundle.com/store/the-witcher-3-wild-hunt',
  },
  {
    storeId: '1',
    storeName: 'Steam',
    salePrice: '29.99',
    retailPrice: '39.99',
    savings: '25.006251',
    dealRating: '9',
    dealId: '',
    releaseDate: '',
    isSteamDirect: false,
    purchaseUrl: 'https://store.steampowered.com/app/292030/The_Witcher_3_Wild_Hunt/',
  },
  {
    storeId: '7',
    storeName: 'GOG',
    salePrice: '29.99',
    retailPrice: '39.99',
    savings: '25.006251',
    dealRating: '9',
    dealId: '',
    releaseDate: '',
    isSteamDirect: false,
    purchaseUrl: 'https://www.gog.com/game/the_witcher_3_wild_hunt',
  },
]

/** Epic ücretsiz kampanya vitrin oyunları (CheapShark fiyatları + mağaza linkleri). */
const ARRANGER_ROWS: PriceRow[] = [
  {
    storeId: '25',
    storeName: 'Epic Games Store',
    salePrice: '0.00',
    retailPrice: '19.99',
    savings: '100',
    dealRating: '10',
    dealId: '',
    releaseDate: '',
    isSteamDirect: false,
    purchaseUrl:
      'https://store.epicgames.com/en-US/browse?q=Arranger%3A%20A%20Role-Puzzling%20Adventure',
  },
  {
    storeId: '1',
    storeName: 'Steam',
    salePrice: '19.99',
    retailPrice: '19.99',
    savings: '0',
    dealRating: '8',
    dealId: '',
    releaseDate: '',
    isSteamDirect: true,
  },
]

const TRASH_GOBLIN_ROWS: PriceRow[] = [
  {
    storeId: '25',
    storeName: 'Epic Games Store',
    salePrice: '0.00',
    retailPrice: '19.99',
    savings: '100',
    dealRating: '10',
    dealId: '',
    releaseDate: '',
    isSteamDirect: false,
    purchaseUrl: 'https://store.epicgames.com/en-US/browse?q=Trash%20Goblin',
  },
  {
    storeId: '1',
    storeName: 'Steam',
    salePrice: '19.99',
    retailPrice: '19.99',
    savings: '0',
    dealRating: '8',
    dealId: '',
    releaseDate: '',
    isSteamDirect: true,
  },
]

const DEMO_MANUAL_BY_GAME_ID: Record<string, PriceRow[]> = {
  '112330': WITCHER_ROWS,
  '289554': ARRANGER_ROWS,
  '294416': TRASH_GOBLIN_ROWS,
}

export function getDemoManualPriceRows(game: Game): PriceRow[] | null {
  const gid = game.gameId?.trim()
  if (!gid) return null
  const rows = DEMO_MANUAL_BY_GAME_ID[gid]
  if (!rows) return null
  return sortRowsBySale(rows)
}
