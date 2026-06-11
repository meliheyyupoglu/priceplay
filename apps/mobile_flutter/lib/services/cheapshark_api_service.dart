import "dart:convert";

import "package:http/http.dart" as http;

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

class CheapsharkApiService {
  static const _base = "https://www.cheapshark.com/api/1.0";

  Map<String, String> _storeNames = {};
  List<Game> _popular = [];
  List<Game> _discounted = [];
  List<Game> _newReleases = [];
  List<Game> _freeDeals = [];
  List<Game> _discover = [];
  bool _loaded = false;

  String _stripHtml(String? input) {
    if (input == null || input.trim().isEmpty) return "";
    var text = input
        .replaceAll(RegExp(r"<br\s*/?>", caseSensitive: false), "\n")
        .replaceAll(RegExp(r"</p>", caseSensitive: false), "\n")
        .replaceAll(RegExp(r"<[^>]*>"), "")
        .replaceAll("&nbsp;", " ")
        .replaceAll("&amp;", "&");
    return text.replaceAll(RegExp(r"\n{3,}"), "\n\n").trim();
  }

  List<Game> _parseGames(List<dynamic> list) {
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

  Future<List<dynamic>> _getDeals({
    required String sortBy,
    bool onSale = false,
    required int page,
  }) async {
    final sale = onSale ? "&onSale=1" : "";
    final url = "$_base/deals?sortBy=$sortBy$sale&pageSize=60&pageNumber=$page";
    final res = await http.get(Uri.parse(url));
    if (res.statusCode != 200) return [];
    final data = jsonDecode(res.body);
    return data is List ? data : [];
  }

  Future<void> _fetchStoreNames() async {
    final res = await http.get(Uri.parse("$_base/stores"));
    if (res.statusCode != 200) return;
    final data = jsonDecode(res.body);
    if (data is! List) return;
    final map = <String, String>{};
    for (final item in data) {
      if (item is! Map<String, dynamic>) continue;
      final id = (item["storeID"] ?? "").toString();
      if (id.isEmpty) continue;
      map[id] = (item["storeName"] ?? "Store $id").toString();
    }
    _storeNames = map;
  }

  bool _isHundredPercent(Game g) {
    final sale = double.tryParse((g.cheapest ?? "999").replaceAll(",", ".")) ?? 999;
    final retail = double.tryParse((g.normalPrice ?? "0").replaceAll(",", ".")) ?? 0;
    final sav = double.tryParse((g.savings ?? "0").replaceAll(",", ".")) ?? 0;
    return sale <= 0.05 && retail >= 0.5 && sav >= 99;
  }

  Future<void> load() async {
    if (_loaded) return;
    await _fetchStoreNames();

    final popularPages = await Future.wait([
      _getDeals(sortBy: "Deal%20Rating", page: 0),
      _getDeals(sortBy: "Deal%20Rating", page: 1),
    ]);
    final discountedPages = await Future.wait([
      _getDeals(sortBy: "Savings", onSale: true, page: 0),
      _getDeals(sortBy: "Savings", onSale: true, page: 1),
    ]);

    _popular = _parseGames([...popularPages[0], ...popularPages[1]]);
    _discounted = _parseGames([...discountedPages[0], ...discountedPages[1]]);

    final releaseRaw = await _getDeals(sortBy: "Release", page: 0);
    _newReleases = _parseGames(releaseRaw)
      ..sort((a, b) => (int.tryParse(b.releaseDate ?? "0") ?? 0).compareTo(int.tryParse(a.releaseDate ?? "0") ?? 0));

    final freeRaw = await _getDeals(sortBy: "Savings", onSale: true, page: 0);
    _freeDeals = _parseGames(freeRaw).where(_isHundredPercent).take(80).toList();

    final uniq = <String, Game>{};
    for (final g in [..._popular, ..._discounted]) {
      final key = g.gameId.isNotEmpty ? g.gameId : g.title;
      if (key.isEmpty) continue;
      uniq[key] = g;
    }
    _discover = uniq.values.take(120).toList();
    _loaded = true;
  }

  List<Game> fetchPopularGames() => List.unmodifiable(_popular);
  List<Game> fetchDiscountedGames() => List.unmodifiable(_discounted);
  List<Game> fetchNewReleases() => List.unmodifiable(_newReleases);
  List<Game> fetchFreeDeals() => List.unmodifiable(_freeDeals);
  List<Game> fetchDiscoverDeals() => List.unmodifiable(_discover);

  Future<List<Game>> searchGames(String query) async {
    final q = query.trim();
    if (q.length < 3) return [];
    final res = await http.get(Uri.parse("$_base/games?title=${Uri.encodeComponent(q)}&limit=50"));
    if (res.statusCode != 200) return [];
    final data = jsonDecode(res.body);
    if (data is! List) return [];
    return _parseGames(data);
  }

  Game? findGameById(String gameId) {
    for (final g in [..._popular, ..._discounted, ..._discover, ..._freeDeals, ..._newReleases]) {
      if (g.gameId == gameId) return g;
    }
    return null;
  }

  List<PriceRow> _buildPriceRows(List<dynamic> deals, Game fallback) {
    final rows = <PriceRow>[];
    for (final raw in deals) {
      if (raw is! Map<String, dynamic>) continue;
      final sid = (raw["storeID"] ?? "").toString();
      final puRaw = (raw["purchaseUrl"] ?? raw["purchase_url"] ?? "").toString().trim();
      final purchaseUrl = puRaw.isNotEmpty && !puRaw.toLowerCase().contains("cheapshark.com") ? puRaw : null;
      rows.add(
        PriceRow(
          storeId: sid,
          storeName: _storeNames[sid] ?? "Store $sid",
          salePrice: (raw["salePrice"] ?? raw["price"] ?? "0").toString(),
          retailPrice: raw["retailPrice"]?.toString() ?? fallback.normalPrice ?? "0",
          savings: raw["savings"]?.toString() ?? "0",
          dealId: raw["dealID"]?.toString() ?? "",
          purchaseUrl: purchaseUrl,
        ),
      );
    }
    rows.sort((a, b) => (double.tryParse(a.salePrice) ?? 0).compareTo(double.tryParse(b.salePrice) ?? 0));
    return rows;
  }

  Future<Map<String, dynamic>?> _fetchSteamDetails(String appId) async {
    final url = "https://store.steampowered.com/api/appdetails?appids=${Uri.encodeComponent(appId)}&l=turkish&cc=tr";
    final res = await http.get(Uri.parse(url));
    if (res.statusCode != 200) return null;
    final data = jsonDecode(res.body);
    if (data is! Map<String, dynamic>) return null;
    final block = data[appId];
    if (block is! Map<String, dynamic> || block["success"] != true) return null;
    final inner = block["data"];
    return inner is Map<String, dynamic> ? inner : null;
  }

  Future<GameDetailData> fetchGameDetail(String gameId, {Game? seedGame}) async {
    final existing = seedGame ?? findGameById(gameId);
    final res = await http.get(Uri.parse("$_base/games?id=${Uri.encodeComponent(gameId)}"));
    if (res.statusCode != 200) {
      if (existing != null) {
        return GameDetailData(game: existing, priceRows: const []);
      }
      return GameDetailData(
        game: Game(gameId: gameId, title: "Unknown Game"),
        priceRows: const [],
      );
    }

    final payload = jsonDecode(res.body) as Map<String, dynamic>;
    final info = payload["info"];
    final infoMap = info is Map<String, dynamic> ? info : <String, dynamic>{};
    final title = (infoMap["title"] ?? existing?.title ?? "Unknown Game").toString();
    final thumb = (infoMap["thumb"] ?? existing?.thumb ?? "").toString().trim();
    final steamRaw = (infoMap["steamAppID"] ?? existing?.steamAppId ?? "").toString().trim();
    final steamAppId = steamRaw.isNotEmpty && steamRaw != "0" ? steamRaw : null;

    var rows = _buildPriceRows(payload["deals"] as List<dynamic>? ?? const [], existing ?? Game(gameId: gameId, title: title));

    String? description;
    String? detailedDescription;
    String? pcMinimum;
    String? pcRecommended;

    if (steamAppId != null) {
      final steam = await _fetchSteamDetails(steamAppId);
      if (steam != null) {
        description = _stripHtml((steam["short_description"] ?? "").toString());
        detailedDescription = _stripHtml((steam["about_the_game"] ?? "").toString());
        final pc = steam["pc_requirements"];
        if (pc is Map<String, dynamic>) {
          pcMinimum = _stripHtml((pc["minimum"] ?? "").toString());
          pcRecommended = _stripHtml((pc["recommended"] ?? "").toString());
        }
      }
    }

    final cheapest = rows.isNotEmpty ? rows.first.salePrice : existing?.cheapest;
    final savings = rows.isNotEmpty ? rows.first.savings : existing?.savings;
    final game = Game(
      gameId: gameId,
      title: title,
      steamAppId: steamAppId,
      cheapest: cheapest,
      normalPrice: existing?.normalPrice,
      savings: savings,
      thumb: thumb.isEmpty ? existing?.thumb : thumb,
      metacriticScore: existing?.metacriticScore,
      releaseDate: existing?.releaseDate,
    );

    return GameDetailData(
      game: game,
      priceRows: rows,
      description: description?.isEmpty == true ? null : description,
      detailedDescription: detailedDescription?.isEmpty == true ? null : detailedDescription,
      pcMinimum: pcMinimum?.isEmpty == true ? null : pcMinimum,
      pcRecommended: pcRecommended?.isEmpty == true ? null : pcRecommended,
    );
  }
}
