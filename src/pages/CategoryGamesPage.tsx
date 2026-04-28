import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageBack } from '../components/PageBack'
import { FavoritesLoginHint } from '../components/FavoritesLoginHint'
import { fetchGamesByCategory } from '../api/cheapshark'
import type { Game } from '../types'
import { GameCard } from '../components/GameCard'
import { fetchBrowseCategories } from '../api/browseApi'
import type { BrowseCategory } from '../lib/browseCategories'
import { FALLBACK_BROWSE_CATEGORIES } from '../lib/browseCategories'

export function CategoryGamesPage() {
  const { key } = useParams<{ key: string }>()
  const categoryKey = decodeURIComponent(key || '')
  const [categories, setCategories] = useState<BrowseCategory[]>(FALLBACK_BROWSE_CATEGORIES)
  const meta = useMemo(
    () => categories.find((c) => c.keyEn === categoryKey),
    [categories, categoryKey],
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
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!meta) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const filtered = await fetchGamesByCategory(categoryKey, 300)
        if (!cancelled) setGames(filtered)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Yükleme hatası')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meta, categoryKey])

  if (!meta) {
    return (
      <p className="muted">
        Kategori bulunamadı. <Link to="/">Ana sayfa</Link>
      </p>
    )
  }

  return (
    <>
      <PageBack />
      <h1 className="section-title">{meta.titleTr}</h1>
      <FavoritesLoginHint />
      <p className="muted" style={{ marginTop: 6 }}>
        Bu kategoriye uygun öne çıkan oyunlar ve tamamlayıcı öneriler.
      </p>
      {loading && <p className="muted">Yükleniyor…</p>}
      {err && <p className="error">{err}</p>}
      {!loading && !err && games.length === 0 && (
        <p className="muted empty-state">Bu kategori için oyun bulunamadı.</p>
      )}
      {!loading && !err && games.length > 0 && (
        <div className="grid grid-games-lg" style={{ marginTop: 20 }} key={tick}>
          {games.map((g) => (
            <GameCard key={g.gameId || g.title} game={g} size="lg" onFavoriteChange={() => setTick((x) => x + 1)} />
          ))}
        </div>
      )}
    </>
  )
}
