import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSteamFeaturedData, type SteamFeaturedData } from '../api/steam'
import { resolveSteamAppId } from '../api/gameResolve'
import type { Game } from '../types'
import { useAuth } from '../context/AuthContext'
import { isFavorite, toggleFavorite } from '../lib/favorites'
import { addWatchlist, removeWatchlist } from '../api/watchlistApi'
import { pickHeroPriceView } from '../lib/gameDisplayPrice'

type Props = {
  games: Game[]
  onFavoriteChange?: () => void
}

type SlideContent = { type: 'rich'; steam: SteamFeaturedData } | { type: 'cheap' }

function gameKey(g: Game) {
  return g.gameId || g.title
}

export function SteamHeroCarousel({ games, onFavoriteChange }: Props) {
  const [index, setIndex] = useState(0)
  const [, setRender] = useState(0)
  const bump = useCallback(() => setRender((x) => x + 1), [])
  const cacheRef = useRef<Record<string, SlideContent>>({})
  const inflightRef = useRef(new Set<string>())

  const n = games.length

  useEffect(() => {
    setIndex((i) => (n === 0 ? 0 : Math.min(i, n - 1)))
  }, [n])

  const loadGame = useCallback(
    async (g: Game) => {
      const key = gameKey(g)
      if (cacheRef.current[key] || inflightRef.current.has(key)) return
      inflightRef.current.add(key)
      try {
        const sid = await resolveSteamAppId(g)
        if (sid) {
          const steam = await fetchSteamFeaturedData(sid)
          if (steam) cacheRef.current[key] = { type: 'rich', steam }
          else cacheRef.current[key] = { type: 'cheap' }
        } else {
          cacheRef.current[key] = { type: 'cheap' }
        }
      } catch {
        cacheRef.current[key] = { type: 'cheap' }
      } finally {
        inflightRef.current.delete(key)
        bump()
      }
    },
    [bump],
  )

  useEffect(() => {
    if (!n) return
    let cancelled = false
    ;(async () => {
      for (const g of games) {
        if (cancelled) return
        await loadGame(g)
        await new Promise((r) => setTimeout(r, 100))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [games, n, loadGame])

  if (n === 0) return null

  return (
    <div className="steam-hero-root">
      <button
        type="button"
        className="steam-hero-arrow steam-hero-arrow-prev"
        aria-label="Önceki"
        disabled={index <= 0}
        onClick={() => setIndex((i) => Math.max(0, i - 1))}
      >
        <ChevronLeftLarge />
      </button>
      <button
        type="button"
        className="steam-hero-arrow steam-hero-arrow-next"
        aria-label="Sonraki"
        disabled={index >= n - 1}
        onClick={() => setIndex((i) => Math.min(n - 1, i + 1))}
      >
        <ChevronRightLarge />
      </button>

      <div
        className="steam-hero-viewport"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Öne çıkan oyunlar"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            setIndex((i) => Math.max(0, i - 1))
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            setIndex((i) => Math.min(n - 1, i + 1))
          }
        }}
      >
        <div
          className="steam-hero-track"
          style={{
            width: `${n * 100}%`,
            transform: `translateX(calc(-${index} * 100% / ${n}))`,
          }}
        >
          {games.map((g) => {
            const k = gameKey(g)
            return (
              <div key={k} className="steam-hero-slide" style={{ width: `${100 / n}%` }}>
                <SteamHeroSlide game={g} content={cacheRef.current[k]} onFavoriteChange={onFavoriteChange} />
              </div>
            )
          })}
        </div>

        <div className="steam-hero-dots" role="tablist" aria-label="Slayt">
          {games.map((g, i) => (
            <button
              key={gameKey(g)}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`steam-hero-dot ${i === index ? 'active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}. slayt`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SteamHeroSlide({
  game,
  content,
  onFavoriteChange,
}: {
  game: Game
  content: SlideContent | undefined
  onFavoriteChange?: () => void
}) {
  const { user } = useAuth()
  const [favBusy, setFavBusy] = useState(false)
  const gid = encodeURIComponent(game.gameId || game.title)
  const fav = user ? isFavorite(user.id, game) : false

  const onStar = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user?.id) return
    setFavBusy(true)
    try {
      await toggleFavorite(user.id, game, {
        addWatchlist: (g) => addWatchlist(user.id, g, null),
        removeWatchlist: (id) => removeWatchlist(user.id, id),
      })
      onFavoriteChange?.()
    } finally {
      setFavBusy(false)
    }
  }

  if (!content) {
    return <SteamHeroSkeleton game={game} />
  }

  const steam = content.type === 'rich' ? content.steam : null

  const heroImg = steam?.headerImage || game.thumb || ''
  const title = steam?.name || game.title

  let thumbs: string[] = []
  if (steam?.screenshots?.length) {
    thumbs = [...steam.screenshots]
  }
  while (thumbs.length < 4) {
    if (heroImg) thumbs.push(heroImg)
    else thumbs.push('')
  }
  thumbs = thumbs.slice(0, 4)

  const po = steam?.priceOverview ?? null
  const view = pickHeroPriceView(game, po)
  const savingsNum = game.savings != null ? parseFloat(String(game.savings)) : NaN
  const hasDealSavings = Number.isFinite(savingsNum) && savingsNum > 0
  const showFirsat =
    (view.source === 'cheapshark' && view.discountPct != null) ||
    (view.source === 'steam' && (view.discountPct ?? 0) > 0) ||
    (view.source === 'none' && hasDealSavings)

  return (
    <div className="steam-hero-panel">
      <Link to={`/game/${gid}`} className="steam-hero-left">
        {heroImg ? <img src={heroImg} alt="" className="steam-hero-main-img" /> : <div className="steam-hero-main-img steam-hero-ph" />}
        <div className="steam-hero-left-shade" />
      </Link>

      <div className="steam-hero-right">
        <Link to={`/game/${gid}`} className="steam-hero-title-link">
          <h2 className="steam-hero-title">{title}</h2>
        </Link>

        <div className="steam-hero-thumb-grid">
          {thumbs.map((src, i) => (
            <Link key={i} to={`/game/${gid}`} className="steam-hero-mini-wrap">
              {src ? <img src={src} alt="" className="steam-hero-mini" /> : <div className="steam-hero-mini steam-hero-ph" />}
            </Link>
          ))}
        </div>

        <div className="steam-hero-meta-row">
          <span className="steam-hero-released">{steam ? (steam.released ? 'Yayınlandı' : 'Yakında') : 'CheapShark'}</span>
          {showFirsat && <span className="steam-hero-pill">Fırsat</span>}
          {steam?.genres?.[0] && <span className="steam-hero-pill muted-pill">{steam.genres[0]}</span>}
        </div>

        <div className="steam-hero-price-block">
          {view.source === 'cheapshark' && (
            <>
              {view.discountPct != null && <span className="steam-hero-disc-badge">-{view.discountPct}%</span>}
              <span className="steam-hero-price-new">{view.priceLabel}</span>
              <span className="steam-hero-price-note">{view.note}</span>
            </>
          )}
          {view.source === 'steam' && (
            <>
              {view.discountPct != null && view.discountPct > 0 && (
                <>
                  <span className="steam-hero-disc-badge">-{view.discountPct}%</span>
                  {view.oldFormatted && <span className="steam-hero-price-old">{view.oldFormatted}</span>}
                </>
              )}
              <span className="steam-hero-price-new">{view.priceLabel}</span>
              <span className="steam-hero-price-note">{view.note}</span>
            </>
          )}
          {view.source === 'none' && <span className="steam-hero-price-note">Fiyat için detay</span>}
        </div>

        <div className="steam-hero-footer-row">
          <Link to={`/game/${gid}`} className="steam-hero-cta pp-hero-cta">
            Mağaza fiyatları
          </Link>
          {user && (
            <button type="button" className="steam-hero-fav" disabled={favBusy} onClick={onStar} title="Favori">
              {fav ? '★' : '☆'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SteamHeroSkeleton({ game }: { game: Game }) {
  return (
    <div className="steam-hero-panel steam-hero-panel--loading">
      <div className="steam-hero-left">
        <div className="steam-hero-main-img steam-hero-shimmer" />
      </div>
      <div className="steam-hero-right">
        <div className="steam-hero-shimmer steam-hero-sk-title" />
        <div className="steam-hero-thumb-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="steam-hero-mini steam-hero-shimmer" />
          ))}
        </div>
        <p className="muted" style={{ margin: '12px 0 0', fontSize: '0.85rem' }}>
          {game.title} — görseller yükleniyor…
        </p>
      </div>
    </div>
  )
}

function ChevronLeftLarge() {
  return (
    <svg width="28" height="48" viewBox="0 0 24 48" fill="none" aria-hidden>
      <path d="M16 8L8 24l8 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRightLarge() {
  return (
    <svg width="28" height="48" viewBox="0 0 24 48" fill="none" aria-hidden>
      <path d="M8 8l8 16-8 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
