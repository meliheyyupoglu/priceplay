import { useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Game } from '../types'
import { formatCheapestUsd } from '../lib/gameDisplayPrice'

type Props = { games: Game[] }

export function HomeNewReleasesCarousel({ games }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)

  if (games.length === 0) return null

  function scrollBy(dir: number) {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.min(420, el.clientWidth * 0.85), behavior: 'smooth' })
  }

  return (
    <section className="home-deals-strip-section" aria-labelledby="home-new-releases-title">
      <div className="home-deals-strip-top home-deals-strip-top--solo">
        <div>
          <h2 id="home-new-releases-title" className="home-deals-strip-title">
            <Link to="/browse/new-releases" className="home-deals-strip-title-link">
              Yeni çıkan oyunlar
            </Link>
            <span className="home-deals-strip-chev" aria-hidden>
              →
            </span>
          </h2>
        </div>
      </div>

      <div className="home-deals-strip-see">
        <Link to="/browse/new-releases" className="section-see">
          Tümünü gör →
        </Link>
      </div>

      <div className="home-new-scroll-row">
        <button
          type="button"
          className="home-new-side-arrow"
          aria-label="Önceki oyunlar"
          onClick={() => scrollBy(-1)}
        >
          ‹
        </button>
        <div
          ref={trackRef}
          className="home-deals-strip-track home-deals-strip-track--arrows-only home-new-scroll-track"
          tabIndex={0}
          role="region"
          aria-label="Yeni çıkan oyunlar"
        >
          {games.map((g) => {
            const gid = encodeURIComponent(g.gameId || g.title)
            const oldP = formatCheapestUsd(g.normalPrice ?? null)
            const saleLabel = formatCheapestUsd(g.cheapest) ?? '—'
            return (
              <Link key={g.gameId || g.title} to={`/game/${gid}`} className="home-deals-strip-card">
                <div className="home-deals-strip-thumb">
                  {g.thumb ? <img src={g.thumb} alt="" loading="lazy" /> : <div className="home-deals-strip-ph" />}
                </div>
                <div className="home-deals-strip-meta">
                  <div className="home-deals-strip-name">{g.title}</div>
                  <div className="home-deals-strip-prices home-deals-strip-prices--tight">
                    {oldP && <span className="home-deals-strip-old">{oldP}</span>}
                    <span className="home-deals-strip-sale">{saleLabel}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
        <button
          type="button"
          className="home-new-side-arrow"
          aria-label="Sonraki oyunlar"
          onClick={() => scrollBy(1)}
        >
          ›
        </button>
      </div>
    </section>
  )
}
