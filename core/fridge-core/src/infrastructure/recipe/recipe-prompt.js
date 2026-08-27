// Dolaptaki malzemelerden tarif üretme prompt'u. Fiş ayrıştırmadaki
// SYSTEM_PROMPT'tan (line-item-finalizer.js) kasıtlı olarak FARKLI bir dosyada
// — o kural takibi istiyor, bu yaratıcılık istiyor; birlikte tutmak ikisini
// de zayıflatırdı.

const RECIPE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          servings: { type: 'number' },
          prepMinutes: { type: 'number' },
          cookMinutes: { type: 'number' },
          difficulty: { type: 'string', enum: ['kolay', 'orta', 'zor'] },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                order: { type: 'number' },
                text: { type: 'string' },
                minutes: { type: ['number', 'null'] },
              },
              required: ['order', 'text'],
            },
          },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string', enum: ['piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package'] },
                isOptional: { type: 'boolean' },
              },
              required: ['name', 'quantity', 'unit'],
            },
          },
          missingIngredients: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'description', 'steps', 'ingredients'],
      },
    },
  },
  required: ['recipes'],
};

const SYSTEM_PROMPT = `Sen kullanıcının buzdolabındaki malzemelerden Türkçe yemek
tarifleri üreten bir mutfak asistanısın. Amacın israfı önlemek: kullanıcının
zaten sahip olduğu malzemeleri değerlendirmesine yardım ediyorsun.

KURALLAR:
1. SADECE verilen malzeme listesini + şu temel mutfak zımnilerini kullan:
   tuz, karabiber, su, sıvı yağ/zeytinyağı, un, şeker. Başka bir malzeme
   gerekiyorsa onu ingredients'a EKLEME, missingIngredients dizisine ürün
   adı olarak yaz.
2. SON KULLANMA TARİHİ YAKLAŞAN malzemeler işaretli olarak gelecek
   ("(SKT yakın)") — bu malzemeleri ÖNCELİKLE kullanan tarifler üret. Bu en
   önemli kural: uygulamanın amacı israfı önlemek.
3. GİRDİ tarafında malzemeler "Marka — Ürün adı [kategori]" biçiminde
   gelebilir. Markayı ürünün NE OLDUĞUNU anlamak için kullan
   ("Kızılay Mango Ananas — Maden Suyu [beverages]" bir MADEN SUYUDUR,
   meyve suyu değildir). Ama ÇIKTIDA (ingredients[].name) marka YAZMA,
   yalın ürün adını yaz ("Süt", "Domates", "Maden Suyu").
4. quantity/unit tahminlerini gerçekçi tut; kesin bilmiyorsan makul bir
   porsiyon miktarı yaz, uydurma büyük sayılar verme.
5. steps: numaralı, kısa ve uygulanabilir adımlar. Her adımda ne yapılacağı
   net olsun ("Soğanı ince doğrayın ve orta ateşte pembeleşene kadar
   kavurun" gibi), tek kelimelik adım yazma.
6. 3 farklı tarif üret: mümkünse biri hızlı/kolay, biri orta, biri daha
   emek isteyen. Aynı ana malzemeyi tekrar tekrar kullanma, çeşitlilik ver.
7. tags: tarifin türünü tanımlayan 1-3 kısa Türkçe etiket (örn. "çorba",
   "vejetaryen", "hızlı", "kahvaltılık").
8. Bazı malzemeler "?" ile işaretli gelir — fişten okunmuş, adı kısaltılmış
   veya belirsiz olabilir. Bu malzemeleri tarifin ANA malzemesi yapma;
   yalnızca ne olduğundan eminsen ve yardımcı rolde kullan. Emin değilsen
   hiç kullanma. Asla tahmin ederek başka bir ürüne dönüştürme.
9. "İçecekler" başlığı altındaki malzemeler yalnızca sıvı/kabartıcı rolde
   kullanılabilir. Gazlı içecek, maden suyu, kola gibi ürünleri tatlı veya
   yemeğin lezzet çekirdeği yapma.`;

const buildIngredientLine = (item) => {
  const expiryFlag = item.expiresAt && new Date(item.expiresAt) - Date.now() < 4 * 24 * 60 * 60 * 1000
    ? ' (SKT yakın)'
    : '';
  const brandPart = item.brand ? `${item.brand} — ` : '';
  const categoryPart = item.categoryId ? ` [${item.categoryId}]` : ' [kategori bilinmiyor]';
  const uncertainFlag = item.isUncertain ? ' ?' : '';
  return `- ${brandPart}${item.name}: ${item.quantity} ${item.unit}${categoryPart}${expiryFlag}${uncertainFlag}`;
};

const buildUserPrompt = ({ ingredients, beverages = [], preferences = {} }) => {
  const ingredientLines = ingredients.map(buildIngredientLine);
  const beverageLines = beverages.map(buildIngredientLine);

  const preferenceLines = [];
  if (preferences.mealType) preferenceLines.push(`Öğün: ${preferences.mealType}`);
  if (preferences.maxMinutes) preferenceLines.push(`En fazla ${preferences.maxMinutes} dakikada hazırlanabilsin`);
  if (preferences.dietary) preferenceLines.push(`Diyet tercihi: ${preferences.dietary}`);
  // Hane üyelerinin diyet profillerinden birleşik kısıtlar (mergeDietConstraints).
  if (Array.isArray(preferences.diets) && preferences.diets.length > 0) {
    preferenceLines.push(`Hanedeki diyetler (hepsine uygun olmalı): ${preferences.diets.join(', ')}`);
  }
  if (Array.isArray(preferences.allergens) && preferences.allergens.length > 0) {
    preferenceLines.push(`ALERJENLER — bu malzemeleri KESİNLİKLE kullanma: ${preferences.allergens.join(', ')}`);
  }

  return [
    'Dolaptaki malzemeler:',
    ...ingredientLines,
    ...(beverageLines.length > 0 ? ['', 'İçecekler (yalnızca sıvı/kabartıcı rolde):', ...beverageLines] : []),
    ...(preferenceLines.length > 0 ? ['', 'Tercihler:', ...preferenceLines] : []),
  ].join('\n');
};

export { RECIPE_RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserPrompt };
