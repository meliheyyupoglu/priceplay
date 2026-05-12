class PriceRow {
  const PriceRow({
    required this.storeId,
    required this.storeName,
    required this.salePrice,
    required this.retailPrice,
    required this.savings,
    required this.dealId,
    this.purchaseUrl,
  });

  final String storeId;
  final String storeName;
  final String salePrice;
  final String retailPrice;
  final String savings;
  final String dealId;
  final String? purchaseUrl;
}
