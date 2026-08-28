/**
 * @typedef {Object} ReceiptLine
 * @property {string} id
 * @property {string} rawText
 * @property {string} parsedName
 * @property {string} [parsedBrand]
 * @property {number} quantity
 * @property {number} [unitPrice]
 * @property {'high'|'medium'|'low'} confidence
 * @property {import('./household').StorageKind|null} suggestedStorageKind
 * @property {number} [packSize]
 * @property {string} [packUnit]
 * @typedef {Object} Receipt
 * @property {string} id
 * @property {string} merchantName
 * @property {string} scannedAt
 * @property {string} rawText
 * @property {ReceiptLine[]} lines
 * @property {number} total
 */

/** @type {Receipt} */
export const receipt = {
  id: 'r-1',
  merchantName: 'MİGROS',
  scannedAt: new Date().toISOString(),
  rawText: `MİGROS TİCARET A.Ş.
KALENDER MAH. ŞUBESİ
-------------------------------
SUTAS SUT TAM YAG 1LT     42,90
DANONE YOGURT 900G        59,50
PINAR BEYAZ PEYNIR 500G   89,00
DOMATES KG        1,200   29,88
COCA COLA 6X200ML         44,90
BIRSAH YOGURT 500G        34,90
-------------------------------
TOPLAM                   301,08
KDV DAHİLDİR`,
  lines: [
    {
      id: 'rl-1',
      rawText: 'SUTAS SUT TAM YAG 1LT     42,90',
      parsedName: 'Tam Yağlı Süt',
      parsedBrand: 'Sütaş',
      quantity: 1,
      unitPrice: 42.9,
      confidence: 'high',
      suggestedStorageKind: 'fridge',
      packSize: 1,
      packUnit: 'lt',
    },
    {
      id: 'rl-2',
      rawText: 'DANONE YOGURT 900G        59,50',
      parsedName: 'Yoğurt',
      parsedBrand: 'Danone',
      quantity: 1,
      unitPrice: 59.5,
      confidence: 'high',
      suggestedStorageKind: 'fridge',
      packSize: 900,
      packUnit: 'g',
    },
    {
      id: 'rl-3',
      rawText: 'PINAR BEYAZ PEYNIR 500G   89,00',
      parsedName: 'Beyaz Peynir',
      parsedBrand: 'Pınar',
      quantity: 1,
      unitPrice: 89.0,
      confidence: 'high',
      suggestedStorageKind: 'fridge',
      packSize: 500,
      packUnit: 'g',
    },
    {
      id: 'rl-4',
      rawText: 'DOMATES KG        1,200   29,88',
      parsedName: 'Domates',
      quantity: 1.2,
      unitPrice: 24.9,
      confidence: 'medium',
      suggestedStorageKind: 'fridge',
      packSize: 1,
      packUnit: 'kg',
    },
    {
      // Çoklu paket örneği: "6X200ML" -> 6 adet x 200 ml
      id: 'rl-5',
      rawText: 'COCA COLA 6X200ML         44,90',
      parsedName: 'Kola',
      parsedBrand: 'Coca-Cola',
      quantity: 6,
      unitPrice: 7.48,
      confidence: 'high',
      suggestedStorageKind: 'pantry',
      packSize: 200,
      packUnit: 'ml',
    },
    {
      // Düşük güvenli / homoglif riski taşıyan marka örneği ("BIRSAH" -> tanınmıyor)
      id: 'rl-6',
      rawText: 'BIRSAH YOGURT 500G        34,90',
      parsedName: 'Yoğurt',
      parsedBrand: 'Birşah',
      quantity: 1,
      unitPrice: 34.9,
      confidence: 'low',
      suggestedStorageKind: null,
      packSize: 500,
      packUnit: 'g',
    },
  ],
  total: 301.08,
};
