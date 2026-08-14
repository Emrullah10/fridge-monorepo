const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    merchantName: { type: ['string', 'null'] },
    purchasedAt: { type: ['string', 'null'] },
    totalAmount: { type: ['number', 'null'] },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rawText: { type: 'string' },
          parsedName: { type: 'string' },
          parsedQuantity: { type: 'number' },
          parsedUnit: { type: 'string', enum: ['piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package'] },
          parsedPrice: { type: ['number', 'null'] },
        },
        required: ['rawText', 'parsedName', 'parsedQuantity', 'parsedUnit'],
      },
    },
  },
  required: ['lineItems'],
};

const SYSTEM_PROMPT = `Sen bir Türk market fişini analiz eden bir asistansın.
Ham fiş metnindeki ürün satırlarını çıkar ve JSON şemasına uygun döndür.

KURALLAR:
1. MIKTAR UYDURMA. Satırda açıkça bir adet/miktar yazmıyorsa parsedQuantity = 1 yaz.
   Satır başında "2 X" veya "3 ADET" gibi bir çarpan varsa onu kullan.
2. BIRIM, ürün adındaki ölçüyle tutarlı olmalı:
   - "1LT", "2.5L" gibi hacim -> parsedUnit "liter", parsedQuantity = o sayı (1, 2.5)
   - "500G", "250 GR" gibi ağırlık -> parsedUnit "gram", parsedQuantity = o sayı (500, 250)
   - "1KG", "2 KG" -> parsedUnit "kilogram", parsedQuantity = o sayı
   - Sadece "KG" yazıyorsa (miktar belirsiz) -> parsedUnit "kilogram", parsedQuantity = 1
   - Ölçü yoksa -> parsedUnit "piece", parsedQuantity = 1
3. parsedName: kısaltmayı açık ve DOĞRU YAZILMIŞ Türkçe isme çevir.
   Örnek: "DMS SUT 1LT" -> "Süt", "EKMEK TAM BUGDAY" -> "Tam Buğday Ekmeği",
   "COCA COLA 2.5LT" -> "Coca-Cola". Ölçüyü isme tekrar ekleme, o zaten birimde var.
4. merchantName: fişin en üstündeki mağaza/market adını yaz (örn. "MIGROS TICARET A.S.").
5. Ürün OLMAYAN satırları atla: TOPLAM, TOPKDV, KDV, TARIH, SAAT, FIS NO, KASIYER,
   TESEKKURLER, ARA TOPLAM, NAKIT, KREDI KARTI gibi satırlar ürün değildir.
6. parsedPrice: satırdaki fiyat (virgül ondalık ayracıdır: "32,50" -> 32.50).

Sadece JSON döndür, açıklama ekleme.`;

// Satırdaki ölçüyü (500G, 1LT, 2.5L, 1KG) yakalar. Model bu kuralı promptta
// verilmesine rağmen tutarsız uyguluyordu ("500G" -> 1 gram gibi), envanterin
// doğruluğu buna bağlı olduğu için deterministik olarak burada düzeltiyoruz.
const MEASUREMENT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(KG|GR?|LT?|ML)\b/i;

const UNIT_BY_SUFFIX = {
  KG: 'kilogram',
  G: 'gram',
  GR: 'gram',
  L: 'liter',
  LT: 'liter',
  ML: 'milliliter',
};

const normalizeMeasurement = (item) => {
  const match = MEASUREMENT_PATTERN.exec(item.rawText ?? '');
  if (!match) return item;

  const amount = Number(match[1].replace(',', '.'));
  const unit = UNIT_BY_SUFFIX[match[2].toUpperCase()];
  if (!unit || !Number.isFinite(amount)) return item;

  // Satır başındaki çarpanı (örn. "2 X YUMURTA") koru: 2 paket x 500g.
  const multiplier = item.parsedQuantity > 1 && item.parsedUnit === 'piece' ? item.parsedQuantity : 1;

  return { ...item, parsedQuantity: amount * multiplier, parsedUnit: unit };
};

// Model toplam tutarı bazen atlıyor; fiş metninde açıkça yazdığı için
// yedek olarak buradan da okuyoruz.
const TOTAL_PATTERN = /^\s*(?:GENEL\s+)?TOPLAM\s*[:\s]\s*([\d.,]+)\s*$/im;

const extractTotalAmount = (rawText) => {
  const match = TOTAL_PATTERN.exec(rawText ?? '');
  if (!match) return null;
  const amount = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) ? amount : null;
};

// Kademe 2: ham metin -> yapılandırılmış satır kalemleri. Vision değil, metin modeli.
const makeOllamaTextParser = ({ baseUrl, model, fetchFn = fetch }) => {
  return {
    parse: async ({ rawText }) => {
      const response = await fetchFn(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          format: RESPONSE_SCHEMA,
          stream: false,
          // Fiş ayrıştırma yaratıcılık değil kural takibi istiyor; düşük
          // temperature modelin miktar/birim uydurmasını belirgin azaltıyor.
          options: { temperature: 0.1 },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: rawText },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }

      const body = await response.json();
      const parsed = JSON.parse(body.message.content);

      return {
        lineItems: parsed.lineItems.map((item, index) => ({
          lineNo: index + 1,
          ...normalizeMeasurement(item),
        })),
        merchantName: parsed.merchantName ?? null,
        purchasedAt: parsed.purchasedAt ?? null,
        totalAmount: parsed.totalAmount ?? extractTotalAmount(rawText),
        provider: 'ollama-text',
        model,
      };
    },
  };
};

export { makeOllamaTextParser, RESPONSE_SCHEMA };
