enum AppLang { tr, en }

String trEn(AppLang lang, String tr, String en) {
  return lang == AppLang.tr ? tr : en;
}
