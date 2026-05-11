# PricePlay Mobile

Bu klasor, web tarafindaki veri akisinin mobile karsiligini kurar.

## Mimari

- `packages/shared`: web ve mobile tarafinin ortak veri katmani
- `apps/mobile`: React Native (Expo) uygulamasi
- Veri kaynagi: `public/demo-snapshot.json` (canli API yok)

## Calistirma

1. Mobile dizinine gec:
   - `cd apps/mobile`
2. Bagimliliklari yukle:
   - `npm install`
3. Expo baslat:
   - `npm run start`

## Not

Bu kurulum ilk adim olarak local snapshot'tan veriyi cekip mobile ekranda gostermeyi hedefler.
Sonraki adimda ekranlari web sayfalariyla birebir esleyecek sekilde component bazli parcalanabilir.
