import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageBack } from '../components/PageBack'
import { FavoritesLoginHint } from '../components/FavoritesLoginHint'
import { searchGames } from '../api/cheapshark'
import type { Game } from '../types'
import { GameCard } from '../components/GameCard'

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!q.trim()) {
      setGames([])
      setLoading(false)
      return
    }
    if (q.trim().length < 2) {
      setGames([])
      setErr('En az 2 karakter gir.')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const list = await searchGames(q)
        if (!cancelled) setGames(list)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Arama hatası')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [q])

  if (!q.trim()) {
    return (
      <p className="muted">
        Arama terimi yok. <Link to="/">Ana sayfaya dön</Link>.
      </p>
    )
  }

  return (
    <>
      <PageBack />
      <h1 className="section-title">“{q}” sonuçları</h1>
      <FavoritesLoginHint />
      {loading && <p className="muted">Aranıyor…</p>}
      {err && <p className="error">{err}</p>}
      {!loading && !err && games.length === 0 && (
        <p className="muted empty-state">
          “{q}” için sonuç yok. Farklı bir anahtar kelime dene veya{' '}
          <Link to="/">ana sayfaya dön</Link>.
        </p>
      )}
      {games.length > 0 && (
        <div className="grid" key={tick}>
          {games.map((g) => (
            <GameCard key={g.gameId || g.title} game={g} onFavoriteChange={() => setTick((x) => x + 1)} />
          ))}
        </div>
      )}
    </>
  )
}
