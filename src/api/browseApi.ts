import { API_BASE } from '../config'
import type { BrowseCategory } from '../lib/browseCategories'
import { FALLBACK_BROWSE_CATEGORIES } from '../lib/browseCategories'

function isValidList(data: unknown): data is BrowseCategory[] {
  if (!Array.isArray(data) || data.length === 0) return false
  return data.every((e) => {
    if (!e || typeof e !== 'object') return false
    const o = e as Record<string, unknown>
    if (typeof o.keyEn !== 'string' || typeof o.titleTr !== 'string' || typeof o.gradient !== 'string') return false
    if (o.steamHeaderIds != null) {
      if (!Array.isArray(o.steamHeaderIds)) return false
      if (!o.steamHeaderIds.every((id) => typeof id === 'number' && Number.isFinite(id))) return false
    }
    return true
  })
}

/** Sunucu `GET /api/browse/categories`; hata veya bos listede yerel fallback. */
export async function fetchBrowseCategories(): Promise<BrowseCategory[]> {
  try {
    const r = await fetch(`${API_BASE}/browse/categories`, {
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) return FALLBACK_BROWSE_CATEGORIES
    const data: unknown = await r.json()
    if (isValidList(data)) return data
  } catch {
    /* ag yok / CORS */
  }
  return FALLBACK_BROWSE_CATEGORIES
}
