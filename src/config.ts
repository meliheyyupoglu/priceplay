/** Backend `express` API kökü — mobildeki `PROXY_BASE_URL` ile aynı mantık */
export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3000/api'

/** Tarayıcıda mutlak API kökü (`<a href>` için). */
export function apiBaseAbsolute(): string {
  const b = API_BASE.replace(/\/$/, '')
  if (/^https?:\/\//i.test(b)) return b
  if (typeof window !== 'undefined') {
    const path = b.startsWith('/') ? b : `/${b}`
    return `${window.location.origin}${path}`
  }
  return b
}

export const CHEAPSHARK_BASE = `${API_BASE}/cheapshark`

/**
 * Steam Store API tabanı.
 * - Dev: Vite `/steam-store` proxy (CORS yok).
 * - Prod: `VITE_API_BASE_URL` varsa Steam çağrıları Render’daki `/api/steam/...` üzerinden (ortak havuz + CORS).
 * - İsteğe bağlı: `VITE_STEAM_API_BASE` ile başka bir taban.
 */
export function steamApiBase(): string {
  if (import.meta.env.DEV) return '/steam-store/api'
  const fromEnv = import.meta.env.VITE_STEAM_API_BASE as string | undefined
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '')
  const api = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  if (api?.trim()) return `${api}/steam`
  return 'https://store.steampowered.com/api'
}
