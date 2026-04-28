export const CHEAPSHARK_BASE = 'https://www.cheapshark.com/api/1.0'

/**
 * Steam Store API tabanı.
 * - Dev: Vite `/steam-store` proxy (CORS yok).
 * - Varsayılan: Steam resmi API.
 * - İsteğe bağlı: `VITE_STEAM_API_BASE` ile başka bir taban.
 */
export function steamApiBase(): string {
  if (import.meta.env.DEV) return '/steam-store/api'
  const fromEnv = import.meta.env.VITE_STEAM_API_BASE as string | undefined
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '')
  return 'https://store.steampowered.com/api'
}
