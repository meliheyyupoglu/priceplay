import "dart:async";

import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../i18n/app_strings.dart";
import "../models/game.dart";
import "../state/app_state.dart";
import "account_screen.dart";
import "detail_screen.dart";
import "game_list_screen.dart";
import "widgets.dart";

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final PageController _popularController;
  Timer? _popularTimer;
  int _popularIndex = 0;

  @override
  void initState() {
    super.initState();
    _popularController = PageController(viewportFraction: 0.93);
  }

  @override
  void dispose() {
    _popularTimer?.cancel();
    _popularController.dispose();
    super.dispose();
  }

  void _openDetail(BuildContext context, Game game) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DetailScreen(
          gameId: game.gameId.isNotEmpty ? game.gameId : game.title,
          seedGame: game,
        ),
      ),
    );
  }

  void _openBrowseKind(BuildContext context, String kind, String titleTr, String titleEn, {String? subtitleTr, String? subtitleEn}) {
    final state = this.context.read<AppState>();
    final list = state.browseKind(kind);
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => GameListScreen(
          titleTr: titleTr,
          titleEn: titleEn,
          subtitleTr: subtitleTr,
          subtitleEn: subtitleEn,
          items: list,
        ),
      ),
    );
  }

  void _bindPopularAutoScroll(int count) {
    _popularTimer?.cancel();
    if (count < 2) return;
    _popularTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!_popularController.hasClients) return;
      _popularIndex = (_popularIndex + 1) % count;
      _popularController.animateToPage(
        _popularIndex,
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeInOut,
      );
    });
  }

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
    final popular = state.popularForHome().take(20).toList();
    final discounted = state.discountedWithoutZeroDollar().take(20).toList();
    final discoverPool = state.discoverShuffled();
    final discoverCarousel = discoverPool.take(25).toList();
    final discoverRandomList = discoverPool.skip(25).take(10).toList();
    final popularTop10 = popular.take(10).toList();
    final dealTop = state.hundredOffDeals().take(25).toList();
    _bindPopularAutoScroll(popularTop10.length);

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        PageHero(
          title: "PricePlay",
          subtitle: trEn(lang, "Anlik firsatlar, indirimler ve fiyat takibi", "Live deals, discounts and price tracking"),
        ),
        const SizedBox(height: 14),
        SectionHeader(
          title: trEn(lang, "Populer", "Popular"),
          trailing: TextButton(
            onPressed: () => _openBrowseKind(context, "popular", "Populer", "Popular"),
            child: Text(trEn(lang, "Tumunu gor", "See all")),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 260,
          child: PageView.builder(
            controller: _popularController,
            itemCount: popularTop10.length,
            itemBuilder: (context, index) {
              final game = popularTop10[index];
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: GameStripCard(
                  game: game,
                  hero: true,
                  onTap: () => _openDetail(context, game),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 14),
        SectionHeader(
          title: trEn(lang, "Indirimdekiler", "Discounted"),
          trailing: TextButton(
            onPressed: () => _openBrowseKind(context, "discounted", "Indirimdekiler", "Discounted"),
            child: Text(trEn(lang, "Tumunu gor", "See all")),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 215,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: discounted.map((g) => GameStripCard(game: g, onTap: () => _openDetail(context, g))).toList(),
          ),
        ),
        const SizedBox(height: 14),
        SectionHeader(
          title: trEn(lang, "Oyun Firsatlari", "Game Deals"),
          trailing: TextButton(
            onPressed: () => _openBrowseKind(
              context,
              "free-100",
              "Oyun Firsatlari",
              "Game Deals",
              subtitleTr: "Ucretsiz ve yuksek indirimli kampanya teklifleri (Epic, Steam vb.).",
              subtitleEn: "Free and deep promotional deals (Epic Games Store, Steam, etc.).",
            ),
            child: Text(trEn(lang, "Tumunu gor", "See all")),
          ),
        ),
        const SizedBox(height: 8),
        if (dealTop.isEmpty)
          Text(trEn(lang, "Su an listelenecek firsat yok.", "No deals to show right now."))
        else
          SizedBox(
            height: 215,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: dealTop.map((g) => GameStripCard(game: g, onTap: () => _openDetail(context, g))).toList(),
            ),
          ),
        const SizedBox(height: 14),
        SectionHeader(
          title: trEn(lang, "Kesfet", "Discover"),
          trailing: TextButton(
            onPressed: () => _openBrowseKind(context, "discover", "Kesfet", "Discover"),
            child: Text(trEn(lang, "Tumunu gor", "See all")),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 215,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: discoverCarousel.map((g) => GameStripCard(game: g, onTap: () => _openDetail(context, g))).toList(),
          ),
        ),
        const SizedBox(height: 8),
        for (final g in discoverRandomList)
          GameTile(
            game: g,
            isFavorite: state.isFavorite(g.gameId.isNotEmpty ? g.gameId : g.title),
            onFavoriteToggle: () => _onFavoriteTap(context, state, g),
            onAlertTap: () => showPriceAlertEditor(context, state: state, game: g),
            onTap: () => _openDetail(context, g),
          ),
      ],
    );
  }
}
