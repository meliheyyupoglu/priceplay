class Game {
  const Game({
    required this.gameId,
    required this.title,
    this.steamAppId,
    this.cheapest,
    this.normalPrice,
    this.savings,
    this.thumb,
    this.metacriticScore,
    this.releaseDate,
    this.promoSource,
  });

  final String gameId;
  final String title;
  final String? steamAppId;
  final String? cheapest;
  final String? normalPrice;
  final String? savings;
  final String? thumb;
  final String? metacriticScore;
  final String? releaseDate;
  /// epic = Epic Games Store kampanyası (vitrin açıklaması).
  final String? promoSource;

  factory Game.fromJson(Map<String, dynamic> raw) {
    String asString(dynamic value) => value == null ? "" : value.toString().trim();
    final gameId = asString(raw["gameID"]).isNotEmpty ? asString(raw["gameID"]) : asString(raw["gameId"]);
    final steamRaw = asString(raw["steamAppID"]).isNotEmpty ? asString(raw["steamAppID"]) : asString(raw["steamAppId"]);
    final title = asString(raw["title"]).isNotEmpty ? asString(raw["title"]) : asString(raw["external"]);
    final ps = asString(raw["promoSource"]);
    return Game(
      gameId: gameId,
      title: title.isEmpty ? "Unknown Game" : title,
      steamAppId: steamRaw.isEmpty || steamRaw == "0" ? null : steamRaw,
      cheapest: asString(raw["salePrice"]).isNotEmpty ? asString(raw["salePrice"]) : asString(raw["cheapest"]),
      normalPrice: asString(raw["normalPrice"]).isEmpty ? null : asString(raw["normalPrice"]),
      savings: asString(raw["savings"]).isEmpty ? null : asString(raw["savings"]),
      thumb: asString(raw["thumb"]).isEmpty ? null : asString(raw["thumb"]),
      metacriticScore: asString(raw["metacriticScore"]).isEmpty ? null : asString(raw["metacriticScore"]),
      releaseDate: asString(raw["releaseDate"]).isEmpty ? null : asString(raw["releaseDate"]),
      promoSource: ps.isEmpty ? null : ps,
    );
  }
}
