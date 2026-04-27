/** Mobil `GenreTags.labelFor` ile aynı deterministik etiket (başlık hash). */
const LABELS = [
  'Action',
  'Indie',
  'RPG',
  'Strategy',
  'Adventure',
  'Shooter',
  'Simulation',
  'Sports',
  'Racing',
] as const

export function genreLabelFor(title: string): string {
  let h = 0
  for (let i = 0; i < title.length; i++) {
    h = 0x1fffffff & (h + title.charCodeAt(i))
    h = 0x1fffffff & (h + ((0x0007ffff & h) << 10))
    h ^= h >> 6
  }
  h = 0x1fffffff & (h + ((0x03ffffff & h) << 3))
  h ^= h >> 11
  h = 0x1fffffff & (h + ((0x00003fff & h) << 15))
  h ^= h >> 10
  h = Math.abs(h | 0)
  return LABELS[h % LABELS.length]!
}
