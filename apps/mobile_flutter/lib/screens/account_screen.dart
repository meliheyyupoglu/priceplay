import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../i18n/app_strings.dart";
import "../state/app_state.dart";
import "widgets.dart";

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  bool loginMode = true;
  bool busy = false;
  String? errorText;

  final idController = TextEditingController();
  final passController = TextEditingController();

  final firstController = TextEditingController();
  final lastController = TextEditingController();
  final nickController = TextEditingController();
  final emailController = TextEditingController();
  final phoneController = TextEditingController();
  final regPassController = TextEditingController();

  @override
  void dispose() {
    idController.dispose();
    passController.dispose();
    firstController.dispose();
    lastController.dispose();
    nickController.dispose();
    emailController.dispose();
    phoneController.dispose();
    regPassController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final lang = app.lang;
    final loggedIn = app.isAuthenticated;
    final u = app.authUser;
    if (loggedIn && u != null && firstController.text.isEmpty && lastController.text.isEmpty) {
      firstController.text = u.firstName;
      lastController.text = u.lastName;
      nickController.text = u.nickname;
      emailController.text = u.email;
      phoneController.text = u.phone;
    }
    return Scaffold(
      appBar: AppBar(title: Text(trEn(lang, "Profil", "Profile"))),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          PageHero(
            title: trEn(lang, "Hesabim", "My Account"),
          ),
          const SizedBox(height: 12),
          if (errorText != null) ...[
            Text(errorText!, style: const TextStyle(color: Colors.redAccent)),
            const SizedBox(height: 8),
          ],
          if (!loggedIn) ...[
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    selected: loginMode,
                    label: Text(trEn(lang, "Giris", "Login")),
                    onSelected: (_) => setState(() => loginMode = true),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    selected: !loginMode,
                    label: Text(trEn(lang, "Kayit", "Register")),
                    onSelected: (_) => setState(() => loginMode = false),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (loginMode) ...[
              TextField(
                controller: idController,
                decoration: InputDecoration(
                  labelText: trEn(lang, "E-posta veya kullanici adi", "Email or username"),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: passController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: trEn(lang, "Sifre", "Password"),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        setState(() {
                          busy = true;
                          errorText = null;
                        });
                        try {
                          await app.login(
                            identifier: idController.text.trim(),
                            password: passController.text,
                          );
                        } catch (e) {
                          setState(() => errorText = e.toString().replaceFirst("Exception: ", ""));
                        } finally {
                          if (mounted) setState(() => busy = false);
                        }
                      },
                child: Text(busy ? trEn(lang, "Baglaniyor...", "Connecting...") : trEn(lang, "Giris yap", "Login")),
              ),
            ] else ...[
              TextField(controller: firstController, decoration: InputDecoration(labelText: trEn(lang, "Ad", "First name"), border: const OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: lastController, decoration: InputDecoration(labelText: trEn(lang, "Soyad", "Last name"), border: const OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: nickController, decoration: InputDecoration(labelText: trEn(lang, "Kullanici adi", "Nickname"), border: const OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: emailController, decoration: InputDecoration(labelText: trEn(lang, "E-posta", "Email"), border: const OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: phoneController, decoration: InputDecoration(labelText: trEn(lang, "Telefon", "Phone"), border: const OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: regPassController, obscureText: true, decoration: InputDecoration(labelText: trEn(lang, "Sifre", "Password"), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        setState(() {
                          busy = true;
                          errorText = null;
                        });
                        try {
                          await app.register(
                            firstName: firstController.text.trim(),
                            lastName: lastController.text.trim(),
                            nickname: nickController.text.trim(),
                            email: emailController.text.trim(),
                            phone: phoneController.text.trim(),
                            password: regPassController.text,
                          );
                        } catch (e) {
                          setState(() => errorText = e.toString().replaceFirst("Exception: ", ""));
                        } finally {
                          if (mounted) setState(() => busy = false);
                        }
                      },
                child: Text(busy ? trEn(lang, "Baglaniyor...", "Connecting...") : trEn(lang, "Kayit ol", "Register")),
              ),
            ],
          ] else ...[
            TextField(controller: firstController, decoration: InputDecoration(labelText: trEn(lang, "Ad", "First name"), border: const OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: lastController, decoration: InputDecoration(labelText: trEn(lang, "Soyad", "Last name"), border: const OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: nickController, decoration: InputDecoration(labelText: trEn(lang, "Kullanici adi", "Nickname"), border: const OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: phoneController, decoration: InputDecoration(labelText: trEn(lang, "Telefon", "Phone"), border: const OutlineInputBorder())),
            const SizedBox(height: 10),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      final messenger = ScaffoldMessenger.of(context);
                      setState(() {
                        busy = true;
                        errorText = null;
                      });
                      try {
                        await app.updateProfile(
                          firstName: firstController.text.trim(),
                          lastName: lastController.text.trim(),
                          nickname: nickController.text.trim(),
                          phone: phoneController.text.trim(),
                        );
                        if (!mounted) return;
                        messenger.showSnackBar(
                          SnackBar(content: Text(trEn(lang, "Profil guncellendi.", "Profile updated."))),
                        );
                      } catch (e) {
                        setState(() => errorText = e.toString().replaceFirst("Exception: ", ""));
                      } finally {
                        if (mounted) setState(() => busy = false);
                      }
                    },
              child: Text(busy ? trEn(lang, "Kaydediliyor...", "Saving...") : trEn(lang, "Kaydet", "Save")),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () async => app.signOut(),
              child: Text(trEn(lang, "Cikis yap", "Sign out")),
            ),
          ],
        ],
      ),
    );
  }
}
