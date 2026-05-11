const List<String> _labels = <String>[
  "Action",
  "Indie",
  "RPG",
  "Strategy",
  "Adventure",
  "Shooter",
  "Simulation",
  "Sports",
  "Racing",
];

String genreLabelFor(String title) {
  var h = 0;
  for (var i = 0; i < title.length; i++) {
    h = 0x1fffffff & (h + title.codeUnitAt(i));
    h = 0x1fffffff & (h + ((0x0007ffff & h) << 10));
    h ^= h >> 6;
  }
  h = 0x1fffffff & (h + ((0x03ffffff & h) << 3));
  h ^= h >> 11;
  h = 0x1fffffff & (h + ((0x00003fff & h) << 15));
  h ^= h >> 10;
  h = (h).abs();
  return _labels[h % _labels.length];
}

const List<String> browseCategories = <String>[
  "Action",
  "Adventure",
  "RPG",
  "Strategy",
  "Shooter",
  "Indie",
  "Simulation",
  "Sports",
  "Racing",
];

String categoryLabelTr(String key) {
  switch (key) {
    case "Action":
      return "Aksiyon";
    case "Adventure":
      return "Macera";
    case "RPG":
      return "Rol Yapma (RPG)";
    case "Strategy":
      return "Strateji";
    case "Shooter":
      return "Nisanci";
    case "Indie":
      return "Bagimsiz";
    case "Simulation":
      return "Simulasyon";
    case "Sports":
      return "Spor";
    case "Racing":
      return "Yaris";
    default:
      return key;
  }
}
