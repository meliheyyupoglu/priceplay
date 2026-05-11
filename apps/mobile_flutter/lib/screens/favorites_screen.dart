import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../i18n/app_strings.dart";
import "../models/game.dart";
import "../state/app_state.dart";
import "account_screen.dart";
import "detail_screen.dart";
import "widgets.dart";

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final lang = state.lang;
    final items = state.favorites;
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        PageHero(
          title: trEn(lang, "Favoriler", "Favorites"),
          subtitle: trEn(lang, "Takip ettigin oyunlar burada", "Your tracked games are listed here"),
        ),
        const SizedBox(height: 8),
        if (items.isEmpty)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF171A2E),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF2F3557)),
            ),
            child: Text(trEn(lang, "Henuz favori yok.", "No favorites yet.")),
          ),
        for (final game in items)
          _FavoriteAlertCard(game: game),
      ],
    );
  }
}

class _FavoriteAlertCard extends StatelessWidget {
  const _FavoriteAlertCard({required this.game});

  final Game game;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final lang = state.lang;
    final currentPrice = double.tryParse((game.cheapest ?? "").replaceAll(",", ".")) ?? 10.0;
    final target = state.alertTargetFor(game).clamp(0.0, currentPrice);
    final enabled = state.alertEnabledFor(game);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF171A2E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2F3557)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => DetailScreen(
                    gameId: game.gameId.isNotEmpty ? game.gameId : game.title,
                    seedGame: game,
                  ),
                ),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: game.thumb != null
                        ? Image.network(game.thumb!, width: 90, height: 48, fit: BoxFit.cover)
                        : const SizedBox(width: 90, height: 48),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(game.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.notifications_active_outlined, color: Color(0xFF9EC6FF)),
                    onPressed: () => showPriceAlertEditor(context, state: state, game: game),
                  ),
                  IconButton(
                    icon: const Icon(Icons.star, color: Color(0xFFE1C1FF)),
                    onPressed: () async {
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
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.notifications_active_outlined, size: 18, color: Color(0xFFC2C7E9)),
                const SizedBox(width: 6),
                Text(
                  trEn(lang, "Fiyat alarmi: \$${target.toStringAsFixed(2)}", "Price alert: \$${target.toStringAsFixed(2)}"),
                  style: const TextStyle(color: Color(0xFFC2C7E9)),
                ),
                const Spacer(),
                Switch(
                  value: enabled,
                  onChanged: (v) => state.setAlertEnabled(game, v),
                ),
              ],
            ),
            Text(
              trEn(
                lang,
                "Mevcut: \$${currentPrice.toStringAsFixed(2)}  •  En yuksek hedef bu fiyat olabilir",
                "Current: \$${currentPrice.toStringAsFixed(2)}  •  Highest target is current price",
              ),
              style: const TextStyle(fontSize: 12, color: Color(0xFFBFC4E6)),
            ),
          ],
        ),
      ),
    );
  }
}
