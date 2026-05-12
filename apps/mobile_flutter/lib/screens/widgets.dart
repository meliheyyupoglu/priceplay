import "package:flutter/material.dart";

import "../models/game.dart";
import "../state/app_state.dart";

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.trailing,
  });

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w700,
                color: Color(0xFFF2EDFF),
              ),
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

class PageHero extends StatelessWidget {
  const PageHero({
    super.key,
    required this.title,
    this.subtitle,
  });

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2A2250), Color(0xFF171A2E)],
        ),
        border: Border.all(color: const Color(0xFF3B3266)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          if ((subtitle ?? "").isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(subtitle!, style: const TextStyle(color: Color(0xFFC2C7E9))),
          ],
        ],
      ),
    );
  }
}

class GameStripCard extends StatelessWidget {
  const GameStripCard({
    super.key,
    required this.game,
    required this.onTap,
    this.hero = false,
  });

  final Game game;
  final VoidCallback onTap;
  final bool hero;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: hero ? double.infinity : 240,
        margin: const EdgeInsets.only(right: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF252041), Color(0xFF171A2E)],
          ),
          border: Border.all(color: const Color(0xFF3D3568)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              child: game.thumb != null
                  ? Image.network(
                      game.thumb!,
                      height: hero ? 160 : 120,
                      width: double.infinity,
                      fit: BoxFit.cover,
                    )
                  : Container(
                      height: hero ? 160 : 120,
                      width: double.infinity,
                      color: const Color(0xFF252540),
                      alignment: Alignment.center,
                      child: const Icon(Icons.image_not_supported_outlined),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Text(
                game.title,
                maxLines: hero ? 2 : 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
              child: _PriceMeta(game: game, compact: !hero),
            ),
          ],
        ),
      ),
    );
  }
}

class GameTile extends StatelessWidget {
  const GameTile({
    super.key,
    required this.game,
    required this.onTap,
    required this.isFavorite,
    required this.onFavoriteToggle,
    this.onAlertTap,
  });

  final Game game;
  final VoidCallback onTap;
  final bool isFavorite;
  final VoidCallback onFavoriteToggle;
  final VoidCallback? onAlertTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF171A2E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2F3557)),
      ),
      child: ListTile(
        onTap: onTap,
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: game.thumb != null ? Image.network(game.thumb!, width: 72, height: 40, fit: BoxFit.cover) : const SizedBox(width: 72),
        ),
        title: Text(game.title, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: _PriceMeta(game: game),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isFavorite && onAlertTap != null)
              IconButton(
                icon: const Icon(Icons.notifications_active_outlined, color: Color(0xFF9EC6FF)),
                onPressed: onAlertTap,
              ),
            IconButton(
              icon: Icon(isFavorite ? Icons.star : Icons.star_border, color: const Color(0xFFE1C1FF)),
              onPressed: onFavoriteToggle,
            ),
          ],
        ),
      ),
    );
  }
}

class _PriceMeta extends StatelessWidget {
  const _PriceMeta({required this.game, this.compact = false});

  final Game game;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final pct = (double.tryParse(game.savings ?? "0") ?? 0).round();
    final epicLabel = game.promoSource == "epic" && pct >= 95;
    final price = game.cheapest == null || game.cheapest!.trim().isEmpty ? "-" : "\$${game.cheapest}";
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 4,
      children: [
        if (pct > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFF6C4BE7),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              epicLabel ? "Epic — -$pct%" : "-$pct%",
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
            ),
          ),
        Text(price, style: const TextStyle(color: Color(0xFF7EE8BE), fontWeight: FontWeight.w700)),
        if (!compact) const Text("En ucuz teklif", style: TextStyle(color: Color(0xFFBFC4E6), fontSize: 12)),
      ],
    );
  }
}

Future<void> showPriceAlertEditor(
  BuildContext context, {
  required AppState state,
  required Game game,
}) async {
  final current = double.tryParse((game.cheapest ?? "").replaceAll(",", ".")) ?? 0;
  final currentTarget = state.alertTargetFor(game).clamp(0, current).toDouble();
  final controller = TextEditingController(text: currentTarget.toStringAsFixed(2));
  var enabled = state.alertEnabledFor(game);

  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: const Color(0xFF171A2E),
      title: const Text("Fiyat alarmi"),
      content: StatefulBuilder(
        builder: (context, setLocal) => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(game.title, maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 6),
            Text("Mevcut en dusuk fiyat: \$${current.toStringAsFixed(2)}"),
            const SizedBox(height: 8),
            TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: "Hedef fiyat",
                hintText: "Orn: 9.99",
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: enabled,
              onChanged: (v) => setLocal(() => enabled = v),
              title: const Text("Alarm aktif"),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Iptal")),
        FilledButton(
          onPressed: () {
            final v = double.tryParse(controller.text.replaceAll(",", ".")) ?? current;
            state.setAlertTarget(game, v);
            state.setAlertEnabled(game, enabled);
            Navigator.pop(ctx);
          },
          child: const Text("Kaydet"),
        ),
      ],
    ),
  );
}
