import "dart:convert";
import "dart:async";

import "package:http/http.dart" as http;
import "package:shared_preferences/shared_preferences.dart";

import "../models/user.dart";

class AuthService {
  static const _tokenKey = "pp_auth_token";
  static const _localUsersKey = "pp_local_users_v2";
  static const _base = String.fromEnvironment("AUTH_API_BASE", defaultValue: "http://localhost:8787");
  String? _activeBase;

  static String _norm(String s) => s.trim().toLowerCase();
  static String _digits(String s) => s.replaceAll(RegExp(r"\D"), "");

  List<String> _candidates() {
    final list = <String>[
      if (_activeBase != null) _activeBase!,
      _base,
      "http://127.0.0.1:8787",
      "http://10.0.2.2:8787",
    ];
    final dedup = <String>{};
    return list.where((e) => dedup.add(e)).toList();
  }

  Future<http.Response> _sendWithBaseFallback(
    Future<http.Response> Function(String base) sender,
  ) async {
    String? lastError;
    for (final base in _candidates()) {
      try {
        final res = await sender(base).timeout(const Duration(seconds: 4));
        _activeBase = base;
        return res;
      } on TimeoutException {
        lastError = "Timeout: $base";
      } catch (e) {
        lastError = e.toString();
      }
    }
    throw _AuthUnavailable(
      "Auth sunucusuna baglanilamadi. Serveri ac: C:/priceplay/server icinde npm run dev. ${lastError ?? ""}",
    );
  }

  Future<List<Map<String, dynamic>>> _readLocalUsers() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_localUsersKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final data = jsonDecode(raw);
      if (data is List) {
        return data.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<void> _writeLocalUsers(List<Map<String, dynamic>> users) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_localUsersKey, jsonEncode(users));
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  Future<void> setToken(String? token) async {
    final prefs = await SharedPreferences.getInstance();
    if (token == null || token.isEmpty) {
      await prefs.remove(_tokenKey);
      return;
    }
    await prefs.setString(_tokenKey, token);
  }

  Future<(User, String)> register({
    required String firstName,
    required String lastName,
    required String nickname,
    required String email,
    required String phone,
    required String password,
  }) async {
    try {
      final res = await _sendWithBaseFallback((base) => http.post(
        Uri.parse("$base/api/auth/register"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "firstName": firstName,
          "lastName": lastName,
          "nickname": nickname,
          "email": email,
          "phone": phone,
          "password": password,
        }),
      ));
      if (res.statusCode >= 400) {
        throw Exception(_errorText(res.body, "Register failed"));
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      return (User.fromJson((data["user"] as Map).cast<String, dynamic>()), (data["token"] ?? "").toString());
    } on _AuthUnavailable {
      final users = await _readLocalUsers();
      final em = _norm(email);
      final nick = _norm(nickname);
      final ph = _digits(phone);
      if (users.any((u) => _norm((u["email"] ?? "").toString()) == em)) {
        throw Exception("Email already used");
      }
      if (users.any((u) => _norm((u["nickname"] ?? "").toString()) == nick)) {
        throw Exception("Nickname already used");
      }
      if (users.any((u) => _digits((u["phone"] ?? "").toString()) == ph)) {
        throw Exception("Phone already used");
      }
      final id = "lu_${DateTime.now().millisecondsSinceEpoch}";
      final now = DateTime.now().toIso8601String();
      final row = <String, dynamic>{
        "id": id,
        "firstName": firstName.trim(),
        "lastName": lastName.trim(),
        "nickname": nick,
        "email": em,
        "phone": ph,
        "password": password,
        "createdAt": now,
        "updatedAt": now,
      };
      users.add(row);
      await _writeLocalUsers(users);
      return (User.fromJson(row), "local:$id");
    }
  }

  Future<(User, String)> login({required String identifier, required String password}) async {
    try {
      final res = await _sendWithBaseFallback((base) => http.post(
        Uri.parse("$base/api/auth/login"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"identifier": identifier, "password": password}),
      ));
      if (res.statusCode >= 400) {
        throw Exception(_errorText(res.body, "Login failed"));
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      return (User.fromJson((data["user"] as Map).cast<String, dynamic>()), (data["token"] ?? "").toString());
    } on _AuthUnavailable {
      final users = await _readLocalUsers();
      final idn = _norm(identifier);
      final hit = users.where((u) {
        final em = _norm((u["email"] ?? "").toString());
        final nick = _norm((u["nickname"] ?? "").toString());
        return (em == idn || nick == idn) && (u["password"] ?? "").toString() == password;
      }).toList();
      if (hit.isEmpty) throw Exception("Invalid credentials");
      final user = hit.first;
      return (User.fromJson(user), "local:${user["id"]}");
    }
  }

  Future<User> me(String token) async {
    if (token.startsWith("local:")) {
      final id = token.substring("local:".length);
      final users = await _readLocalUsers();
      final row = users.firstWhere(
        (u) => (u["id"] ?? "").toString() == id,
        orElse: () => <String, dynamic>{},
      );
      if (row.isEmpty) throw Exception("User not found");
      return User.fromJson(row);
    }
    final res = await _sendWithBaseFallback((base) => http.get(
      Uri.parse("$base/api/auth/me"),
      headers: {"Authorization": "Bearer $token"},
    ));
    if (res.statusCode >= 400) {
      throw Exception(_errorText(res.body, "Auth failed"));
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return User.fromJson((data["user"] as Map).cast<String, dynamic>());
  }

  Future<User> updateProfile(
    String token, {
    required String firstName,
    required String lastName,
    required String nickname,
    required String phone,
  }) async {
    if (token.startsWith("local:")) {
      final id = token.substring("local:".length);
      final users = await _readLocalUsers();
      final idx = users.indexWhere((u) => (u["id"] ?? "").toString() == id);
      if (idx < 0) throw Exception("User not found");
      final nick = _norm(nickname);
      final ph = _digits(phone);
      if (users.any((u) => (u["id"] ?? "").toString() != id && _norm((u["nickname"] ?? "").toString()) == nick)) {
        throw Exception("Nickname already used");
      }
      if (users.any((u) => (u["id"] ?? "").toString() != id && _digits((u["phone"] ?? "").toString()) == ph)) {
        throw Exception("Phone already used");
      }
      users[idx]["firstName"] = firstName.trim();
      users[idx]["lastName"] = lastName.trim();
      users[idx]["nickname"] = nick;
      users[idx]["phone"] = ph;
      users[idx]["updatedAt"] = DateTime.now().toIso8601String();
      await _writeLocalUsers(users);
      return User.fromJson(users[idx]);
    }
    final res = await _sendWithBaseFallback((base) => http.patch(
      Uri.parse("$base/api/auth/profile"),
      headers: {"Content-Type": "application/json", "Authorization": "Bearer $token"},
      body: jsonEncode({
        "firstName": firstName,
        "lastName": lastName,
        "nickname": nickname,
        "phone": phone,
      }),
    ));
    if (res.statusCode >= 400) {
      throw Exception(_errorText(res.body, "Update failed"));
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return User.fromJson((data["user"] as Map).cast<String, dynamic>());
  }

  String _errorText(String body, String fallback) {
    try {
      final m = jsonDecode(body) as Map<String, dynamic>;
      return (m["error"] ?? fallback).toString();
    } catch (_) {
      return fallback;
    }
  }
}

class _AuthUnavailable implements Exception {
  _AuthUnavailable(this.message);
  final String message;
  @override
  String toString() => message;
}
