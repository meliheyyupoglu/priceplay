import { steamApiBase } from '../config'
import type { SteamPriceOverview } from '../types'

type AppDetailsResponse = Record<
  string,
  {
    success?: boolean
    data?: Record<string, unknown>
  }
>

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
  description: string | null
}

export async function fetchSteamAppDetails(appId: string): Promise<SteamAppDetailsResult | null> {
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

export type SteamFeaturedData = {
  name: string
  headerImage: string | null
  screenshots: string[]
  priceOverview: SteamPriceOverview | null
  genres: string[]
  released: boolean
}

type ScreenshotEntry = { path_thumbnail?: string; path_full?: string }

export async function fetchSteamFeaturedData(appId: string): Promise<SteamFeaturedData | null> {
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

  return {
    name: String(d.name || 'Oyun'),
    headerImage: header,
    screenshots: padded.slice(0, 4),
    priceOverview: (d.price_overview as SteamPriceOverview | undefined) ?? null,
    genres,
    released,
  }
}
