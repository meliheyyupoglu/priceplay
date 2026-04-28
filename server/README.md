# CheapShark Proxy Server

CheapShark isteklerini tek noktadan geciren, cache/retry/rate-limit yapan ara backend.

## Kurulum

1. `server` klasorune gir:
   - `cd server`
2. Paketleri kur:
   - `npm install`
3. Ortam dosyasi:
   - `.env.example` dosyasini `.env` olarak kopyala.
4. Server calistir:
   - `npm run dev`

## Onerilen mimari ayari (env)

Bu kombinasyon ana sayfa/kategoriyi stabil tutar, arama/detayda kontrollu canli cekim verir:

- `CHEAPSHARK_UPSTREAM_ENABLED=1`
- `CHEAPSHARK_BACKGROUND_REFRESH=0`
- `CHEAPSHARK_ALLOW_UPSTREAM_GAMES_ID=1`
- `CHEAPSHARK_ALLOW_UPSTREAM_GAMES_TITLE=1`
- `STEAM_UPSTREAM_ENABLED=0`
- `CHEAPSHARK_DAILY_REFRESH_CRON=0 5 * * *`
- `CACHE_TTL_SECONDS=86400`

Ek korumalar:

- IP bazli limitler: `EXPENSIVE_READS_PER_MINUTE`, `SEARCH_REQUESTS_PER_MINUTE`
- Arama min karakter: `SEARCH_MIN_QUERY_LENGTH`
- Upstream timeout/retry/backoff: `UPSTREAM_TIMEOUT_MS`, `UPSTREAM_MAX_RETRIES`, `UPSTREAM_GAME_DETAIL_EXTRA_RETRIES`, `UPSTREAM_BACKOFF_BASE_MS`, `MAX_RETRY_AFTER_MS`

## Cache ayari

- Varsayilan CheapShark cache: `86400` saniye (24 saat); 429 icin onerilir.
- Degistirmek istersen `.env` icinde `CACHE_TTL_SECONDS` degerini guncelle

### 429 / upstream kesilmesi

- Upstream (CheapShark) **429 veya 5xx** verdiginde, bu sunucuda **daha once alinmis** (TTL dolmus olsa bile) yantit varsa **HTTP 200** ile o eski JSON doner; istemciye 429 yansimaz.
- Basarili yanitlar `data/cheapshark_upstream_stale.json` dosyasina da yazilir; sunucu yeniden acildiginda diskten yuklenir (**konferans oncesi** bir kez listeleri acip bu dosyanin olusmasini saglaman iyi olur).
- **Stale-while-revalidate:** Diskte veya bellekte kullanilabilir bir `/deals` / `/stores` kopyasi varsa **hemen 200 doner** (429 icin beklenmez). Varsayilan olarak taze veri en fazla ~90 sn aralikla arka planda denenir; **kapatmak** icin `.env`: `CHEAPSHARK_BACKGROUND_REFRESH=0`. Ayrica ayni turde (populer / indirimli) baska sayfa anahtari varsa **yedek snapshot** ile bos liste riski azalir.
- `GET /health` icinde `staleOnlyKeys` / `staleDiskFile` / `cheapsharkUpstreamEnabled` alanlarina bakabilirsin.

### Sadece onbellek (toplu cek, kullaniciya hep yerel)

1. Bir kez (veya cron ile) **warmup** calistir; `data/cheapshark_upstream_stale.json` dolsun.
2. `.env`: **`CHEAPSHARK_UPSTREAM_ENABLED=0`** — `/api/cheapshark/*` istekleri **CheapShark’a gitmez**, yalnizca bellek + disk + snapshot’tan doner (TTL icinde zaten boyleydi; bu ayar TTL dolunca bile kullaniciyi bekletmeden eskiyi gosterir, arka plan da kapaliysa upstream yok).
3. Istege bagli **`CHEAPSHARK_BACKGROUND_REFRESH=0`** — TTL dolunca bile kullanici isteginde arka planda CheapShark denemesi yok.
4. Gunde bir kez taze veri cekmek icin: **`CHEAPSHARK_DAILY_REFRESH_CRON=0 4 * * *`** (ornek: her gece 04:00). Bu cron **warmup ile ayni toplu cekimi** sunucu icinde calistirir; `UPSTREAM_ENABLED=0` olsa bile cron CheapShark’a gider.

### Warm-up (konferans)

1. `.env` icine `WARMUP_SECRET` ekle (rastgele uzun bir string). Istege bagli: `WARMUP_MAX_GAME_IDS` (onerilen 200+, en fazla 400) — populer listenin ilk sayfasindan kac oyun icin `/games?id=` cagrilacagi. Istege bagli: **`WARMUP_SEARCH_TITLES`** (virgulle, varsayilan `elden,portal,gta`) — `/games?title=` ornekleri. Istege bagli: `WARMUP_CATEGORY_TITLES` (or. `action,adventure,rpg,...`) — kategori prefill aramalari.
2. Sunucuyu baslat.
3. Yerelde: `npm run warmup` (script `WARMUP_BASE_URL` ile hedefi degistirebilir, varsayilan `http://127.0.0.1:3000`).
4. Veya HTTP: `POST /api/admin/warmup-cheapshark` veya **`POST /api/admin/refresh-cheapshark`** (aynı is) + baslik `X-Warmup-Secret: <ayni>` veya JSON `{ "secret": "..." }`.

Bu cagrilar `stores`, populer/indirimli/release `deals` sayfalari (genis kapsam), arama ornekleri (`WARMUP_SEARCH_TITLES`), kategori aramalari (`WARMUP_CATEGORY_TITLES`) ve populer ilk sayfadaki oyun ID’leri icin `/games` onbellegini doldurur; ardindan disk stale dosyasi yazilir.

## Endpointler

- `GET /health`
- `POST /api/admin/warmup-cheapshark` veya `POST /api/admin/refresh-cheapshark` (`.env` icinde `WARMUP_SECRET` gerekli; ayni body/secret)
- `GET /api/cheapshark/deals`
- `GET /api/cheapshark/games`
- `GET /api/cheapshark/stores`
- `GET /api/browse/categories` (ana sayfa kategori listesi; web buradan ceker)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/devices/register`
- `GET /api/watchlist`
- `POST /api/watchlist`
- `DELETE /api/watchlist/:gameId`
- `POST /api/notify/test`

## Register body

```json
{
  "firstName": "Test",
  "lastName": "User",
  "nickname": "testuser",
  "email": "test@example.com",
  "phone": "+905551112233",
  "password": "123456"
}
```

## Login body

```json
{
  "identifier": "test@example.com",
  "password": "123456"
}
```

## Device register body

Header: `x-user-id: <user_id>`

```json
{
  "token": "FCM_DEVICE_TOKEN",
  "platform": "android"
}
```

## Watchlist body

Header: `x-user-id: <user_id>`

```json
{
  "gameId": "612",
  "gameTitle": "Portal 2",
  "targetPrice": 4.99
}
```

## Push setup (FCM)

- `.env` icinde `FIREBASE_SERVICE_ACCOUNT_PATH` ver
- deger: Firebase service account JSON dosyasinin tam yolu
- cron varsayilan (takip fiyat taramasi): `PRICE_CHECK_CRON=0 9 * * *` (her gun 09:00)
- push kapaliysa server log'unda "Push disabled" mesaji gorursun
- test icin `POST /api/notify/test` endpointine `x-user-id` header'i gonder

## Flutter entegrasyonu

Flutter uygulamasini su sekilde baslat:

`flutter run --dart-define=PROXY_BASE_URL=http://YOUR_SERVER_IP:3000/api`

Not: Android emulatorde local makineye baglanmak icin genelde `10.0.2.2` kullanilir.
