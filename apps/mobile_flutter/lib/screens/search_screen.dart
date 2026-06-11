import "dart:async";

import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../i18n/app_strings.dart";
import "../models/game.dart";
import "../state/app_state.dart";
import "account_screen.dart";
import "detail_screen.dart";
import "widgets.dart";

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  Future<void> _onFavoriteTap(BuildContext context, AppState state, Game game) async {
    final ok = state.tryToggleFavorite(game);
    if (ok) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Giris gerekli"),
        content: const Text("Favorilere eklemek icin giris yap veya kayit ol."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Iptal")),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AccountScreen()));
            },
            child: const Text("Giris / Kayit"),
          ),
        ],
      ),
    );
  }

  final _controller = TextEditingController();
  List<Game> results = [];
  Timer? _debounce;

  void _runSearch(AppState state) {
    final q = _controller.text.trim();
    if (q.length < 3) {
      setState(() => results = []);
      return;
    }
    state.search(q).then((list) {
      if (!mounted) return;
      setState(() => results = list);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final lang = state.lang;
    if (!state.isReady) return const Center(child: CircularProgressIndicator());
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        PageHero(
          title: trEn(lang, "Oyun Ara", "Search"),
          subtitle: trEn(lang, "Aradigin oyunu hizlica bul", "Find the game you want quickly"),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _controller,
          onChanged: (_) {
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 280), () => _runSearch(state));
          },
          onSubmitted: (_) => _runSearch(state),
          decoration: InputDecoration(
            hintText: trEn(lang, "Ara", "Search"),
            filled: true,
            fillColor: const Color(0xFF171A2E),
            suffixIcon: IconButton(icon: const Icon(Icons.search), onPressed: () => _runSearch(state)),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        for (final game in results)
          GameTile(
            game: game,
            isFavorite: state.isFavorite(game.gameId.isNotEmpty ? game.gameId : game.title),
            onFavoriteToggle: () => _onFavoriteTap(context, state, game),
            onAlertTap: () => showPriceAlertEditor(context, state: state, game: game),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => DetailScreen(
                  gameId: game.gameId.isNotEmpty ? game.gameId : game.title,
                  seedGame: game,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
