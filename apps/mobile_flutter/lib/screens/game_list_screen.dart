import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../i18n/app_strings.dart";
import "../models/game.dart";
import "../state/app_state.dart";
import "account_screen.dart";
import "detail_screen.dart";
import "widgets.dart";

class GameListScreen extends StatelessWidget {
  const GameListScreen({
    super.key,
    required this.titleTr,
    required this.titleEn,
    required this.items,
    this.subtitleTr,
    this.subtitleEn,
  });

  final String titleTr;
  final String titleEn;
  final String? subtitleTr;
  final String? subtitleEn;
  final List<Game> items;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final lang = state.lang;
    final enrichedItems = items;
    return Scaffold(
      appBar: AppBar(title: Text(trEn(lang, titleTr, titleEn))),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          if (subtitleTr != null || subtitleEn != null) ...[
            Text(
              trEn(lang, subtitleTr ?? "", subtitleEn ?? ""),
              style: const TextStyle(color: Color(0xFFC2C7E9)),
            ),
            const SizedBox(height: 8),
          ],
          for (final game in enrichedItems)
            GameTile(
              game: game,
              isFavorite: state.isFavorite(game.gameId.isNotEmpty ? game.gameId : game.title),
              onFavoriteToggle: () async {
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
              },
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
      ),
    );
  }
}
