import type { Game, SteamPriceOverview } from '../types'

/** CheapShark `savings` alanı (yüzde, örn. "67.5"). */
export function parseSavingsPercent(savings: string | null | undefined): number | null {
  if (savings == null || savings === '') return null
  const n = parseFloat(String(savings))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

export function formatCheapestUsd(cheapest: string | null | undefined): string | null {
  if (cheapest == null) return null
  const t = String(cheapest).trim()
  if (!t) return null
  const n = parseFloat(t)
  if (!Number.isFinite(n)) return `$${t}`
  const dec = Math.round(n * 100) / 100
  const s = dec % 1 === 0 ? String(dec) : dec.toFixed(2)
  return `$${s}`
}

export type HeroPriceView =
  | {
      source: 'cheapshark'
      priceLabel: string
      discountPct: number | null
      note: string
    }
  | {
      source: 'steam'
      priceLabel: string
      discountPct: number | null
      oldFormatted: string | null
      note: string
    }
  | { source: 'none' }

/**
 * Carousel / vitrin: CheapShark en ucuz teklifi varsa onu öne al (Steam görselleri ayrı kalır).
 * Para birimi karışımı olmadan tek satır: önce CheapShark teklif, yoksa Steam formatı.
 */
export function pickHeroPriceView(game: Game, priceOverview: SteamPriceOverview | null): HeroPriceView {
  const cs = formatCheapestUsd(game.cheapest)
  if (cs) {
    return {
      source: 'cheapshark',
      priceLabel: cs,
      discountPct: parseSavingsPercent(game.savings),
      note: 'En ucuz teklif',
    }
  }
  const po = priceOverview
  if (po && String(po.final_formatted || '').trim()) {
    return {
      source: 'steam',
      priceLabel: po.final_formatted,
      discountPct: po.discount_percent > 0 ? po.discount_percent : null,
      oldFormatted: po.discount_percent > 0 ? po.initial_formatted : null,
      note: 'Steam (TR)',
    }
  }
  return { source: 'none' }
}
