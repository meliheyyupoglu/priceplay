import "package:flutter/foundation.dart";
import "dart:math";

import "../i18n/app_strings.dart";
import "../models/game.dart";
import "../models/user.dart";
import "../services/auth_service.dart";
import "../services/cheapshark_api_service.dart";
import "../utils/genre_label.dart";

class AppState extends ChangeNotifier {
  AppState(this._service, this._authService);

  final CheapsharkApiService _service;
  final AuthService _authService;
  bool isReady = false;
  bool isAuthenticated = false;
  User? authUser;
  String? _authToken;
  final Map<String, Game> _favoriteGames = <String, Game>{};
  final Map<String, double> _alertTargetByGame = <String, double>{};
  final Map<String, bool> _alertEnabledByGame = <String, bool>{};
  AppLang lang = AppLang.tr;

  CheapsharkApiService get service => _service;

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
  List<Game> get discounted => _withPrice(_service.fetchDiscountedGames());
  List<Game> get newReleases => _withPrice(_service.fetchNewReleases());

  List<Game> popularForHome() => _withPrice(popular);

  Future<List<Game>> search(String query) async {
    final list = await _service.searchGames(query);
    return _withPrice(list);
  }

  Game? findById(String id) => _service.findGameById(id);

  bool _isBlockedTitle(Game g) {
    final t = g.title.trim().toLowerCase();
    return t == "the ball" || t == "counter-strike 2" || t == "counter strike 2" || t == "cs2" || t == "cs 2";
  }

  bool _hasPrice(Game g) {
    final p = double.tryParse((g.cheapest ?? "").replaceAll(",", "."));
    return p != null && p >= 0;
  }

  List<Game> _withPrice(List<Game> list) {
    return list.where((g) => !_isBlockedTitle(g) && _hasPrice(g)).toList();
  }

  void toggleFavorite(Game game) {
    final key = game.gameId.isNotEmpty ? game.gameId : game.title;
    if (_favoriteGames.containsKey(key)) {
      _favoriteGames.remove(key);
      _alertTargetByGame.remove(key);
      _alertEnabledByGame.remove(key);
    } else {
      _favoriteGames[key] = game;
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

  bool isFavorite(String gameId) => _favoriteGames.containsKey(gameId);

  void setLang(AppLang value) {
    if (lang == value) return;
    lang = value;
    notifyListeners();
  }

  List<Game> get favorites => _favoriteGames.values.toList();

  List<Game> byCategory(String category) {
    return _withPrice(_service.fetchDiscoverDeals()).where((g) => genreLabelFor(g.title) == category).toList();
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
    final dealKeys = {for (final g in _service.fetchFreeDeals()) (g.gameId.isNotEmpty ? g.gameId : g.title)};
    return popular.where((g) {
      final key = g.gameId.isNotEmpty ? g.gameId : g.title;
      return _isNearFree(g) && !dealKeys.contains(key);
    }).toList();
  }

  List<Game> discountedWithoutZeroDollar() {
    return _withPrice(discounted).where((g) => !_isZeroDollar(g)).toList();
  }

  List<Game> hundredOffDeals() => _withPrice(_service.fetchFreeDeals());

  List<Game> discoverShuffled() {
    final pool = [..._withPrice(_service.fetchDiscoverDeals())];
    pool.shuffle(Random(DateTime.now().day + DateTime.now().month));
    return pool;
  }

  List<Game> browseKind(String kind) {
    final k = kind.trim().toLowerCase();
    if (k == "discounted") return _withPrice(discountedWithoutZeroDollar());
    if (k == "free-popular") return _withPrice(freePopular());
    if (k == "free-100") return _withPrice(hundredOffDeals());
    if (k == "new-releases") return _withPrice(newReleases);
    if (k == "discover" || k == "discover-all") return _withPrice(discoverShuffled());
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
