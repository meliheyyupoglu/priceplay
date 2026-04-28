import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageBack } from '../components/PageBack'
import { loadFavorites } from '../lib/favorites'
import { GameCard } from '../components/GameCard'

export function FavoritesPage() {
  const { user, loading } = useAuth()
  const [tick, setTick] = useState(0)

  const games = useMemo(() => {
    if (!user?.id) return []
    return loadFavorites(user.id)
  }, [user?.id, tick])

  if (loading) return <p className="muted">Yükleniyor…</p>
  if (!user) return <Navigate to="/auth" replace />

  return (
    <>
      <PageBack />
      <h1 className="section-title">Favoriler</h1>
      {games.length === 0 ? (
        <p className="muted empty-state" style={{ marginTop: 24 }}>
          Henüz favori yok. <Link to="/browse/popular">Popüler oyunlara göz at</Link> veya kartlardaki yıldıza tıkla.
        </p>
      ) : (
        <div className="grid" style={{ marginTop: 20 }}>
          {games.map((g) => (
            <GameCard key={g.gameId || g.title} game={g} onFavoriteChange={() => setTick((x) => x + 1)} />
          ))}
        </div>
      )}
    </>
  )
}
