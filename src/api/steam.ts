import { steamApiBase } from '../config'
import type { SteamPriceOverview } from '../types'

type AppDetailsResponse = Record<
  string,
  {
    success?: boolean
    data?: Record<string, unknown>
  }
>

type DemoSnapshotSteam = {
  steamAppDetails?: Record<string, Record<string, unknown>>
}

const DEMO_SNAPSHOT_MODE = String(import.meta.env.VITE_DEMO_SNAPSHOT_MODE ?? '1').trim() === '1'
let demoSnapshotCache: DemoSnapshotSteam | null = null

async function getDemoSnapshot(): Promise<DemoSnapshotSteam> {
  if (!DEMO_SNAPSHOT_MODE) return {}
  if (demoSnapshotCache) return demoSnapshotCache
  const r = await fetch('/demo-snapshot.json', {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) return {}
  const data = (await r.json()) as DemoSnapshotSteam
  demoSnapshotCache = data
  return data
}

function htmlToPlain(html: string): string {
  if (!html || typeof html !== 'string') return ''
  return html
    .replace(/<\/(p|div|h\d|ul|ol|li|table|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parsePcRequirements(raw: unknown): { minimum: string | null; recommended: string | null } {
  if (raw === false || raw == null) return { minimum: null, recommended: null }
  if (typeof raw !== 'object') return { minimum: null, recommended: null }
  const o = raw as Record<string, unknown>
  const min = o.minimum
  const rec = o.recommended
  const minStr = typeof min === 'string' && min.trim() ? htmlToPlain(min) : null
  const recStr = typeof rec === 'string' && rec.trim() ? htmlToPlain(rec) : null
  return { minimum: minStr, recommended: recStr }
}

export type SteamAppDetailsResult = {
  name?: string
  shortDescription: string | null
  detailedDescriptionPlain: string | null
  headerImage: string | null
  price: SteamPriceOverview | null
  genres: string[]
  pcMinimumPlain: string | null
  pcRecommendedPlain: string | null
  /** Kısa veya ilk cümle — geriye dönük */
  description: string | null
}

export async function fetchSteamAppDetails(appId: string): Promise<SteamAppDetailsResult | null> {
  if (DEMO_SNAPSHOT_MODE) {
    const snap = await getDemoSnapshot()
    const d = snap.steamAppDetails?.[String(appId)]
    if (!d || typeof d !== 'object') return null
    const shortHtml = d.short_description != null ? String(d.short_description) : ''
    const aboutHtml = d.about_the_game != null ? String(d.about_the_game) : ''
    const shortPlain = shortHtml ? htmlToPlain(shortHtml) : ''
    const detailedPlain = aboutHtml ? htmlToPlain(aboutHtml) : ''

    const genresRaw = Array.isArray(d.genres) ? (d.genres as { description?: string }[]) : []
    const genres = genresRaw.map((g) => String(g.description || '').trim()).filter(Boolean)

    const pc = parsePcRequirements(d.pc_requirements)
    const header = d.header_image != null ? String(d.header_image) : null
    const po = (d.price_overview as SteamPriceOverview | undefined) ?? null
    const description = shortPlain || (detailedPlain ? detailedPlain.slice(0, 500) : '') || null
    return {
      name: d.name != null ? String(d.name) : undefined,
      shortDescription: shortPlain || null,
      detailedDescriptionPlain: detailedPlain || null,
      headerImage: header,
      price: po,
      genres,
      pcMinimumPlain: pc.minimum,
      pcRecommendedPlain: pc.recommended,
      description,
    }
  }

  const base = steamApiBase()
  const url = `${base}/appdetails?appids=${encodeURIComponent(appId)}&l=turkish&cc=tr`
  const r = await fetch(url)
  if (!r.ok) return null
  const data = (await r.json()) as AppDetailsResponse
  const block = data[appId]
  if (!block?.success || !block.data) return null
  const d = block.data

  const shortHtml = d.short_description != null ? String(d.short_description) : ''
  const aboutHtml = d.about_the_game != null ? String(d.about_the_game) : ''
  const shortPlain = shortHtml ? htmlToPlain(shortHtml) : ''
  const detailedPlain = aboutHtml ? htmlToPlain(aboutHtml) : ''

  const genresRaw = Array.isArray(d.genres) ? (d.genres as { description?: string }[]) : []
  const genres = genresRaw.map((g) => String(g.description || '').trim()).filter(Boolean)

  const pc = parsePcRequirements(d.pc_requirements)
  const header = d.header_image != null ? String(d.header_image) : null
  const po = (d.price_overview as SteamPriceOverview | undefined) ?? null

  const description = shortPlain || (detailedPlain ? detailedPlain.slice(0, 500) : '') || null

  return {
    name: d.name != null ? String(d.name) : undefined,
    shortDescription: shortPlain || null,
    detailedDescriptionPlain: detailedPlain || null,
    headerImage: header,
    price: po,
    genres,
    pcMinimumPlain: pc.minimum,
    pcRecommendedPlain: pc.recommended,
    description,
  }
}

export async function fetchSteamPriceOverview(appId: string): Promise<SteamPriceOverview | null> {
  const d = await fetchSteamAppDetails(appId)
  return d?.price ?? null
}

/** Steam vitrin carousel — başlık, kapak, 2x2 küçük görsel, fiyat, türler. */
export type SteamFeaturedData = {
  name: string
  headerImage: string | null
  /** En fazla 4 küçük önizleme URL (thumbnail tercih). */
  screenshots: string[]
  priceOverview: SteamPriceOverview | null
  genres: string[]
  released: boolean
}

type ScreenshotEntry = { path_thumbnail?: string; path_full?: string }

export async function fetchSteamFeaturedData(appId: string): Promise<SteamFeaturedData | null> {
  if (DEMO_SNAPSHOT_MODE) {
    const snap = await getDemoSnapshot()
    const d = snap.steamAppDetails?.[String(appId)]
    if (!d || typeof d !== 'object') return null
    const rawShots = Array.isArray(d.screenshots) ? (d.screenshots as ScreenshotEntry[]) : []
    const shots = rawShots
      .map((s) => String(s.path_thumbnail || s.path_full || '').trim())
      .filter(Boolean)
      .slice(0, 4)
    const header = d.header_image != null ? String(d.header_image) : null
    const padded: string[] = [...shots]
    while (padded.length < 4) {
      if (header) padded.push(header)
      else break
    }
    const genresRaw = Array.isArray(d.genres) ? (d.genres as { description?: string }[]) : []
    const genres = genresRaw.map((g) => String(g.description || '').trim()).filter(Boolean)
    const rel = d.release_date as { coming_soon?: boolean } | undefined
    const released = rel?.coming_soon !== true
    return {
      name: String(d.name || 'Oyun'),
      headerImage: header,
      screenshots: padded.slice(0, 4),
      priceOverview: (d.price_overview as SteamPriceOverview | undefined) ?? null,
      genres,
      released,
    }
  }

  const base = steamApiBase()
  const url = `${base}/appdetails?appids=${encodeURIComponent(appId)}&l=turkish&cc=tr`
  const r = await fetch(url)
  if (!r.ok) return null
  const data = (await r.json()) as Record<
    string,
    { success?: boolean; data?: Record<string, unknown> }
  >
  const block = data[appId]
  if (!block?.success || !block.data) return null
  const d = block.data

  const rawShots = Array.isArray(d.screenshots) ? (d.screenshots as ScreenshotEntry[]) : []
  const shots = rawShots
    .map((s) => String(s.path_thumbnail || s.path_full || '').trim())
    .filter(Boolean)
    .slice(0, 4)

  const header = d.header_image != null ? String(d.header_image) : null
  const padded: string[] = [...shots]
  while (padded.length < 4) {
    if (header) padded.push(header)
    else break
  }

  const genresRaw = Array.isArray(d.genres) ? (d.genres as { description?: string }[]) : []
  const genres = genresRaw.map((g) => String(g.description || '').trim()).filter(Boolean)

  const rel = d.release_date as { coming_soon?: boolean; date?: string } | undefined
  const released = rel?.coming_soon !== true

  const name = String(d.name || 'Oyun')

  return {
    name,
    headerImage: header,
    screenshots: padded.slice(0, 4),
    priceOverview: (d.price_overview as SteamPriceOverview | undefined) ?? null,
    genres,
    released,
  }
}
