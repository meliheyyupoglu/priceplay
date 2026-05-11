class User {
  const User({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.nickname,
    required this.email,
    required this.phone,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String nickname;
  final String email;
  final String phone;
  final String? createdAt;
  final String? updatedAt;

  factory User.fromJson(Map<String, dynamic> raw) {
    return User(
      id: (raw["id"] ?? "").toString(),
      firstName: (raw["firstName"] ?? "").toString(),
      lastName: (raw["lastName"] ?? "").toString(),
      nickname: (raw["nickname"] ?? "").toString(),
      email: (raw["email"] ?? "").toString(),
      phone: (raw["phone"] ?? "").toString(),
      createdAt: raw["createdAt"]?.toString(),
      updatedAt: raw["updatedAt"]?.toString(),
    );
  }
}
