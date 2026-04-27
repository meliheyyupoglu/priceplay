/** Sunucu JSON ile uyumlu tip (`/api/browse/categories`). */
export type BrowseCategory = {
  keyEn: string
  titleTr: string
  titleEn?: string
  /** Kısa tanıtım metni (kategori kartı). */
  blurb?: string
  gradient: string
  /** Steam `store_item_assets` header (app id) — kolajda CheapShark sonrası doldurma. */
  steamHeaderIds?: number[]
}

/** Steam CDN — tarayıcıda doğrudan yüklenir (img src). */
export function steamStoreHeaderUrl(appId: number): string {
  return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`
}

/** Sunucu cevap vermezse kullanilan yerel liste (mobil ile ayni icerik + Steam kolaj idleri). */
export const FALLBACK_BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    keyEn: 'Action',
    titleTr: 'AKSİYON',
    titleEn: 'ACTION',
    blurb: 'Tempolu çatışmalar ve bol hareket.',
    gradient: 'linear-gradient(135deg,#1E3A5F,#0F172A)',
    steamHeaderIds: [379720, 782330, 1245620, 1091500, 2357570],
  },
  {
    keyEn: 'Adventure',
    titleTr: 'MACERA',
    titleEn: 'ADVENTURE',
    blurb: 'Keşif, bulmaca ve hikâye odaklı oyunlar.',
    gradient: 'linear-gradient(135deg,#2E4A62,#132238)',
    steamHeaderIds: [1259420, 1086940, 1593500, 2208920, 1182900],
  },
  {
    keyEn: 'RPG',
    titleTr: 'RPG',
    titleEn: 'RPG',
    blurb: 'Karakter gelişimi ve uzun soluklu maceralar.',
    gradient: 'linear-gradient(135deg,#3D2E5C,#1A1025)',
    steamHeaderIds: [292030, 813780, 1091500, 1151640, 582160],
  },
  {
    keyEn: 'Strategy',
    titleTr: 'STRATEJİ',
    titleEn: 'STRATEGY',
    blurb: 'Planlama, kaynak yönetimi ve taktik.',
    gradient: 'linear-gradient(135deg,#1A3D32,#0D1F1A)',
    steamHeaderIds: [394360, 814380, 281990, 594650, 1158310],
  },
  {
    keyEn: 'Shooter',
    titleTr: 'NİŞANCI',
    titleEn: 'SHOOTER',
    blurb: 'Nişan al, refleks kullan, rekabet et.',
    gradient: 'linear-gradient(135deg,#4A1E1E,#1A0A0A)',
    steamHeaderIds: [730, 1174180, 892970, 548430, 359550],
  },
  {
    keyEn: 'Indie',
    titleTr: 'BAĞIMSIZ',
    titleEn: 'INDIE',
    blurb: 'Yaratıcı küçük stüdyo yapımları.',
    gradient: 'linear-gradient(135deg,#3D3550,#1A1522)',
    steamHeaderIds: [1145360, 367520, 413150, 588650, 504230],
  },
  {
    keyEn: 'Simulation',
    titleTr: 'SİMÜLASYON',
    titleEn: 'SIMULATION',
    blurb: 'Simülasyon, yönetim ve gerçekçi sistemler.',
    gradient: 'linear-gradient(135deg,#2A4A4A,#0F2222)',
    steamHeaderIds: [413150, 648800, 1142710, 1426210, 227300],
  },
  {
    keyEn: 'Sports',
    titleTr: 'SPOR',
    titleEn: 'SPORTS',
    blurb: 'Saha, pist ve takım sporları.',
    gradient: 'linear-gradient(135deg,#2A3D2A,#101A10)',
    steamHeaderIds: [2669320, 1506830, 2369700, 2216400, 1640340],
  },
  {
    keyEn: 'Racing',
    titleTr: 'YARIŞ',
    titleEn: 'RACING',
    blurb: 'Hız, araç ve parkur deneyimi.',
    gradient: 'linear-gradient(135deg,#4A3A1E,#1A1208)',
    steamHeaderIds: [244210, 2440510, 1293830, 1222730, 365960],
  },
]
