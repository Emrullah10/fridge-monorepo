// AI Asistan prompt'u — chef-prompt.js'in genellemesi (bkz. plan §B).
// Mod başına AYRI prompt YOK: tek system prompt + mod bloğu. Ayrı olursa
// model diğer modların varlığını bilmez, modeMismatch üretemez.

const KIND_LABELS = {
  home: 'ev',
  office: 'ofis',
  summerhouse: 'yazlık',
  cottage: 'dağ evi / bağ evi',
  workshop: 'atölye',
  shop: 'dükkan',
  dorm: 'yurt',
  garage: 'garaj',
  boat: 'tekne',
  other: 'alan',
};

const ASSISTANT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    suggestedShoppingItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'], enum: ['piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package', 'meter', 'centimeter', 'square_meter'] },
          reasonText: { type: 'string' },
        },
        required: ['name', 'reasonText'],
      },
    },
    conversationTitle: { type: ['string', 'null'] },
    modeMismatch: { type: ['string', 'null'], enum: ['food', 'repair', 'general', null] },
    guide: {
      type: ['object', 'null'],
      properties: {
        kind: { type: 'string', enum: ['food', 'task'] },
        title: { type: 'string' },
        servings: { type: ['number', 'null'] },
        prepMinutes: { type: ['number', 'null'] },
        cookMinutes: { type: ['number', 'null'] },
        materials: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: ['number', 'null'] },
              unit: { type: ['string', 'null'] },
              isOptional: { type: ['boolean', 'null'] },
            },
            required: ['name'],
          },
        },
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
      },
      required: ['kind', 'title', 'materials', 'steps'],
    },
  },
  required: ['reply'],
};

const BASE_PROMPT = `Sen kullanıcının bir alanını (ev, atölye, dükkan, tekne vb.) bilen Türkçe
bir AI asistanısın. Kullanıcı üç tür konuda yardım isteyebilir: YEMEK, TAMİR/BAKIM,
ya da GENEL sohbet. Aktif mod aşağıda belirtilir, ama kullanıcının sorusu
başka bir konuya aitse KENDİ ANLAYIŞINI kullan.

MOD UYUMU KURALI: Soru seçili moda ait değilse cevabı YİNE DE VER — asla
engelleme. Ama gerçek konuyu tespit ettiysen 'modeMismatch' alanına o modu
yaz ('food' | 'repair' | 'general'). Soru seçili modla uyumluysa 'modeMismatch'
alanını null bırak.

BAŞLIK: Bu sohbetin ilk mesajıysa (geçmiş boşsa), kısa bir başlık üret ve
'conversationTitle' alanına yaz (en fazla 40 karakter, konuşma diliyle,
tırnak kullanma). Sohbet devam ediyorsa 'conversationTitle' alanını null bırak.

KILAVUZ: Kullanıcı adım adım bir tarif/kılavuz istiyorsa 'guide' alanını
doldur ('reply' kısa bir giriş olsun, adımları 'reply' içinde TEKRARLAMA).
Sadece sohbet ediyorsan 'guide' alanını null bırak. 'guide.kind' aktif
konuya göre 'food' (yemek tarifi) veya 'task' (tamir/bakım/genel görev)
olmalı.

Elinde olmayan bir malzeme/parça öner ebilirsen 'suggestedShoppingItems'
dizisine koy — cevabın içinde "listene ekledim" DEME, ekleme yetkisi
kullanıcıda. Uydurma marka/ürün adı verme, elindeki eşyaların adını kullan.
Emin değilsen tahmin etme, kullanıcıya sor.`;

const MODE_BLOCKS = {
  food: `AKTİF MOD: YEMEK
Kullanıcının buzdolabındaki/kilerindeki ürünleri, son kullanma tarihi
yaklaşanları, alışveriş listesini ve son pişirdiklerini biliyorsun.
- "Ne pişirebilirim?" gibi sorularda ÖNCE elindeki malzemeleri, ÖZELLİKLE
  son kullanma tarihi yaklaşanları değerlendir — amacın israfı önlemek.
- Tarif verirken adımları numaralı ve net yaz. Süre gerektiren adımlarda
  dakikayı belirt.
- Temizlik ürünleri, kişisel bakım ürünleri yemek malzemesi DEĞİLDİR —
  bunları tarife katma.`,
  repair: `AKTİF MOD: TAMİR/BAKIM
Kullanıcının alanındaki eşyaları/malzemeleri/aletleri biliyorsun (varsa).
- Tamir/bakım/kurulum sorularında adım adım, güvenlik uyarılarıyla birlikte
  net talimat ver.
- Elindeki malzeme/aletleri değerlendir, eksik olanı 'suggestedShoppingItems'
  ile öner.
- Elektrik/gaz/yapısal işlerde riskliyse kullanıcıyı uyar, gerekirse usta
  çağırmasını öner.`,
  general: `AKTİF MOD: GENEL
Serbest sohbet modundasın. Kullanıcı ne sorarsa kısa, pratik, sıcak bir
dille cevap ver. Elindeki alan bilgisini (varsa) bağlam olarak kullan.`,
};

// Alansız durumda AI envanteri hiç görmez — bunu prompt'a açıkça yazmak
// gerekir, aksi halde model "dolabında X var" gibi cümleler kurabilir.
const NO_AREA_NOTE = `Bu sohbette bir alana (ev/atölye/vb.) erişimin YOK. "Dolabında X var",
"elinde Y var" gibi cümleler KURMA — bir şeyin olup olmadığından emin
değilsen kullanıcıya sor.`;

const buildSystemPrompt = ({ mode = 'general', hasHousehold = false, foodEnabled = true }) => {
  const modeBlock = MODE_BLOCKS[mode] ?? MODE_BLOCKS.general;
  const parts = [BASE_PROMPT, modeBlock];
  if (!hasHousehold) {
    parts.push(NO_AREA_NOTE);
  } else if (!foodEnabled && mode === 'food') {
    // Food kapalı bir alanda mod yine de 'food' seçilmiş olabilir (kullanıcı
    // elle değiştirmiş) — envanter bloğu zaten yemek dışı etiketlerle gelir
    // (buildAreaContext), burada ek bir şey söylemeye gerek yok.
  }
  return parts.join('\n\n');
};

const fmtDate = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

// buildKitchenContext -> buildAreaContext (bkz. plan §B2). area:null ise bu
// fonksiyon hiç çağrılmaz (use-case seviyesinde atlanır).
const buildAreaContext = ({ area, areaName = null, areaKind = null, foodEnabled = true }) => {
  const lines = [];

  if (areaName) {
    const label = KIND_LABELS[areaKind] ?? KIND_LABELS.other;
    lines.push(`ALAN: ${areaName} (${label})`);
    lines.push('');
  }

  if (foodEnabled && area.expiringSoon?.length) {
    lines.push('SKT YAKLAŞANLAR (önce bunları değerlendir):');
    for (const it of area.expiringSoon) {
      lines.push(`- ${it.name} (SKT: ${fmtDate(it.expiresAt) ?? '?'}, ${it.daysLeft} gün kaldı)`);
    }
    lines.push('');
  } else if (!foodEnabled && area.expiringSoon?.length) {
    lines.push('TARİHİ YAKLAŞANLAR:');
    for (const it of area.expiringSoon) {
      lines.push(`- ${it.name} (tarih: ${fmtDate(it.expiresAt) ?? '?'}, ${it.daysLeft} gün kaldı)`);
    }
    lines.push('');
  }

  lines.push(foodEnabled ? 'DOLAP / KİLER:' : 'ALANDAKİ EŞYALAR:');
  if (area.inventory?.length) {
    for (const it of area.inventory) {
      const brand = it.brand ? `${it.brand} ` : '';
      const exp = it.expiresAt ? `, tarih ${fmtDate(it.expiresAt)}` : '';
      lines.push(`- ${brand}${it.name}: ${it.quantity} ${it.unit}${exp}`);
    }
  } else {
    lines.push('(boş)');
  }
  lines.push('');

  if (area.shoppingList?.length) {
    lines.push('ALIŞVERİŞ LİSTESİNDE ZATEN OLANLAR:');
    lines.push(area.shoppingList.map((s) => s.name).join(', '));
    lines.push('');
  }

  if (foodEnabled && area.recentlyCooked?.length) {
    lines.push('SON PİŞİRİLENLER:');
    lines.push(area.recentlyCooked.map((r) => r.title).join(', '));
    lines.push('');
  }

  if (foodEnabled && area.diet) {
    if (area.diet.allergens?.length) {
      lines.push(`ALERJENLER — bu malzemeleri ÖNERME/KULLANMA: ${area.diet.allergens.join(', ')}`);
    }
    if (area.diet.diets?.length) {
      lines.push(`HANEDEKİ DİYETLER (hepsine uygun ol): ${area.diet.diets.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
};

export { ASSISTANT_RESPONSE_SCHEMA, BASE_PROMPT, MODE_BLOCKS, buildSystemPrompt, buildAreaContext, KIND_LABELS };
