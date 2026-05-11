import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../i18n/app_strings.dart";
import "../state/app_state.dart";
import "detail_screen.dart";
import "widgets.dart";

class CategoryGamesScreen extends StatelessWidget {
  const CategoryGamesScreen({super.key, required this.category});

  final String category;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final lang = state.lang;
    final games = state.byCategory(category).take(300).toList();
    return Scaffold(
      appBar: AppBar(title: Text(category)),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Text(
            trEn(
              lang,
              "Bu kategoriye uygun one cikan oyunlar",
              "Featured games for this category",
            ),
            style: const TextStyle(color: Color(0xFFC2C7E9)),
          ),
          const SizedBox(height: 10),
          if (games.isEmpty)
            Text(trEn(lang, "Bu kategori icin oyun bulunamadi.", "No games found for this category.")),
          for (final game in games)
            GameTile(
              game: game,
              isFavorite: state.isFavorite(game.gameId.isNotEmpty ? game.gameId : game.title),
              onFavoriteToggle: () => state.toggleFavorite(game),
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
      ),
    );
  }
}
