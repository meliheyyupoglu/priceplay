# PricePlay Mobile (Flutter)

Bu klasor PricePlay web projesinin Flutter mobil uyarlamasidir.

## Kurulum

1. Flutter SDK kurulu olmali (`flutter --version`).
2. Bu klasorde paketleri yukle:

```bash
flutter pub get
```

3. Uygulamayi calistir:

```bash
flutter run
```

## Veri Kaynagi

- Uygulama `assets/data/demo-snapshot.json` dosyasini kullanir.
- Bu dosya root projedeki `public/demo-snapshot.json` ile ayni veriden alinmistir.
- Webde veri guncellendiginde mobil dosyasini da guncelle:

```powershell
Copy-Item "..\..\public\demo-snapshot.json" ".\assets\data\demo-snapshot.json" -Force
```
