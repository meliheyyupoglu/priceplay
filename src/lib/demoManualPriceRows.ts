import type { Game, PriceRow } from '../types'

/** Demo vitrin: The Witcher 3 — sabit fiyatlar ve dogrudan magaza sayfalari. */
const WITCHER_3_GAME_IDS = new Set(['112330'])

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

export function getDemoManualPriceRows(game: Game): PriceRow[] | null {
  const gid = game.gameId?.trim()
  if (!gid || !WITCHER_3_GAME_IDS.has(gid)) return null
  return [...WITCHER_ROWS].sort((a, b) => (parseFloat(a.salePrice) || 0) - (parseFloat(b.salePrice) || 0))
}
