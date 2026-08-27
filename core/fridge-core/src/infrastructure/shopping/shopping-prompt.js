// Alışveriş listesi AI önerileri için iki bağımsız prompt: biri tüketim
// ritmi istatistiklerinden ("normalde 7 günde bir alıyorsun, 11 gün oldu"),
// biri serbest metinden ("bu hafta 4 kişilik kahvaltılık lazım"). Aynı
// dosyada tutuluyor çünkü aynı SHOPPING_RESPONSE_SCHEMA'yı paylaşıyorlar —
// recipe-prompt.js'ten kasıtlı olarak ayrı (o dosyanın yorumu da aynı
// gerekçeyi anlatıyor: farklı görevleri birlikte tutmak ikisini de zayıflatır).

const SHOPPING_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: ['string', 'null'] },
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string', enum: ['piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package'] },
          reason: { type: 'string', enum: ['due_soon', 'ran_out', 'complementary', 'user_request'] },
          reasonText: { type: 'string' },
          confidence: { type: ['number', 'null'] },
        },
        required: ['name', 'quantity', 'unit', 'reason', 'reasonText'],
      },
    },
  },
  required: ['suggestions'],
};

const RHYTHM_SYSTEM_PROMPT = `Sen kullanıcının alışveriş listesine tüketim
alışkanlıklarına dayanan öneriler sunan bir asistansın.

KURALLAR:
1. Verilen tüketim istatistiklerine dayan, UYDURMA. Listede olmayan bir
   ürünü ancak "complementary" gerekçesiyle ve en fazla 2 tane öner.
2. productId verilen ürünler için AYNEN o id'yi geri döndür; yeni ürün
   öneriyorsan productId: null.
3. En fazla 8 öneri. Öncelik: daysSinceLast, avgIntervalDays'i aştıkça artan
   gecikme oranına sahip ürünler.
4. quantity için evin geçmiş tüketim büyüklüğünü kullan
   (totalConsumed / eventCount).
5. reasonText: kullanıcıya gösterilecek tek cümlelik Türkçe gerekçe
   ("Normalde 7 günde bir alıyorsun, 11 gün oldu").
6. cleaning/personal_care kategorileri de geçerlidir — burası tarif değil,
   alışveriş listesi, hiçbir kategori elenmez.

Sadece JSON döndür, açıklama ekleme.`;

const buildRhythmIngredientLine = (item) => {
  const brandPart = item.brand ? `${item.brand} ` : '';
  const categoryPart = item.categoryId ? ` [${item.categoryId}]` : '';
  const avgPart = item.avgIntervalDays != null
    ? `, ortalama ${Math.round(item.avgIntervalDays)} günde bir`
    : '';
  return `- ${brandPart}${item.name}${categoryPart}: elde ${item.onHand} ${item.unit}, `
    + `son 120 günde ${item.eventCount} kez toplam ${item.totalConsumed} ${item.unit}${avgPart}, `
    + `son tüketim ${Math.round(item.daysSinceLast)} gün önce`;
};

const buildRhythmUserPrompt = ({ profile }) => {
  return [
    'Tüketim geçmişi:',
    ...profile.map(buildRhythmIngredientLine),
  ].join('\n');
};

const TEXT_SYSTEM_PROMPT = `Sen kullanıcının serbest metinle yazdığı bir
alışveriş isteğini somut ürün listesine çeviren bir asistansın.

KURALLAR:
1. Kullanıcının isteğini gerçekçi bir alışveriş listesine çevir. Miktar
   tahminlerini makul tut, uydurma büyük sayılar verme.
2. Verilen "Dolapta zaten var" listesindeki ürünleri TEKRAR ÖNERME — kullanıcı
   zaten sahip.
3. En fazla 10 öneri.
4. reason her zaman "user_request" olsun.
5. reasonText: kullanıcının isteğiyle bu ürünün ilişkisini tek cümlede
   açıkla ("Kahvaltı için temel bir malzeme").
6. productId her zaman null (bu istek yeni ürünler için, mevcut ürün
   eşleştirmesi sunucu tarafında yapılır).

Sadece JSON döndür, açıklama ekleme.`;

const buildTextUserPrompt = ({ text, inventorySummary = [] }) => {
  const lines = [`İstek: ${text}`];
  if (inventorySummary.length > 0) {
    lines.push('', 'Dolapta zaten var:', ...inventorySummary.map((item) => `- ${item.name}`));
  }
  return lines.join('\n');
};

export {
  SHOPPING_RESPONSE_SCHEMA,
  RHYTHM_SYSTEM_PROMPT,
  buildRhythmUserPrompt,
  TEXT_SYSTEM_PROMPT,
  buildTextUserPrompt,
};
