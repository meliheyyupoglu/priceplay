/** CheapShark mağaza geçmişi sunmadığından mobil uygulamadakiyle aynı mantıkta örnek eğri. */

const WEEKS = 26

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type PriceSpot = { x: number; y: number }

export function chartSpots(anchor: number, seed: string): PriceSpot[] {
  if (!(anchor > 0) || !Number.isFinite(anchor)) return []
  const rnd = mulberry32(hashString(seed) >>> 0)
  const out: PriceSpot[] = []
  let v = anchor * (1.08 + rnd() * 0.1)
  for (let i = 0; i < WEEKS; i++) {
    const t = i / (WEEKS - 1 || 1)
    const wave = Math.sin(t * Math.PI * 2.1 + rnd()) * anchor * 0.035
    v = v * 0.997 + wave * 0.05 + (anchor - v) * 0.04
    v = Math.max(anchor * 0.72, Math.min(anchor * 1.35, v))
    out.push({ x: i, y: v })
  }
  out[WEEKS - 1] = { x: WEEKS - 1, y: anchor }
  return out
}
