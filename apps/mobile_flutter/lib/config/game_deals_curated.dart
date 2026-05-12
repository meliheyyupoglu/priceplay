import "../models/game.dart";

/// Oyun fırsatları listesinden çıkarılan CheapShark `gameID` değerleri.
const Set<String> kGameDealsExcludedIds = {"263462", "317776", "298615"};

/// Epic ücretsiz kampanyası vb. vitrin başı (CheapShark ile uyumlu kimlikler).
const List<Game> kGameDealsCurated = [
  Game(
    gameId: "289554",
    title: "Arranger: A Role-Puzzling Adventure",
    steamAppId: "2596420",
    cheapest: "0.00",
    normalPrice: "19.99",
    savings: "100",
    thumb:
        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2596420/capsule_231x87.jpg?t=1745972134",
  ),
  Game(
    gameId: "294416",
    title: "Trash Goblin",
    steamAppId: "2407830",
    cheapest: "0.00",
    normalPrice: "19.99",
    savings: "100",
    thumb:
        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2407830/b5f73d55cbca5df86e2feb1a92636ce62bb1439e/capsule_231x87.jpg?t=1778170992",
  ),
];

bool isExcludedFromGameDeals(Game g) {
  final id = g.gameId.trim();
  return id.isNotEmpty && kGameDealsExcludedIds.contains(id);
}

List<Game> mergeGameDealsCurated(List<Game> tail, {int max = 25}) {
  final seen = <String>{};
  final out = <Game>[];
  for (final g in [...kGameDealsCurated, ...tail]) {
    if (isExcludedFromGameDeals(g)) continue;
    final k = g.gameId.isNotEmpty ? g.gameId : g.title;
    if (k.isEmpty || seen.contains(k)) continue;
    seen.add(k);
    out.add(g);
    if (out.length >= max) break;
  }
  return out;
}
