import { Link } from 'react-router-dom'
import type { Game } from '../types'
import { formatCheapestUsd, parseSavingsPercent } from '../lib/gameDisplayPrice'
import { useAuth } from '../context/AuthContext'
import { isFavorite, toggleFavorite } from '../lib/favorites'
import { addWatchlist, removeWatchlist } from '../api/watchlistApi'
import { useState } from 'react'

type Props = { game: Game; onFavoriteChange?: () => void; size?: 'md' | 'lg' }

export function GameCard({ game, onFavoriteChange, size = 'md' }: Props) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const gid = game.gameId || encodeURIComponent(game.title)
  const fav = user ? isFavorite(user.id, game) : false
  const priceLabel = formatCheapestUsd(game.cheapest)
  const discountPct = parseSavingsPercent(game.savings)

  async function onStar(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!user?.id) return
    setBusy(true)
    try {
      await toggleFavorite(user.id, game, {
        addWatchlist: (g) => addWatchlist(user.id, g, null),
        removeWatchlist: (id) => removeWatchlist(user.id, id),
      })
      onFavoriteChange?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`card game-card-${size}`} style={{ position: 'relative' }}>
      <Link to={`/game/${encodeURIComponent(gid)}`} style={{ color: 'inherit' }}>
        {game.thumb ? (
          <img className="game-thumb" src={game.thumb} alt="" loading="lazy" />
        ) : (
          <div className="game-thumb" />
        )}
        <div className="game-meta">
          <h3 className="game-title">{game.title}</h3>
          {priceLabel && (
            <div className="game-card-price-row">
              {discountPct != null && <span className="game-card-discount">-{discountPct}%</span>}
              <span className="price-tag">{priceLabel}</span>
              <span className="game-card-price-note">En ucuz teklif</span>
            </div>
          )}
        </div>
      </Link>
      {user && (
        <button
          type="button"
          disabled={busy}
          onClick={onStar}
          title={fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'rgba(26,29,36,0.85)',
            color: fav ? '#fbbf24' : 'var(--muted)',
            fontSize: '1.1rem',
          }}
        >
          {fav ? '★' : '☆'}
        </button>
      )}
    </div>
  )
}
