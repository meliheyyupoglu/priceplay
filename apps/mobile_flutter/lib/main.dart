import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "i18n/app_strings.dart";
import "screens/account_screen.dart";
import "screens/browse_screen.dart";
import "screens/favorites_screen.dart";
import "screens/home_screen.dart";
import "screens/search_screen.dart";
import "services/auth_service.dart";
import "services/cheapshark_api_service.dart";
import "state/app_state.dart";

void main() {
  runApp(const PricePlayMobileApp());
}

class PricePlayMobileApp extends StatelessWidget {
  const PricePlayMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState(CheapsharkApiService(), AuthService())..init(),
      child: MaterialApp(
        title: "PricePlay Mobile",
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          brightness: Brightness.dark,
          scaffoldBackgroundColor: const Color(0xFF0C0E1A),
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFF9D7CFF),
            secondary: Color(0xFFC49DFF),
            surface: Color(0xFF171A2E),
          ),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF101327),
            elevation: 0,
          ),
          cardTheme: CardThemeData(
            color: const Color(0xFF171A2E),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFF2A2E4A)),
            ),
          ),
        ),
        home: const MainScaffold(),
      ),
    );
  }
}

class MainScaffold extends StatefulWidget {
  const MainScaffold({super.key});

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  int index = 0;

  static const pages = [
    HomeScreen(),
    BrowseScreen(),
    SearchScreen(),
    FavoritesScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: const Text("PricePlay"),
        actions: [
          PopupMenuButton<AppLang>(
            initialValue: state.lang,
            onSelected: state.setLang,
            itemBuilder: (_) => const [
              PopupMenuItem(value: AppLang.tr, child: Text("Turkce")),
              PopupMenuItem(value: AppLang.en, child: Text("English")),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Center(
                child: Text(
                  state.lang == AppLang.tr ? "TR" : "EN",
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AccountScreen()),
            ),
          ),
        ],
      ),
      body: pages[index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (v) => setState(() => index = v),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home),
            label: trEn(state.lang, "Ana Sayfa", "Home"),
          ),
          NavigationDestination(
            icon: const Icon(Icons.grid_view_outlined),
            selectedIcon: const Icon(Icons.grid_view),
            label: trEn(state.lang, "Kategoriler", "Browse"),
          ),
          NavigationDestination(
            icon: const Icon(Icons.search_outlined),
            selectedIcon: const Icon(Icons.search),
            label: trEn(state.lang, "Ara", "Search"),
          ),
          NavigationDestination(
            icon: const Icon(Icons.star_outline),
            selectedIcon: const Icon(Icons.star),
            label: trEn(state.lang, "Favoriler", "Favorites"),
          ),
        ],
      ),
    );
  }
}
