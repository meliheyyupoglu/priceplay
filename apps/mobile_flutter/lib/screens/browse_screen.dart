import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../i18n/app_strings.dart";
import "../models/game.dart";
import "../state/app_state.dart";
import "../utils/genre_label.dart";
import "account_screen.dart";
import "detail_screen.dart";
import "widgets.dart";

class BrowseScreen extends StatefulWidget {
  const BrowseScreen({super.key});

  @override
  State<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends State<BrowseScreen> {
  String selected = "discover";
  String selectedCategory = "all";

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

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final lang = state.lang;
    if (!state.isReady) return const Center(child: CircularProgressIndicator());
    final items = state.browseKind(selected);
    final filtered = selectedCategory == "all"
        ? items
        : items.where((g) => genreLabelFor(g.title) == selectedCategory).toList();
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        PageHero(
          title: trEn(lang, "Kategoriler", "Browse"),
          subtitle: trEn(lang, "Canli firsat listelerini gez veya filtreleyerek daralt", "Browse live deal lists or narrow down with filters"),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: selected,
                decoration: const InputDecoration(
                  filled: true,
                  fillColor: Color(0xFF171A2E),
                  border: OutlineInputBorder(),
                ),
                items: [
                  DropdownMenuItem(value: "popular", child: Text(trEn(lang, "Populer", "Popular"))),
                  DropdownMenuItem(value: "discounted", child: Text(trEn(lang, "Indirimdekiler", "Discounted"))),
                  DropdownMenuItem(value: "free-100", child: Text(trEn(lang, "0 dolar oyunlar", "0-dollar games"))),
                  DropdownMenuItem(value: "new-releases", child: Text(trEn(lang, "Yeni Cikanlar", "New Releases"))),
                  DropdownMenuItem(value: "discover", child: Text(trEn(lang, "Kesfet", "Discover"))),
                ],
                onChanged: (value) => setState(() => selected = value ?? "popular"),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: selectedCategory,
                decoration: const InputDecoration(
                  filled: true,
                  fillColor: Color(0xFF171A2E),
                  border: OutlineInputBorder(),
                ),
                items: [
                  DropdownMenuItem(value: "all", child: Text(trEn(lang, "Tumu", "All"))),
                  ...browseCategories.map((c) => DropdownMenuItem(
                        value: c,
                        child: Text(trEn(lang, categoryLabelTr(c), c)),
                      )),
                ],
                onChanged: (value) => setState(() => selectedCategory = value ?? "all"),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        for (final game in filtered)
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
