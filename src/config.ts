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

/** Geliştirmede Vite proxy (`/steam-store`); prod için `VITE_STEAM_API_BASE` veya doğrudan Steam (CORS riski) */
export function steamApiBase(): string {
  if (import.meta.env.DEV) return '/steam-store/api'
  const fromEnv = import.meta.env.VITE_STEAM_API_BASE as string | undefined
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '')
  return 'https://store.steampowered.com/api'
}
