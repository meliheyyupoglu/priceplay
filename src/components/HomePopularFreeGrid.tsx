import { Link } from 'react-router-dom'
import type { Game } from '../types'

type Props = { games: Game[] }

function subtitleLine(g: Game): string {
  const m = parseInt(String(g.metacriticScore ?? ''), 10)
  if (Number.isFinite(m) && m > 0) return `Metacritic ${m}`
  const t = g.steamRatingText?.trim()
  if (t) return t
  return 'Ücretsiz oyun'
}

export function HomePopularFreeGrid({ games }: Props) {
  if (games.length === 0) return null

  return (
    <section className="home-free-popular-section" aria-labelledby="home-free-popular-title">
      <div className="home-free-popular-head">
        <h2 id="home-free-popular-title" className="home-free-popular-title">
          Popüler ücretsiz oyunlar
        </h2>
        <p className="home-free-popular-sub muted">Bu ücretsiz popüler oyun seçeneklerini kaçırmayın</p>
      </div>
      <div className="home-free-popular-grid">
        {games.map((g) => {
          const gid = encodeURIComponent(g.gameId || g.title)
          return (
            <Link key={g.gameId || g.title} to={`/game/${gid}`} className="home-free-popular-card">
              <div className="home-free-popular-art">
                {g.thumb ? <img src={g.thumb} alt="" loading="lazy" /> : <div className="home-free-popular-ph" />}
              </div>
              <div className="home-free-popular-body">
                <div className="home-free-popular-game-title">{g.title}</div>
                <div className="home-free-popular-pub muted">{subtitleLine(g)}</div>
                <div className="home-free-popular-price">Ücretsiz</div>
              </div>
            </Link>
          )
        })}
      </div>
      <div className="home-free-popular-footer">
        <Link to="/browse/free-popular" className="home-free-popular-show-all">
          Tümünü göster
        </Link>
      </div>
    </section>
  )
}
