// AI Chef sohbeti prompt'u. Tarif üretiminden (recipe-prompt.js) ayrı: bu bir
// diyalog, tek seferlik yapılandırılmış üretim değil. Yine de yapılandırılmış
// çıktı istiyoruz (reply + suggestedShoppingItems) çünkü öneri çipleri
// deterministik ele alınmalı.

const CHEF_RESPONSE_SCHEMA = {
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
          unit: { type: ['string', 'null'], enum: ['piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package'] },
          reasonText: { type: 'string' },
        },
        required: ['name', 'reasonText'],
      },
    },
  },
  required: ['reply'],
};

const SYSTEM_PROMPT = `Sen kullanıcının mutfağını bilen bir Türkçe yemek asistanısın.
Kullanıcının buzdolabındaki/kilerindeki ürünleri, son kullanma tarihi yaklaşanları,
alışveriş listesini ve son pişirdiklerini biliyorsun.

GÖREVİN:
- Kullanıcının sorularına kısa, pratik, sıcak bir dille cevap ver.
- "Ne pişirebilirim?" gibi sorularda ÖNCE elindeki malzemeleri, ÖZELLİKLE son
  kullanma tarihi yaklaşanları değerlendir — amacın israfı önlemek.
- Tarif verirken adımları numaralı ve net yaz. Süre gerektiren adımlarda dakikayı belirt.
- Kullanıcı bir şey sormadıkça uzun teorik anlatıma girme.

KISITLAR:
1. Temizlik ürünleri, kişisel bakım ürünleri yemek malzemesi DEĞİLDİR — bunları
   tarife katma.
2. Elinde olmayan bir malzemeyi "bunu da alman gerekebilir" diye önerebilirsin ama
   bunu 'suggestedShoppingItems' dizisine koy — cevabın içinde "listene ekledim"
   DEME, ekleme yetkisi kullanıcıda.
3. Uydurma marka/ürün adı verme. Elindeki ürünlerin adını kullan.
4. Emin değilsen tahmin etme, kullanıcıya sor.

Cevabını 'reply' alanına yaz. Bir şey almasını önereceksen 'suggestedShoppingItems'
doldur, yoksa boş dizi bırak.`;

const fmtDate = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

const buildKitchenContext = (kitchen) => {
  const lines = [];

  if (kitchen.expiringSoon?.length) {
    lines.push('SON KULLANMA TARİHİ YAKLAŞANLAR (önce bunları değerlendir):');
    for (const it of kitchen.expiringSoon) {
      lines.push(`- ${it.name} (SKT: ${fmtDate(it.expiresAt) ?? '?'}, ${it.daysLeft} gün kaldı)`);
    }
    lines.push('');
  }

  lines.push('DOLAP / KİLER:');
  if (kitchen.inventory?.length) {
    for (const it of kitchen.inventory) {
      const brand = it.brand ? `${it.brand} ` : '';
      const exp = it.expiresAt ? `, SKT ${fmtDate(it.expiresAt)}` : '';
      lines.push(`- ${brand}${it.name}: ${it.quantity} ${it.unit}${exp}`);
    }
  } else {
    lines.push('(boş)');
  }
  lines.push('');

  if (kitchen.shoppingList?.length) {
    lines.push('ALIŞVERİŞ LİSTESİNDE ZATEN OLANLAR:');
    lines.push(kitchen.shoppingList.map((s) => s.name).join(', '));
    lines.push('');
  }

  if (kitchen.recentlyCooked?.length) {
    lines.push('SON PİŞİRİLENLER:');
    lines.push(kitchen.recentlyCooked.map((r) => r.title).join(', '));
    lines.push('');
  }

  if (kitchen.diet) {
    if (kitchen.diet.allergens?.length) {
      lines.push(`ALERJENLER — bu malzemeleri ÖNERME/KULLANMA: ${kitchen.diet.allergens.join(', ')}`);
    }
    if (kitchen.diet.diets?.length) {
      lines.push(`HANEDEKİ DİYETLER (hepsine uygun ol): ${kitchen.diet.diets.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
};

export { CHEF_RESPONSE_SCHEMA, SYSTEM_PROMPT, buildKitchenContext };
