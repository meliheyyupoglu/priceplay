import "package:flutter/foundation.dart";
import "dart:math";

import "../i18n/app_strings.dart";
import "../models/game.dart";
import "../models/user.dart";
import "../services/auth_service.dart";
import "../services/demo_snapshot_service.dart";
import "../config/game_deals_curated.dart";
import "../utils/genre_label.dart";

class AppState extends ChangeNotifier {
  AppState(this._service, this._authService);

  final DemoSnapshotService _service;
  final AuthService _authService;
  bool isReady = false;
  bool isAuthenticated = false;
  User? authUser;
  String? _authToken;
  final Set<String> favoriteIds = <String>{};
  final Map<String, double> _alertTargetByGame = <String, double>{};
  final Map<String, bool> _alertEnabledByGame = <String, bool>{};
  AppLang lang = AppLang.tr;
  final Map<String, bool> _pricePresenceCache = <String, bool>{};

  Future<void> init() async {
    await _service.load();
    final token = await _authService.getToken();
    if (token != null && token.isNotEmpty) {
      try {
        final me = await _authService.me(token);
        _authToken = token;
        authUser = me;
        isAuthenticated = true;
      } catch (_) {
        await _authService.setToken(null);
      }
    }
    isReady = true;
    notifyListeners();
  }

  List<Game> get popular => _withPrice(_service.fetchPopularGames());

  /// Popüler vitrinde Grand Theft Auto V (CheapShark `298615`) öne alınır.
  List<Game> popularForHome() {
    final base = _withPrice(popular);
    if (base.any((g) => g.gameId == "298615")) return base;
    final gta = _service
        .getGameDetail("298615", seedGame: const Game(gameId: "298615", title: "Grand Theft Auto V"))
        .game;
    if (!_hasPrice(gta)) return base;
    return _withPrice([gta, ...base]);
  }
  List<Game> get discounted => _withPrice(_service.fetchDiscountedGames());
  List<Game> get freeGames => _withPrice(_service.fetchFreeGames());
  List<Game> get newReleases => _withPrice(_service.fetchNewReleases());
  List<Game> get allKnown => _withPrice(_service.fetchAllKnownGames());

  bool _matchesGtaSearchQuery(String query) {
    final q = query.trim().toLowerCase();
    if (q.length < 3) return false;
    return q.contains("gta") || q.contains("grand theft");
  }

  List<Game> search(String query) {
    final base = _withPrice(_service.searchGames(query));
    if (!_matchesGtaSearchQuery(query)) return base;
    if (base.any((g) => g.gameId == "298615")) return base;
    final gta = _service
        .getGameDetail("298615", seedGame: const Game(gameId: "298615", title: "Grand Theft Auto V"))
        .game;
    if (!_hasPrice(gta)) return base;
    return _withPrice([gta, ...base]);
  }
  Game? findById(String id) => _service.findGameById(id);
  DemoSnapshotService get service => _service;

  bool _hasPrice(Game g) {
    final p = double.tryParse((g.cheapest ?? "").replaceAll(",", "."));
    if (p != null && p >= 0) return true;

    final key = g.gameId.isNotEmpty ? g.gameId : g.title;
    final cached = _pricePresenceCache[key];
    if (cached != null) return cached;

    final detail = _service.getGameDetail(key, seedGame: g);
    final fromRows = detail.priceRows.isNotEmpty;
    final fromDetailCheapest = (double.tryParse((detail.game.cheapest ?? "").replaceAll(",", ".")) ?? -1) >= 0;
    final ok = fromRows || fromDetailCheapest;
    _pricePresenceCache[key] = ok;
    return ok;
  }

  bool _isBlockedTitle(Game g) {
    final t = g.title.trim().toLowerCase();
    return t == "the ball" || t == "counter-strike 2" || t == "counter strike 2" || t == "cs2" || t == "cs 2";
  }

  List<Game> _withPrice(List<Game> list) {
    return list.where((g) => !_isBlockedTitle(g) && _hasPrice(g)).toList();
  }

  void toggleFavorite(Game game) {
    final key = game.gameId.isNotEmpty ? game.gameId : game.title;
    if (favoriteIds.contains(key)) {
      favoriteIds.remove(key);
      _alertTargetByGame.remove(key);
      _alertEnabledByGame.remove(key);
    } else {
      favoriteIds.add(key);
      final current = double.tryParse((game.cheapest ?? "").replaceAll(",", ".")) ?? 10.0;
      _alertTargetByGame[key] = current;
      _alertEnabledByGame[key] = false;
    }
    notifyListeners();
  }

  bool tryToggleFavorite(Game game) {
    if (!isAuthenticated) return false;
    toggleFavorite(game);
    return true;
  }

  Future<void> register({
    required String firstName,
    required String lastName,
    required String nickname,
    required String email,
    required String phone,
    required String password,
  }) async {
    final (user, token) = await _authService.register(
      firstName: firstName,
      lastName: lastName,
      nickname: nickname,
      email: email,
      phone: phone,
      password: password,
    );
    _authToken = token;
    authUser = user;
    isAuthenticated = true;
    await _authService.setToken(token);
    notifyListeners();
  }

  Future<void> login({required String identifier, required String password}) async {
    final (user, token) = await _authService.login(identifier: identifier, password: password);
    _authToken = token;
    authUser = user;
    isAuthenticated = true;
    await _authService.setToken(token);
    notifyListeners();
  }

  Future<void> updateProfile({
    required String firstName,
    required String lastName,
    required String nickname,
    required String phone,
  }) async {
    final token = _authToken;
    if (token == null || token.isEmpty) throw Exception("Not authenticated");
    final user = await _authService.updateProfile(
      token,
      firstName: firstName,
      lastName: lastName,
      nickname: nickname,
      phone: phone,
    );
    authUser = user;
    notifyListeners();
  }

  Future<void> signOut() async {
    if (!isAuthenticated) return;
    isAuthenticated = false;
    authUser = null;
    _authToken = null;
    await _authService.setToken(null);
    notifyListeners();
  }

  bool isFavorite(String gameId) => favoriteIds.contains(gameId);

  void setLang(AppLang value) {
    if (lang == value) return;
    lang = value;
    notifyListeners();
  }

  List<Game> get favorites {
    final map = {
      for (final g in _withPrice(_service.fetchAllKnownGames())) (g.gameId.isNotEmpty ? g.gameId : g.title): g,
    };
    return favoriteIds.map((id) => map[id]).whereType<Game>().toList();
  }

  List<Game> byCategory(String category) {
    return _withPrice(allKnown).where((g) => genreLabelFor(g.title) == category).toList();
  }

  bool _isNearFree(Game g) {
    final p = double.tryParse((g.cheapest ?? "").replaceAll(",", ".")) ?? 999;
    return p >= 0 && p <= 0.05;
  }

  bool _isZeroDollar(Game g) {
    final p = double.tryParse((g.cheapest ?? "").replaceAll(",", ".")) ?? 999;
    return p <= 0.01;
  }

  List<Game> freePopular() {
    final free100Keys = {
      for (final g in freeGames) (g.gameId.isNotEmpty ? g.gameId : g.title),
    };
    return popular.where((g) {
      final key = g.gameId.isNotEmpty ? g.gameId : g.title;
      return _isNearFree(g) && !free100Keys.contains(key);
    }).toList();
  }

  List<Game> discountedWithoutZeroDollar() {
    return _withPrice(discounted).where((g) => !_isZeroDollar(g)).toList();
  }

  List<Game> hundredOffDeals() {
    return _withPrice([...kGameDealsCurated]);
  }

  List<Game> discoverShuffled() {
    final pool = [..._withPrice(allKnown)];
    pool.shuffle(Random(DateTime.now().day + DateTime.now().month));
    return pool;
  }

  List<Game> browseKind(String kind) {
    final k = kind.trim().toLowerCase();
    if (k == "discounted") return _withPrice(discountedWithoutZeroDollar());
    if (k == "free-popular") return _withPrice(freePopular());
    if (k == "free-100") return _withPrice(hundredOffDeals());
    if (k == "new-releases") return _withPrice(newReleases);
    if (k == "discover-all") return _withPrice(discoverShuffled());
    return _withPrice(popular);
  }

  double alertTargetFor(Game game) {
    final key = game.gameId.isNotEmpty ? game.gameId : game.title;
    final existing = _alertTargetByGame[key];
    if (existing != null) return existing;
    final current = double.tryParse((game.cheapest ?? "").replaceAll(",", ".")) ?? 10.0;
    _alertTargetByGame[key] = current;
    _alertEnabledByGame[key] = _alertEnabledByGame[key] ?? false;
    return current;
  }

  bool alertEnabledFor(Game game) {
    final key = game.gameId.isNotEmpty ? game.gameId : game.title;
    return _alertEnabledByGame[key] ?? false;
  }

  void setAlertEnabled(Game game, bool value) {
    final key = game.gameId.isNotEmpty ? game.gameId : game.title;
    _alertEnabledByGame[key] = value;
    notifyListeners();
  }

  void setAlertTarget(Game game, double value) {
    final key = game.gameId.isNotEmpty ? game.gameId : game.title;
    final current = double.tryParse((game.cheapest ?? "").replaceAll(",", ".")) ?? value;
    final safe = value.clamp(0, current);
    _alertTargetByGame[key] = safe.toDouble();
    notifyListeners();
  }
}
