import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BrowseCategory } from '../lib/browseCategories'
import { steamStoreHeaderUrl } from '../lib/browseCategories'

type Props = {
  categories: BrowseCategory[]
  thumbsByCategory: Record<string, string[]>
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function SteamBrowseCategories({ categories, thumbsByCategory }: Props) {
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(4)

  useLayoutEffect(() => {
    function sync() {
      const w = window.innerWidth
      if (w < 520) setPerPage(1)
      else if (w < 900) setPerPage(2)
      else setPerPage(4)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  const pages = useMemo(() => chunk(categories, perPage), [categories, perPage])
  const pageCount = Math.max(1, pages.length)

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1))
  }, [pageCount])

  useEffect(() => {
    setPage(0)
  }, [perPage])

  if (categories.length === 0) return null

  return (
    <section className="steam-browse-section">
      <h2 className="pp-section-heading">Kategoriler</h2>
      <div className="steam-browse-root">
        <button
          type="button"
          className="steam-browse-arrow steam-browse-arrow-prev"
          aria-label="Önceki sayfa"
          disabled={page <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          <ChevL />
        </button>
        <button
          type="button"
          className="steam-browse-arrow steam-browse-arrow-next"
          aria-label="Sonraki sayfa"
          disabled={page >= pageCount - 1}
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
        >
          <ChevR />
        </button>

        <div className="steam-browse-viewport">
          <div
            className="steam-browse-track"
            style={{
              width: `${pageCount * 100}%`,
              transform: `translateX(-${(page * 100) / pageCount}%)`,
            }}
          >
            {pages.map((row, pi) => (
              <div
                key={pi}
                className="steam-browse-page"
                style={{
                  width: `${100 / pageCount}%`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${perPage}, minmax(0, 1fr))`,
                  gap: 16,
                }}
              >
                {row.map((c) => (
                  <CategorySteamTile
                    key={c.keyEn}
                    category={c}
                    thumbs={thumbsByCategory[c.keyEn] ?? []}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="steam-browse-dots" role="tablist" aria-label="Kategori sayfaları">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === page}
                className={`steam-browse-dot ${i === page ? 'active' : ''}`}
                onClick={() => setPage(i)}
                aria-label={`Sayfa ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CategorySteamTile({ category: c, thumbs }: { category: BrowseCategory; thumbs: string[] }) {
  const steamUrls = (c.steamHeaderIds ?? []).map(steamStoreHeaderUrl)
  const merged: string[] = []
  const seen = new Set<string>()
  for (const u of [...thumbs.filter(Boolean), ...steamUrls]) {
    if (!u || seen.has(u)) continue
    seen.add(u)
    merged.push(u)
    if (merged.length >= 5) break
  }
  const slots: (string | null)[] = []
  for (let i = 0; i < 5; i++) slots.push(merged[i] ?? null)
  const titleMap: Record<string, string> = {
    Action: 'AKSİYON',
    Adventure: 'MACERA',
    RPG: 'RPG',
    Strategy: 'STRATEJİ',
    Shooter: 'NİŞANCI',
    Indie: 'BAĞIMSIZ',
    Simulation: 'SİMÜLASYON',
    Sports: 'SPOR',
    Racing: 'YARIŞ',
  }
  const titleText = titleMap[c.keyEn] ?? c.titleTr

  return (
    <Link to={`/category/${encodeURIComponent(c.keyEn)}`} className="steam-browse-tile">
      <div className="steam-browse-tile-visual">
        {slots.map((url, i) =>
          url ? (
            <img key={i} src={url} alt="" className={`steam-browse-collage steam-browse-collage--${i}`} loading="lazy" />
          ) : (
            <div
              key={i}
              className={`steam-browse-collage-ph steam-browse-collage--${i}`}
              style={{ background: c.gradient }}
            />
          ),
        )}
        <div className="steam-browse-bluewash" aria-hidden />
        <div className="steam-browse-label">
          <span>{titleText}</span>
        </div>
      </div>
    </Link>
  )
}

function ChevL() {
  return (
    <svg width="22" height="40" viewBox="0 0 16 40" fill="none" aria-hidden>
      <path d="M10 8L4 20l6 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevR() {
  return (
    <svg width="22" height="40" viewBox="0 0 16 40" fill="none" aria-hidden>
      <path d="M6 8l6 12-6 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
