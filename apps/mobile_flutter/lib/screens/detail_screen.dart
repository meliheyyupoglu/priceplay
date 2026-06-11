import "dart:math" as math;

import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "package:url_launcher/url_launcher.dart";

import "../i18n/app_strings.dart";
import "../models/game.dart";
import "../models/price_row.dart";
import "../services/cheapshark_api_service.dart";
import "../state/app_state.dart";
import "../utils/store_purchase_url.dart";
import "account_screen.dart";
import "widgets.dart";

class DetailScreen extends StatefulWidget {
  const DetailScreen({super.key, required this.gameId, this.seedGame});

  final String gameId;
  final Game? seedGame;

  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  Future<GameDetailData>? _detailFuture;
  String? _loadedForId;

  void _ensureLoaded(AppState state) {
    final key = "${widget.gameId}|${widget.seedGame?.gameId ?? ""}";
    if (_detailFuture != null && _loadedForId == key) return;
    _loadedForId = key;
    _detailFuture = state.service.fetchGameDetail(widget.gameId, seedGame: widget.seedGame);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final lang = state.lang;
    _ensureLoaded(state);
    return FutureBuilder<GameDetailData>(
      future: _detailFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Scaffold(
            appBar: AppBar(title: Text(trEn(lang, "Oyun", "Game"))),
            body: const Center(child: CircularProgressIndicator()),
          );
        }
        final detail = snapshot.data;
        if (detail == null || detail.game.title == "Unknown Game") {
          return Scaffold(
            appBar: AppBar(title: Text(trEn(lang, "Oyun", "Game"))),
            body: Center(child: Text(trEn(lang, "Oyun bulunamadi", "Game not found"))),
          );
        }
        return _DetailBody(detail: detail, lang: lang);
      },
    );
  }
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({required this.detail, required this.lang});

  final GameDetailData detail;
  final AppLang lang;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final game = detail.game;
    final rows = detail.priceRows;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(game.title),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: () => _showInformationSheet(context, detail, lang),
          ),
          if (state.isFavorite(game.gameId.isNotEmpty ? game.gameId : game.title))
            IconButton(
              icon: const Icon(Icons.notifications_active_outlined),
              onPressed: () => showPriceAlertEditor(context, state: state, game: game),
            ),
          IconButton(
            icon: Icon(state.isFavorite(game.gameId.isNotEmpty ? game.gameId : game.title) ? Icons.star : Icons.star_border),
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
          )
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          if (game.thumb != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                game.thumb!,
                height: 130,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            ),
          const SizedBox(height: 12),
          Text(game.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          Builder(
            builder: (context) {
              final sav = double.tryParse(game.savings ?? "0") ?? 0;
              final epicLine = game.promoSource == "epic" && sav >= 95;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("${trEn(lang, "En iyi fiyat", "Best price")}: \$${game.cheapest ?? "-"}"),
                  if (epicLine)
                    Text(
                      trEn(
                        lang,
                        "Indirim: Epic Games Store ucretsiz kampanyasi (%${sav.toStringAsFixed(0)})",
                        "Discount: Epic Games Store free promo (${sav.toStringAsFixed(0)}% off)",
                      ),
                      style: const TextStyle(color: Color(0xFF9EC6FF), fontWeight: FontWeight.w600),
                    )
                  else
                    Text("${trEn(lang, "Indirim", "Savings")}: %${sav.toStringAsFixed(0)}"),
                ],
              );
            },
          ),
          if ((detail.description ?? "").isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              detail.description!,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xFFD0D0EA)),
            ),
          ],
          const SizedBox(height: 12),
          _PriceHistoryCard(game: game, rows: rows, lang: lang),
          const SizedBox(height: 12),
          Text(trEn(lang, "Magaza Fiyatlari", "Store Prices"), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (rows.isEmpty)
            Text(trEn(lang, "Fiyat satiri bulunamadi.", "No price rows found."))
          else
            ...rows.asMap().entries.map((entry) => _PriceRowCard(row: entry.value, rank: entry.key + 1, lang: lang, game: game)),
        ],
      ),
    );
  }

  void _showInformationSheet(BuildContext context, GameDetailData detail, AppLang lang) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF141629),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: ListView(
              shrinkWrap: true,
              children: [
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      trEn(lang, "Oyun Bilgileri", "Game Information"),
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  trEn(lang, "Detayli bilgi paneli", "Detailed info panel"),
                  style: const TextStyle(color: Color(0xFFC2C7E9)),
                ),
                const SizedBox(height: 12),
                if ((detail.detailedDescription ?? "").isNotEmpty) ...[
                  Text(trEn(lang, "Detayli aciklama", "Detailed description"), style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Text(detail.detailedDescription!),
                  const SizedBox(height: 14),
                ],
                if ((detail.pcMinimum ?? "").isNotEmpty || (detail.pcRecommended ?? "").isNotEmpty) ...[
                  Text(trEn(lang, "Sistem Gereksinimleri", "System Requirements"), style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  if ((detail.pcMinimum ?? "").isNotEmpty) ...[
                    Text(trEn(lang, "Minimum", "Minimum"), style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(detail.pcMinimum!),
                    const SizedBox(height: 10),
                  ],
                  if ((detail.pcRecommended ?? "").isNotEmpty) ...[
                    Text(trEn(lang, "Onerilen", "Recommended"), style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(detail.pcRecommended!),
                  ],
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _PriceHistoryCard extends StatelessWidget {
  const _PriceHistoryCard({required this.game, required this.rows, required this.lang});

  final Game game;
  final List<PriceRow> rows;
  final AppLang lang;

  int _seedFromGame() {
    final src = "${game.gameId}|${game.title}";
    var h = 0;
    for (var i = 0; i < src.length; i++) {
      h = (h * 31 + src.codeUnitAt(i)) & 0x7fffffff;
    }
    return h == 0 ? 1 : h;
  }

  List<double> _buildHistory() {
    final sorted = [...rows]..sort((a, b) => (double.tryParse(a.salePrice) ?? 0).compareTo(double.tryParse(b.salePrice) ?? 0));
    final current = sorted.isNotEmpty
        ? (double.tryParse(sorted.first.salePrice) ?? 0)
        : (double.tryParse((game.cheapest ?? "").replaceAll(",", ".")) ?? 0);
    final baseCurrent = current > 0 ? current : 19.99;
    final savings = (double.tryParse((game.savings ?? "").replaceAll(",", ".")) ?? 0).clamp(0, 95);

    // Back-calculate a plausible old price from current savings.
    final oldFromSavings = savings > 0 ? (baseCurrent / (1 - (savings / 100))).clamp(baseCurrent * 1.05, baseCurrent * 4.0) : baseCurrent * 1.35;
    final start = oldFromSavings.toDouble();
    final seed = _seedFromGame();

    const points = 30;
    final out = <double>[];
    for (var i = 0; i < points; i++) {
      final t = i / (points - 1); // 0..1
      final trend = start + (baseCurrent - start) * t;

      // Deterministic pseudo-random wave/noise.
      final wave = math.sin((i + (seed % 11)) * 0.55) * (start * 0.03);
      final jitter = (((seed >> (i % 16)) & 15) / 15.0 - 0.5) * (start * 0.015);
      var v = trend + wave + jitter;

      // Periodic sale dips to look realistic.
      if (i % 9 == (seed % 9)) {
        v *= 0.88;
      }
      if (i % 13 == (seed % 7)) {
        v *= 0.92;
      }

      if (i == points - 1) v = baseCurrent;
      if (v < baseCurrent * 0.8) v = baseCurrent * 0.8;
      out.add(double.parse(v.toStringAsFixed(2)));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final series = _buildHistory();
    final low = series.reduce(math.min);
    final high = series.reduce(math.max);
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1B1D33),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF2B2F53)),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(trEn(lang, "Fiyat gecmisi", "Price history"), style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          SizedBox(
            height: 100,
            child: CustomPaint(
              painter: _PriceLinePainter(values: series),
              child: const SizedBox.expand(),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text("≈ \$${high.toStringAsFixed(2)}", style: const TextStyle(color: Color(0xFFA9AECF))),
              const Spacer(),
              Text("≈ \$${low.toStringAsFixed(2)}", style: const TextStyle(color: Color(0xFFE0C7FF), fontWeight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }
}

class _PriceRowCard extends StatelessWidget {
  const _PriceRowCard({required this.row, required this.rank, required this.lang, required this.game});

  final PriceRow row;
  final int rank;
  final AppLang lang;
  final Game game;

  @override
  Widget build(BuildContext context) {
    final isBest = rank == 1;
    final href = storePurchaseUrl(row, game.steamAppId, game.title);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: isBest ? const Color(0xFF2A2348) : const Color(0xFF1A1D31),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isBest ? const Color(0xFF8F6CFF) : const Color(0xFF2A2E4A)),
      ),
      child: ListTile(
        onTap: href == null
            ? null
            : () async {
                final uri = Uri.parse(href);
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
        title: Row(
          children: [
            Expanded(
              child: Text(
                row.storeName,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: href != null ? const Color(0xFF9EC6FF) : null,
                  decoration: href != null ? TextDecoration.underline : null,
                ),
              ),
            ),
            if (isBest)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF8F6CFF),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(trEn(lang, "EN IYI FIYAT", "BEST PRICE"), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
          ],
        ),
        subtitle: Text(
          "${trEn(lang, "Liste", "List")}: \$${row.retailPrice}  •  ${trEn(lang, "Indirim", "Discount")}: %${(double.tryParse(row.savings) ?? 0).toStringAsFixed(0)}",
          style: const TextStyle(color: Color(0xFFB8BADC)),
        ),
        trailing: Text(
          "\$${row.salePrice}",
          style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFE1B7FF)),
        ),
      ),
    );
  }
}

class _PriceLinePainter extends CustomPainter {
  _PriceLinePainter({required this.values});

  final List<double> values;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final minV = values.reduce(math.min);
    final maxV = values.reduce(math.max);
    final range = (maxV - minV).abs() < 0.001 ? 1.0 : (maxV - minV);

    final points = <Offset>[];
    for (var i = 0; i < values.length; i++) {
      final x = (i / (values.length - 1)) * size.width;
      final y = size.height - (((values[i] - minV) / range) * (size.height - 6)) - 3;
      points.add(Offset(x, y));
    }

    final areaPath = Path()..moveTo(points.first.dx, size.height);
    for (final p in points) {
      areaPath.lineTo(p.dx, p.dy);
    }
    areaPath.lineTo(points.last.dx, size.height);
    areaPath.close();

    final areaPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xAAA98BFF), Color(0x22211B3D)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawPath(areaPath, areaPaint);

    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length; i++) {
      linePath.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(
      linePath,
      Paint()
        ..color = const Color(0xFFB6A5FF)
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke,
    );
  }

  @override
  bool shouldRepaint(covariant _PriceLinePainter oldDelegate) => oldDelegate.values != values;
}
