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

/** Sunucusuz mod: kategori listesi doğrudan yerel fallback. */
export async function fetchBrowseCategories(): Promise<BrowseCategory[]> {
  const data: unknown = FALLBACK_BROWSE_CATEGORIES
  if (isValidList(data)) return data
  return FALLBACK_BROWSE_CATEGORIES
}
