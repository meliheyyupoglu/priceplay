import { chartSpots } from '../lib/priceHistorySample'

type Props = {
  anchorUsd: number
  seed: string
  title?: string
}

function safeSvgIdPart(s: string) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'chart'
}

export function MiniPriceHistoryChart({ anchorUsd, seed, title = 'Fiyat geçmişi' }: Props) {
  const spots = chartSpots(anchorUsd, seed)
  if (spots.length === 0) return null

  const gradId = `priceChartFill-${safeSvgIdPart(seed)}`

  const w = 320
  const h = 140
  const pad = 8
  const ys = spots.map((s) => s.y)
  const minY = Math.min(...ys) * 0.92
  const maxY = Math.max(...ys) * 1.08
  const spanY = maxY - minY || 1
  const spanX = spots.length - 1 || 1

  const coords = spots.map((p) => {
    const x = pad + (p.x / spanX) * (w - pad * 2)
    const y = pad + (1 - (p.y - minY) / spanY) * (h - pad * 2)
    return [x, y] as const
  })

  const polyPoints = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const bottomY = h - pad
  const firstX = coords[0][0]
  const lastX = coords[coords.length - 1][0]
  const areaD = `M ${firstX},${bottomY} ${coords.map(([x, y]) => `L ${x},${y}`).join(' ')} L ${lastX},${bottomY} Z`

  return (
    <div className="game-detail-chart card card-pad">
      <h2 className="game-detail-chart-title">{title}</h2>
      <svg
        className="game-detail-chart-svg"
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(167, 139, 250, 0.45)" />
            <stop offset="100%" stopColor="rgba(167, 139, 250, 0)" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <polyline
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyPoints}
        />
      </svg>
      <div className="game-detail-chart-axis muted">
        <span>≈ ${minY.toFixed(2)}</span>
        <span>≈ ${maxY.toFixed(2)}</span>
      </div>
    </div>
  )
}
