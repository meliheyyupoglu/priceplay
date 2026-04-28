import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageBack } from '../components/PageBack'
import { FavoritesLoginHint } from '../components/FavoritesLoginHint'
import {
  fetchAllKnownGames,
  fetchCuratedFreeToPlayByMetacritic,
  fetchDiscountedGames,
  fetchHundredPercentFreeDeals,
  fetchNewReleaseDeals,
  fetchPopularGames,
} from '../api/cheapshark'
import type { Game } from '../types'
import { GameCard } from '../components/GameCard'
import { rotateByDailyOffset, sortGamesByMetacriticDesc, uniqueByGameKey } from '../lib/highlightUtils'

type Kind = 'popular' | 'discounted' | 'free-popular' | 'free-100' | 'new-releases' | 'discover-all'

function normalizeKind(raw: string | undefined): Kind {
  if (raw === 'discounted') return 'discounted'
  if (raw === 'free-popular') return 'free-popular'
  if (raw === 'free-100') return 'free-100'
  if (raw === 'new-releases') return 'new-releases'
  if (raw === 'discover-all') return 'discover-all'
  return 'popular'
}

export function BrowseListPage() {
  const { kind } = useParams<{ kind: string }>()
  const k = normalizeKind(kind)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const title =
    k === 'popular'
      ? 'Popüler'
      : k === 'discounted'
        ? 'İndirimli oyunlar'
        : k === 'free-popular'
          ? 'Popüler ücretsiz oyunlar'
          : k === 'new-releases'
            ? 'Yeni çıkan oyunlar'
            : k === 'discover-all'
              ? 'Keşfet - Tüm Oyunlar'
              : 'Keşfet'

  const subtitle =
    k === 'free-popular'
      ? 'Sürekli ücretsiz (F2P) bilinen başlıklar; Metacritic’e göre yüksekten düşüğe. Geçici %100 indirimli ücretsiz teklifler bu listede yok.'
      : k === 'free-100'
        ? 'Veri setindeki 0$ oyunlar.'
        : k === 'new-releases'
          ? 'Çıkış tarihi bilinen oyunlar arasından en yeni tarihe göre sıralanır.'
          : k === 'discover-all'
            ? 'Veri setindeki tum oyunlar.'
          : null

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        let raw: Game[] = []
        if (k === 'popular') raw = await fetchPopularGames(20)
        else if (k === 'discounted') raw = await fetchDiscountedGames(20)
        else if (k === 'free-popular') raw = await fetchCuratedFreeToPlayByMetacritic(80)
        else if (k === 'new-releases') raw = await fetchNewReleaseDeals(200, 18)
        else if (k === 'discover-all') raw = await fetchAllKnownGames(4000)
        else raw = await fetchHundredPercentFreeDeals(400, 24).catch(() => fetchAllKnownGames(4000))

        const unique = uniqueByGameKey(raw)
        const list =
          k === 'popular'
            ? sortGamesByMetacriticDesc(unique)
            : k === 'free-popular' || k === 'new-releases' || k === 'discover-all'
              ? unique
              : rotateByDailyOffset(unique)
        if (!cancelled) setGames(list)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Yükleme hatası')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [k])

  return (
    <>
      <PageBack />
      <h1 className="section-title">{title}</h1>
      <FavoritesLoginHint />
      {subtitle && (
        <p className="muted" style={{ marginTop: 6, maxWidth: 640, lineHeight: 1.45 }}>
          {subtitle}
        </p>
      )}
      {!loading && !err && (
        <p className="muted" style={{ marginTop: 8 }}>
          {games.length} oyun listeleniyor.
        </p>
      )}
      {loading && <p className="muted">Yükleniyor…</p>}
      {err && <p className="error">{err}</p>}
      {!loading && !err && games.length === 0 && (
        <p className="muted empty-state">
          Liste boş. Bir süre sonra yeniden dene veya <Link to="/">ana sayfaya dön</Link>.
        </p>
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
