import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageBack } from '../components/PageBack'
import { FavoritesLoginHint } from '../components/FavoritesLoginHint'
import { MiniPriceHistoryChart } from '../components/MiniPriceHistoryChart'
import { buildPriceRows, fetchGameJson } from '../api/cheapshark'
import { fetchSteamAppDetails } from '../api/steam'
import type { Game, PriceRow } from '../types'
import { useAuth } from '../context/AuthContext'
import { isFavorite, toggleFavorite } from '../lib/favorites'
import { addWatchlist, removeWatchlist } from '../api/watchlistApi'
import { formatDiscountPercent, storePurchaseUrl } from '../lib/storePurchaseUrl'

const HERO_DESC_MAX = 1400

function usdAnchorFromRows(rows: PriceRow[]): number {
  const nums = rows
    .filter((r) => !r.isSteamDirect)
    .map((r) => parseFloat(r.salePrice))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (nums.length === 0) return 0
  return Math.min(...nums)
}

export function GameDetailPage() {
  const { id: rawId } = useParams()
  const id = rawId ? decodeURIComponent(rawId) : ''
  const { user } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [rows, setRows] = useState<PriceRow[]>([])
  const [headerImg, setHeaderImg] = useState<string | null>(null)
  const [steamShort, setSteamShort] = useState<string | null>(null)
  const [steamDetailed, setSteamDetailed] = useState<string | null>(null)
  const [steamPcMin, setSteamPcMin] = useState<string | null>(null)
  const [steamPcRec, setSteamPcRec] = useState<string | null>(null)
  const [steamGenres, setSteamGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [fav, setFav] = useState(false)
  const [favBusy, setFavBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const payload = await fetchGameJson(id)
        if (cancelled) return
        const info = payload.info as Record<string, unknown> | undefined
        const title = String(info?.title ?? id)
        const sid = info?.steamAppID != null ? String(info.steamAppID).trim() : ''
        const steamAppId = sid && sid !== '0' ? sid : null
        const g: Game = {
          gameId: id,
          title,
          steamAppId,
          thumb: info?.thumb != null ? String(info.thumb) : null,
        }
        setGame(g)
        const priceRows = await buildPriceRows(g, payload)
        setRows(priceRows)

        const steamId = steamAppId || g.steamAppId
        if (steamId) {
          const d = await fetchSteamAppDetails(steamId)
          if (!cancelled && d) {
            setHeaderImg(d.headerImage)
            setSteamShort(d.shortDescription)
            setSteamDetailed(d.detailedDescriptionPlain)
            setSteamPcMin(d.pcMinimumPlain)
            setSteamPcRec(d.pcRecommendedPlain)
            setSteamGenres(d.genres ?? [])
          }
        } else {
          setHeaderImg(null)
          setSteamShort(null)
          setSteamDetailed(null)
          setSteamPcMin(null)
          setSteamPcRec(null)
          setSteamGenres([])
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Hata')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (user?.id && game) setFav(isFavorite(user.id, game))
    else setFav(false)
  }, [user?.id, game])

  async function onToggleFav() {
    if (!user?.id || !game) return
    setFavBusy(true)
    try {
      const now = await toggleFavorite(user.id, game, {
        addWatchlist: (g) => addWatchlist(user.id, g, null),
        removeWatchlist: (gid) => removeWatchlist(user.id, gid),
      })
      setFav(now)
    } finally {
      setFavBusy(false)
    }
  }

  const chartAnchor = usdAnchorFromRows(rows)
  const chartSeed = game?.gameId ?? id

  const shortTrim = steamShort?.trim() ?? ''
  const detailedTrim = steamDetailed?.trim() ?? ''
  let heroDesc = shortTrim
  if (!heroDesc && detailedTrim) {
    heroDesc =
      detailedTrim.length > HERO_DESC_MAX ? `${detailedTrim.slice(0, HERO_DESC_MAX).trimEnd()}…` : detailedTrim
  }

  const showDetailSection =
    (detailedTrim && detailedTrim !== shortTrim) || !!steamPcMin || !!steamPcRec || steamGenres.length > 0

  if (!id) {
    return (
      <p className="muted">
        Geçersiz oyun. <Link to="/">Ana sayfa</Link>
      </p>
    )
  }

  return (
    <>
      <PageBack />
      {loading && <p className="muted">Yükleniyor…</p>}
      {err && <p className="error">{err}</p>}
      {game && !loading && !err && (
        <div className="game-detail-page">
          <div className="game-detail-hero">
            {(headerImg || game.thumb) && (
              <img
                className="game-detail-cover"
                src={headerImg || game.thumb || ''}
                alt=""
              />
            )}
            <div className="game-detail-hero-text">
              <h1 className="game-detail-title">{game.title}</h1>
              <FavoritesLoginHint />
              {user && game.gameId && (
                <div className="game-detail-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={favBusy}
                    onClick={onToggleFav}
                  >
                    {fav ? '★ Favorilerde' : '☆ Favorilere ekle'}
                  </button>
                </div>
              )}
              {heroDesc && (
                <div className="game-detail-hero-desc">
                  <h2 className="section-title game-detail-section-title">Açıklama</h2>
                  <p className="game-detail-hero-desc-body">{heroDesc}</p>
                </div>
              )}
            </div>
          </div>

          <h2 className="section-title game-detail-prices-head">Mağaza fiyatları</h2>
          {chartAnchor > 0 && (
            <MiniPriceHistoryChart anchorUsd={chartAnchor} seed={chartSeed} />
          )}
          {rows.length === 0 ? (
            <p className="muted">Fiyat satırı yok.</p>
          ) : (
            <div className="prices-table-shell">
              <table className="prices prices-store-table">
                <thead>
                  <tr>
                    <th>Mağaza</th>
                    <th>Fiyat</th>
                    <th>Liste</th>
                    <th>İndirim</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const href = storePurchaseUrl(r, game.steamAppId, game.gameId, game.title)
                    const isBest = i === 0
                    return (
                      <tr key={r.storeId + r.dealId + i} className={isBest ? 'price-row price-row--best' : 'price-row'}>
                        <td>
                          <div className="prices-store-cell">
                            {isBest && <span className="price-best-pill">En iyi fiyat</span>}
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="prices-store-link"
                              >
                                <strong>{r.storeName}</strong>
                                <span className="prices-external-icon" aria-hidden>
                                  ↗
                                </span>
                              </a>
                            ) : (
                              <strong>{r.storeName}</strong>
                            )}
                          </div>
                        </td>
                        <td className="prices-price-cell">{r.displaySaleLabel ?? `$${r.salePrice}`}</td>
                        <td className="muted">{r.displayRetailLabel ?? `$${r.retailPrice}`}</td>
                        <td className="prices-discount-cell">{formatDiscountPercent(r.savings)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {showDetailSection && (
            <div id="steam-detay" className="game-detail-extra card card-pad">
              <h2 className="section-title game-detail-section-title">Ayrıntılar</h2>
              {detailedTrim && detailedTrim !== shortTrim && (
                <div className="game-detail-long-desc">
                  <h3 className="game-detail-subhead">Detaylı açıklama</h3>
                  <p className="muted game-detail-long-body" style={{ margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {detailedTrim}
                  </p>
                </div>
              )}
              {steamGenres.length > 0 && (
                <div className="game-detail-genres">
                  <h3 className="game-detail-subhead">Türler</h3>
                  <div className="game-detail-genre-tags">
                    {steamGenres.map((g) => (
                      <span key={g} className="game-detail-genre-pill">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(steamPcMin || steamPcRec) && (
                <div className="game-detail-sysreq">
                  <h3 className="game-detail-subhead">Sistem gereksinimleri</h3>
                  {steamPcMin && (
                    <div className="game-detail-sys-block">
                      <div className="game-detail-sys-label">Minimum</div>
                      <p className="muted game-detail-sys-text">{steamPcMin}</p>
                    </div>
                  )}
                  {steamPcRec && (
                    <div className="game-detail-sys-block">
                      <div className="game-detail-sys-label">Önerilen</div>
                      <p className="muted game-detail-sys-text">{steamPcRec}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
