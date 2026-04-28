import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  fetchDiscountedGames,
  fetchHundredPercentFreeDeals,
  fetchNewReleaseDeals,
  fetchPopularGames,
  searchGames,
} from '../api/cheapshark'
import type { Game } from '../types'
import { SteamHeroCarousel } from '../components/SteamHeroCarousel'
import { SteamBrowseCategories } from '../components/SteamBrowseCategories'
import { fetchBrowseCategories } from '../api/browseApi'
import type { BrowseCategory } from '../lib/browseCategories'
import { FALLBACK_BROWSE_CATEGORIES } from '../lib/browseCategories'
import { popularPreviewByMetacritic, uniqueByGameKey } from '../lib/highlightUtils'
import { genreLabelFor } from '../lib/genreTags'
import { IconSearch } from '../components/NavIcons'
import { HomePopularFreeGrid } from '../components/HomePopularFreeGrid'
import { HomeGameDealsCarousel } from '../components/HomeGameDealsCarousel'
import { HomeNewReleasesCarousel } from '../components/HomeNewReleasesCarousel'

const HOME_PREVIEW = 10
const FETCH_PAGES = 4
const HOME_FREE_GRID = 10
const HOME_100_CAROUSEL = 25
const HOME_NEW_RELEASES = 20

function buildThumbsByCategory(categories: BrowseCategory[], games: Game[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const c of categories) out[c.keyEn] = []
  for (const g of games) {
    const t = g.thumb?.trim()
    if (!t) continue
    const label = genreLabelFor(g.title)
    if (out[label] && out[label].length < 5) out[label].push(t)
  }
  return out
}

function isNearFree(game: Game): boolean {
  const p = Number.parseFloat(String(game.cheapest ?? '').replace(',', '.'))
  return Number.isFinite(p) && p >= 0 && p <= 0.05
}

export function HomePage() {
  const nav = useNavigate()
  const location = useLocation()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [popular, setPopular] = useState<Game[]>([])
  const [discounted, setDiscounted] = useState<Game[]>([])
  const [freePopular, setFreePopular] = useState<Game[]>([])
  const [hundredOff, setHundredOff] = useState<Game[]>([])
  const [newReleases, setNewReleases] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [suggest, setSuggest] = useState<Game[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [favTick, setFavTick] = useState(0)
  const [categories, setCategories] = useState<BrowseCategory[]>(FALLBACK_BROWSE_CATEGORIES)
  const [thumbPool, setThumbPool] = useState<Game[]>([])

  const thumbsByCategory = useMemo(
    () => buildThumbsByCategory(categories, thumbPool),
    [categories, thumbPool],
  )

  useEffect(() => {
    let cancelled = false
    fetchBrowseCategories().then((list) => {
      if (!cancelled) setCategories(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const st = location.state as { focusSearch?: boolean } | null
    if (st?.focusSearch) {
      const id = window.requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
      nav('/', { replace: true, state: {} })
      return () => window.cancelAnimationFrame(id)
    }
    return undefined
  }, [location.state, nav])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        // F2P tohum + Metacritic enrich çok uzun sürer; ilk boyayı bloklamasın (Vercel/Render’da “takılı” hissi).
        const [pRaw, dRaw, hoRaw] = await Promise.all([
          fetchPopularGames(FETCH_PAGES),
          fetchDiscountedGames(FETCH_PAGES),
          fetchHundredPercentFreeDeals(24, 12).catch(() => [] as Game[]),
        ])
        if (cancelled) return
        const pUnique = uniqueByGameKey(pRaw)
        const dUnique = uniqueByGameKey(dRaw)
        const hoUnique = uniqueByGameKey(hoRaw).slice(0, HOME_100_CAROUSEL)
        const hoKeys = new Set(hoUnique.map((g) => g.gameId || g.title))
        const dWithoutDeals = dUnique.filter((g) => !hoKeys.has(g.gameId || g.title))
        setThumbPool(pUnique)
        setPopular(popularPreviewByMetacritic(pUnique, HOME_PREVIEW))
        setDiscounted(dWithoutDeals.slice(0, HOME_PREVIEW))
        setHundredOff(hoUnique)
        const freeFromPopular = pUnique.filter((g) => isNearFree(g) && !hoKeys.has(g.gameId || g.title))
        setFreePopular(freeFromPopular.slice(0, HOME_FREE_GRID))
        if (!cancelled) setLoading(false)

        try {
          await new Promise((r) => setTimeout(r, 200))
          if (cancelled) return
          const nrRaw = await fetchNewReleaseDeals(HOME_NEW_RELEASES, 16)
          if (cancelled) return
          setNewReleases(uniqueByGameKey(nrRaw).slice(0, HOME_NEW_RELEASES))
        } catch {
          if (!cancelled) setNewReleases([])
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Yükleme hatası')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const runSuggest = useCallback(async (text: string) => {
    const t = text.trim()
    if (t.length < 2) {
      setSuggest([])
      return
    }
    setSuggestLoading(true)
    try {
      const list = await searchGames(t)
      setSuggest(list.slice(0, 6))
    } catch {
      setSuggest([])
    } finally {
      setSuggestLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => runSuggest(q), 450)
    return () => clearTimeout(t)
  }, [q, runSuggest])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const t = q.trim()
    if (t.length < 2) return
    nav(`/search?q=${encodeURIComponent(t)}`)
    setSuggest([])
  }

  return (
    <>
      <div className="store-search-bar">
        <form onSubmit={submitSearch} className="store-search-form" role="search">
          <span className="store-search-lead" aria-hidden>
            <IconSearch />
          </span>
          <input
            ref={searchInputRef}
            className="store-search-input"
            placeholder="Oyun ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Mağazada ara"
            autoComplete="off"
          />
        </form>
        {(suggest.length > 0 || suggestLoading) && q.trim().length >= 2 && (
          <div className="suggest-list store-search-suggest" role="listbox">
            {suggestLoading && <div className="suggest-item muted">Yükleniyor…</div>}
            {suggest.map((g) => (
              <Link
                key={g.gameId || g.title}
                className="suggest-item"
                to={`/game/${encodeURIComponent(g.gameId || g.title)}`}
                onClick={() => setSuggest([])}
              >
                {g.thumb && (
                  <img src={g.thumb} alt="" width={64} height={30} style={{ objectFit: 'cover', borderRadius: 4 }} />
                )}
                <span>{g.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <SteamBrowseCategories categories={categories} thumbsByCategory={thumbsByCategory} />

      {err && <p className="error">{err}</p>}
      {loading && (
        <div className="home-skeleton-wrap" aria-busy>
          <p className="muted page-loading-hint">Listeler yükleniyor…</p>
          <div className="home-skeleton-hero steam-hero-shimmer" />
          <div className="home-skeleton-hero steam-hero-shimmer" style={{ marginTop: 20 }} />
        </div>
      )}

      {!loading && (
        <>
          <div className="section-head home-after-browse">
            <Link to="/browse/popular" className="section-title-link">
              Popüler
            </Link>
            <Link to="/browse/popular" className="section-see">
              Tümünü gör →
            </Link>
          </div>
          <SteamHeroCarousel games={popular} onFavoriteChange={() => setFavTick((x) => x + 1)} />

          <div className="section-head" style={{ marginTop: 8 }}>
            <Link to="/browse/discounted" className="section-title-link">
              İndirim
            </Link>
            <Link to="/browse/discounted" className="section-see">
              Tümünü gör →
            </Link>
          </div>
          <SteamHeroCarousel key={favTick} games={discounted} onFavoriteChange={() => setFavTick((x) => x + 1)} />

          <HomePopularFreeGrid games={freePopular} />

          <HomeGameDealsCarousel games={hundredOff} />

          <HomeNewReleasesCarousel games={newReleases} />
        </>
      )}
    </>
  )
}
