// Küçük adaptör: ReceiptLine -> InventoryItem şekli. MockProductCard hiç
// değişmez (CLAUDE.md kural #3: maketler seed'den beslenir, kendi içinde veri
// barındırmaz) — bu adaptör sadece Bölüm 2/3'ün fiş satırlarını mevcut karta
// uydurur (bkz. plan "Bölüm 2 — Yapay zekâ ayrıştırır").

/**
 * @param {import('@seed/receipt').ReceiptLine} line
 * @returns {import('@seed/inventory').InventoryItem}
 */
export function receiptLineToInventoryItem(line) {
  return {
    id: line.id,
    product: {
      id: `product-${line.id}`,
      name: line.parsedName,
      brand: line.parsedBrand,
    },
    storageLocationId: line.suggestedStorageKind ? `sl-${line.suggestedStorageKind}` : null,
    quantity: line.quantity,
    unit: line.packUnit || 'adet',
    expiryStatus: 'none',
    isFinished: false,
    unitPrice: line.unitPrice,
  };
}

/**
 * @param {import('@seed/receipt').ReceiptLine[]} lines
 * @returns {import('@seed/inventory').InventoryItem[]}
 */
export function receiptLinesToInventoryItems(lines) {
  return lines.map(receiptLineToInventoryItem);
}
