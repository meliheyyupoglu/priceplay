import "dart:convert";

import "package:flutter/services.dart" show rootBundle;

import "../models/game.dart";
import "../models/price_row.dart";

class GameDetailData {
  const GameDetailData({
    required this.game,
    required this.priceRows,
    this.description,
    this.detailedDescription,
    this.pcMinimum,
    this.pcRecommended,
  });

  final Game game;
  final List<PriceRow> priceRows;
  final String? description;
  final String? detailedDescription;
  final String? pcMinimum;
  final String? pcRecommended;
}

class DemoSnapshotService {
  Map<String, dynamic>? _snapshot;

  String _stripHtml(String? input) {
    if (input == null || input.trim().isEmpty) return "";
    var text = input
        .replaceAll(RegExp(r"<br\s*/?>", caseSensitive: false), "\n")
        .replaceAll(RegExp(r"</p>", caseSensitive: false), "\n")
        .replaceAll(RegExp(r"<[^>]*>"), "")
        .replaceAll("&nbsp;", " ")
        .replaceAll("&amp;", "&")
        .replaceAll("&quot;", "\"")
        .replaceAll("&#39;", "'");
    text = text.replaceAll(RegExp(r"\n{3,}"), "\n\n").trim();
    return text;
  }

  Future<void> load() async {
    if (_snapshot != null) return;
    final content = await rootBundle.loadString("assets/data/demo-snapshot.json");
    _snapshot = jsonDecode(content) as Map<String, dynamic>;
  }

  List<Game> _parseGames(List<dynamic>? list) {
    if (list == null) return [];
    final seen = <String>{};
    final out = <Game>[];
    for (final item in list) {
      if (item is! Map<String, dynamic>) continue;
      final game = Game.fromJson(item);
      final key = game.gameId.isNotEmpty ? game.gameId : game.title;
      if (key.isEmpty || seen.contains(key)) continue;
      seen.add(key);
      out.add(game);
    }
    return out;
  }

  List<Map<String, dynamic>> _allPools() {
    final snap = _snapshot!;
    return [
      ...(snap["curatedPopular"] as List<dynamic>? ?? const []),
      ...(snap["popular"] as List<dynamic>? ?? const []),
      ...(snap["discounted"] as List<dynamic>? ?? const []),
      ...(snap["newReleases"] as List<dynamic>? ?? const []),
      ...(snap["free100"] as List<dynamic>? ?? const []),
    ].whereType<Map<String, dynamic>>().toList();
  }

  List<Game> fetchPopularGames() {
    final snap = _snapshot!;
    final curated = _parseGames((snap["curatedPopular"] as List<dynamic>?));
    if (curated.isNotEmpty) return curated.take(60).toList();
    return _parseGames((snap["popular"] as List<dynamic>?)).take(60).toList();
  }

  List<Game> fetchDiscountedGames() {
    final snap = _snapshot!;
    return _parseGames((snap["discounted"] as List<dynamic>?)).take(120).toList();
  }

  List<Game> fetchNewReleases() {
    final list = _parseGames((_snapshot!["newReleases"] as List<dynamic>?));
    list.sort((a, b) => (int.tryParse(b.releaseDate ?? "0") ?? 0).compareTo(int.tryParse(a.releaseDate ?? "0") ?? 0));
    return list.take(120).toList();
  }

  List<Game> fetchFreeGames() {
    final list = _parseGames((_snapshot!["free100"] as List<dynamic>?));
    return list.take(120).toList();
  }

  List<Game> fetchAllKnownGames() {
    final merged = [
      ..._parseGames((_snapshot!["curatedPopular"] as List<dynamic>?)),
      ..._parseGames((_snapshot!["popular"] as List<dynamic>?)),
      ..._parseGames((_snapshot!["discounted"] as List<dynamic>?)),
      ..._parseGames((_snapshot!["newReleases"] as List<dynamic>?)),
      ..._parseGames((_snapshot!["free100"] as List<dynamic>?)),
    ];
    final uniq = <String, Game>{};
    for (final game in merged) {
      final key = game.gameId.isNotEmpty ? game.gameId : game.title;
      if (key.isEmpty || uniq.containsKey(key)) continue;
      uniq[key] = game;
    }
    return uniq.values.take(2000).toList();
  }

  List<Game> searchGames(String query) {
    final q = query.trim().toLowerCase();
    if (q.length < 3) return [];
    final exact = (_snapshot!["searches"] as Map<String, dynamic>? ?? const {})[q] as List<dynamic>?;
    if (exact != null && exact.isNotEmpty) return _parseGames(exact).take(50).toList();
    return fetchAllKnownGames().where((g) => g.title.toLowerCase().contains(q)).take(50).toList();
  }

  Game? findGameById(String gameId) {
    final all = fetchAllKnownGames();
    for (final game in all) {
      if (game.gameId == gameId) return game;
    }
    return null;
  }

  List<PriceRow> _buildPriceRowsFromDeals(List<dynamic> deals, Game fallbackGame) {
    final storesRaw = (_snapshot!["stores"] as List<dynamic>? ?? const []);
    final stores = <String, String>{};
    for (final item in storesRaw) {
      if (item is! Map<String, dynamic>) continue;
      final id = item["storeID"]?.toString() ?? "";
      if (id.isEmpty) continue;
      stores[id] = item["storeName"]?.toString() ?? "Store $id";
    }

    final rows = <PriceRow>[];
    for (final raw in deals) {
      if (raw is! Map<String, dynamic>) continue;
      final sid = raw["storeID"]?.toString() ?? "";
      final puRaw = (raw["purchaseUrl"] ?? raw["purchase_url"] ?? "").toString().trim();
      final purchaseUrl =
          puRaw.isNotEmpty && !puRaw.toLowerCase().contains("cheapshark.com") ? puRaw : null;
      rows.add(
        PriceRow(
          storeId: sid,
          storeName: stores[sid] ?? "Store $sid",
          salePrice: (raw["salePrice"] ?? raw["price"] ?? "0").toString(),
          retailPrice: raw["retailPrice"]?.toString() ?? fallbackGame.normalPrice ?? "0",
          savings: raw["savings"]?.toString() ?? "0",
          dealId: raw["dealID"]?.toString() ?? "",
          purchaseUrl: purchaseUrl,
        ),
      );
    }
    rows.sort((a, b) => (double.tryParse(a.salePrice) ?? 0).compareTo(double.tryParse(b.salePrice) ?? 0));
    return rows;
  }

  List<PriceRow> buildPriceRows(String gameId, Game fallbackGame) {
    final details = (_snapshot!["gameDetails"] as Map<String, dynamic>? ?? const {})[gameId] as Map<String, dynamic>?;
    final deals = (details?["deals"] as List<dynamic>? ?? const []);
    return _buildPriceRowsFromDeals(deals, fallbackGame);
  }

  Map<String, dynamic>? _fallbackGamePayload(String gameId, String title) {
    final matchedDeals = <Map<String, dynamic>>[];
    String resolvedTitle = title;
    String? thumb;
    String? steamAppId;

    for (final raw in _allPools()) {
      final rawId = (raw["gameID"] ?? raw["gameId"] ?? "").toString().trim();
      final rawTitle = (raw["title"] ?? raw["external"] ?? "").toString().trim();
      final idMatch = gameId.isNotEmpty && rawId == gameId;
      final titleMatch = title.isNotEmpty && rawTitle.toLowerCase() == title.toLowerCase();
      if (!idMatch && !titleMatch) continue;
      resolvedTitle = rawTitle.isNotEmpty ? rawTitle : resolvedTitle;
      thumb ??= (raw["thumb"] ?? "").toString().trim().isEmpty ? null : raw["thumb"].toString();
      final sid = (raw["steamAppID"] ?? raw["steamAppId"] ?? "").toString().trim();
      if (sid.isNotEmpty && sid != "0") {
        steamAppId ??= sid;
      }
      matchedDeals.add({
        "storeID": (raw["storeID"] ?? "").toString(),
        "salePrice": (raw["salePrice"] ?? raw["price"] ?? "0").toString(),
        "retailPrice": (raw["normalPrice"] ?? raw["retailPrice"] ?? "0").toString(),
        "savings": (raw["savings"] ?? "0").toString(),
        "dealRating": (raw["dealRating"] ?? "0").toString(),
        "dealID": (raw["dealID"] ?? "").toString(),
        "releaseDate": (raw["releaseDate"] ?? "").toString(),
      });
    }

    if (matchedDeals.isEmpty) return null;
    return {
      "info": {
        "title": resolvedTitle,
        "thumb": thumb,
        "steamAppID": steamAppId,
      },
      "deals": matchedDeals,
    };
  }

  Map<String, dynamic>? _findPayloadByTitle(String title) {
    if (title.isEmpty) return null;
    final details = (_snapshot!["gameDetails"] as Map<String, dynamic>? ?? const {});
    final target = title.toLowerCase().trim();
    for (final entry in details.entries) {
      final value = entry.value;
      if (value is! Map<String, dynamic>) continue;
      final info = value["info"];
      if (info is! Map<String, dynamic>) continue;
      final detailTitle = (info["title"] ?? "").toString().toLowerCase().trim();
      if (detailTitle == target) return value;
      if (detailTitle.contains(target) || target.contains(detailTitle)) return value;
    }
    return null;
  }

  static const Set<String> _epicShowcaseGameIds = {"289554", "294416"};

  List<PriceRow> _epicShowcaseSyntheticRows(Game g) {
    final title = g.title.trim().isEmpty ? "game" : g.title.trim();
    final q = Uri.encodeComponent(title);
    final epicUrl = "https://store.epicgames.com/en-US/browse?q=$q";
    final steam = g.steamAppId?.trim() ?? "";
    final steamUrl = steam.isNotEmpty ? "https://store.steampowered.com/app/${Uri.encodeComponent(steam)}/" : null;
    return [
      PriceRow(
        storeId: "25",
        storeName: "Epic Games Store",
        salePrice: g.cheapest ?? "0.00",
        retailPrice: g.normalPrice ?? "19.99",
        savings: g.savings ?? "100",
        dealId: "epic-showcase",
        purchaseUrl: epicUrl,
      ),
      if (steamUrl != null)
        PriceRow(
          storeId: "1",
          storeName: "Steam",
          salePrice: g.normalPrice ?? "19.99",
          retailPrice: g.normalPrice ?? "19.99",
          savings: "0",
          dealId: "steam-list",
          purchaseUrl: steamUrl,
        ),
    ];
  }

  GameDetailData getGameDetail(String gameId, {Game? seedGame}) {
    final existing = seedGame ?? findGameById(gameId);
    if (existing == null) {
      return GameDetailData(
        game: Game(gameId: gameId, title: "Unknown Game"),
        priceRows: const [],
      );
    }

    final detailsMap = _snapshot!["gameDetails"] as Map<String, dynamic>? ?? const {};
    Map<String, dynamic>? payload = detailsMap[gameId] as Map<String, dynamic>?;
    payload ??= _findPayloadByTitle(existing.title);
    payload ??= _fallbackGamePayload(gameId, existing.title);

    final info = payload?["info"] as Map<String, dynamic>? ?? const {};
    final title = (info["title"] ?? "").toString().trim();
    final thumb = (info["thumb"] ?? "").toString().trim();
    final steamAppId = (info["steamAppID"] ?? existing.steamAppId ?? "").toString().trim();
    final steamDetails = (_snapshot!["steamAppDetails"] as Map<String, dynamic>? ?? const {})[steamAppId];
    final shortDescription = steamDetails is Map<String, dynamic> ? _stripHtml((steamDetails["short_description"] ?? "").toString()) : "";
    final detailedDescription = steamDetails is Map<String, dynamic> ? _stripHtml((steamDetails["detailed_description"] ?? "").toString()) : "";
    final pcRequirements = steamDetails is Map<String, dynamic> ? steamDetails["pc_requirements"] : null;
    final pcMinimum = pcRequirements is Map<String, dynamic> ? _stripHtml((pcRequirements["minimum"] ?? "").toString()) : "";
    final pcRecommended = pcRequirements is Map<String, dynamic> ? _stripHtml((pcRequirements["recommended"] ?? "").toString()) : "";

    final merged = Game(
      gameId: existing.gameId,
      title: title.isNotEmpty ? title : existing.title,
      steamAppId: steamAppId.isNotEmpty && steamAppId != "0" ? steamAppId : existing.steamAppId,
      cheapest: existing.cheapest,
      normalPrice: existing.normalPrice,
      savings: existing.savings,
      thumb: thumb.isNotEmpty ? thumb : existing.thumb,
      metacriticScore: existing.metacriticScore,
      releaseDate: existing.releaseDate,
      promoSource: existing.promoSource,
    );
    var rows = _buildPriceRowsFromDeals(payload?["deals"] as List<dynamic>? ?? const [], merged);
    if (rows.isEmpty && _epicShowcaseGameIds.contains(gameId)) {
      rows = _epicShowcaseSyntheticRows(merged);
    }
    final cheapest = rows.isNotEmpty ? rows.first.salePrice : merged.cheapest;
    final topSaving = rows.isNotEmpty ? rows.first.savings : merged.savings;
    final enriched = Game(
      gameId: merged.gameId,
      title: merged.title,
      steamAppId: merged.steamAppId,
      cheapest: cheapest,
      normalPrice: merged.normalPrice,
      savings: topSaving,
      thumb: merged.thumb,
      metacriticScore: merged.metacriticScore,
      releaseDate: merged.releaseDate,
      promoSource: merged.promoSource ?? (_epicShowcaseGameIds.contains(gameId) ? "epic" : null),
    );
    return GameDetailData(
      game: enriched,
      priceRows: rows,
      description: shortDescription.isEmpty ? null : shortDescription,
      detailedDescription: detailedDescription.isEmpty ? null : detailedDescription,
      pcMinimum: pcMinimum.isEmpty ? null : pcMinimum,
      pcRecommended: pcRecommended.isEmpty ? null : pcRecommended,
    );
  }
}
