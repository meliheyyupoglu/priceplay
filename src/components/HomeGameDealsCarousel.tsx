import { Link } from 'react-router-dom'
import type { Game } from '../types'
import { formatCheapestUsd } from '../lib/gameDisplayPrice'

type Props = { games: Game[] }

const GRID_MAX = 25

function savingsPct(g: Game): number {
  const n = parseFloat(String(g.savings ?? '0'))
  return Number.isFinite(n) ? Math.round(n) : 0
}

export function HomeGameDealsCarousel({ games }: Props) {
  const list = games.slice(0, GRID_MAX)
  if (list.length === 0) return null

  return (
    <section className="home-deals-strip-section" aria-labelledby="home-deals-strip-title">
      <div className="home-deals-strip-top home-deals-strip-top--solo">
        <div>
          <h2 id="home-deals-strip-title" className="home-deals-strip-title">
            <Link to="/browse/free-100" className="home-deals-strip-title-link">
              Oyun fırsatları
            </Link>
            <span className="home-deals-strip-chev" aria-hidden>
              →
            </span>
          </h2>
          <p className="home-deals-strip-sub muted">Ücretsiz ve dikkate değer indirim fırsatları</p>
        </div>
      </div>

      <div className="home-deals-strip-see">
        <Link to="/browse/free-100" className="section-see">
          Tümünü gör →
        </Link>
      </div>

      <div className="home-deals-grid">
        {list.map((g) => {
          const gid = encodeURIComponent(g.gameId || g.title)
          const oldP = formatCheapestUsd(g.normalPrice ?? null)
          const saleNum = parseFloat(String(g.cheapest ?? ''))
          const saleLabel =
            Number.isFinite(saleNum) && saleNum <= 0.02 ? 'Ücretsiz' : (formatCheapestUsd(g.cheapest) ?? '—')
          const pct = savingsPct(g)
          return (
            <Link key={g.gameId || g.title} to={`/game/${gid}`} className="home-deals-strip-card home-deals-grid-card">
              <div className="home-deals-strip-thumb">
                {g.thumb ? <img src={g.thumb} alt="" loading="lazy" /> : <div className="home-deals-strip-ph" />}
              </div>
              <div className="home-deals-strip-meta">
                <div className="home-deals-strip-name">{g.title}</div>
                <div className="home-deals-strip-prices">
                  {oldP && <span className="home-deals-strip-old">{oldP}</span>}
                  <span className="home-deals-strip-sale">{saleLabel}</span>
                </div>
                {pct > 0 && (
                  <div className="home-deals-strip-save">
                    {g.promoSource === 'epic' && pct >= 95
                      ? `Epic Games Store — %${pct}`
                      : `%${pct} tasarruf edin`}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
