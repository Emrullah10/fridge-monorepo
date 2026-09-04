// Premium/deneme özelliği (bkz. plans.js features.export) — envanterin CSV
// dökümü. Route katmanı requirePlanFeature ile kapıyı zaten kapatıyor, bu
// use-case sadece veriyi hazırlar (hexagonal kısıt: karar route/middleware'de,
// I/O+dönüşüm burada).
const CSV_HEADER = ['Ürün', 'Marka', 'Miktar', 'Birim', 'Son Kullanma Tarihi', 'Not'];

// CSV alanı virgül/tırnak/satır sonu içeriyorsa RFC 4180 gereği tırnaklanır.
const escapeCsvField = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const toCsvRow = (fields) => fields.map(escapeCsvField).join(',');

const makeExportInventoryCsv = ({ inventoryItemRepo }) => {
  return async ({ householdId }) => {
    const items = await inventoryItemRepo.listByHousehold(householdId);
    const lines = [
      toCsvRow(CSV_HEADER),
      ...items.map((item) =>
        toCsvRow([
          item.productName ?? '',
          item.productBrand ?? '',
          item.quantity,
          item.unit,
          item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 10) : '',
          item.note ?? '',
        ]),
      ),
    ];
    // \r\n — Excel'in BOM'suz CSV'lerde satır sonu beklentisiyle uyumlu.
    return `﻿${lines.join('\r\n')}`;
  };
};

export { makeExportInventoryCsv };
