import "../models/price_row.dart";

String steamStoreAppUrl(String steamAppId) {
  return "https://store.steampowered.com/app/${Uri.encodeComponent(steamAppId)}/";
}

bool _isCheapshark(String url) {
  return url.toLowerCase().contains("cheapshark.com");
}

String? _safeDirect(String? raw) {
  final t = raw?.trim();
  if (t == null || t.isEmpty) return null;
  if (!t.toLowerCase().startsWith("http")) return null;
  if (_isCheapshark(t)) return null;
  return t;
}

/// CheapShark `storeID` ile mağaza sitesi (CheapShark değil); tam ürün URL’si yoksa arama.
String? deriveStoreListingUrl(PriceRow row, String? steamAppId, String gameTitle) {
  final sid = row.storeId.trim();
  final steam = steamAppId?.trim() ?? "";
  final title = gameTitle.trim().isEmpty ? "game" : gameTitle.trim();
  final q = Uri.encodeComponent(title);

  if (sid == "1" && steam.isNotEmpty) return steamStoreAppUrl(steam);

  if (sid == "25") return "https://store.epicgames.com/en-US/browse?q=$q";
  if (sid == "7") return "https://www.gog.com/en/games?search=$q";
  if (sid == "11") return "https://www.humblebundle.com/store/search?search=$q";
  if (sid == "3") return "https://www.greenmangaming.com/en/search?query=$q";
  if (sid == "15") return "https://www.fanatical.com/en/search?search=$q";
  if (sid == "23") return "https://www.gamebillet.com/catalogsearch/result/?q=$q";
  if (sid == "29") return "https://2game.com/en/catalogsearch/result/?q=$q";
  if (sid == "2") return "https://www.gamersgate.com/en/games?query=$q";

  return null;
}

String? storePurchaseUrl(PriceRow row, String? steamAppId, String gameTitle) {
  final direct = _safeDirect(row.purchaseUrl);
  if (direct != null) return direct;
  return deriveStoreListingUrl(row, steamAppId, gameTitle);
}
