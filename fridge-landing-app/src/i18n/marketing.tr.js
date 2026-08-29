// Elle yazılan pazarlama metinleri (TR). App string'leri app-strings.tr.ts'te (otomatik üretilir).
export const marketing = {
  nav: {
    features: 'Özellikler',
    screens: 'Ekranlar',
    howItWorks: 'Nasıl Çalışır',
    metrics: 'Metrikler',
    faq: 'SSS',
    download: 'İndir',
  },
  hero: {
    eyebrow: 'Mutfağın dijital defteri',
    title: 'Fişi tara, gerisini Fridge halletsin.',
    subtitle:
      'Market fişinin fotoğrafını çek — ürünler fiyatlarıyla envanterine düşsün. Buzdolabı, dondurucu, kiler; ne kadar biriktirdiğini, ne kadar israf ettiğini ay ay gör.',
    ctaPrimary: 'Ücretsiz indir',
    ctaSecondary: 'Ekranları gör',
  },
  footer: {
    tagline: 'Evin mutfak envanterini paylaşımlı tutan uygulama.',
    rights: 'Tüm hakları saklıdır.',
  },
  // Ana sayfa filmi — bkz. plan "i18n — üçlemenin kalıcı çözümü". index.astro
  // yalnızca bunu bileşenlere eşler, hiçbir .astro dosyasında düz metin yok.
  home: {
    hero: {
      eyebrow: 'Mutfağın dijital defteri',
      // Dizi olması önemli: SplitText konteyner genişliğine bağlı ve resize'da
      // yeniden bölüyor; istenen kırılmaları veri olarak yazmak hero
      // tipografisini her viewport'ta deterministik yapar, hiç JS gerektirmez.
      titleLines: ['Bir fiş,', 'bir gece', 'mutfağı.'],
      subtitle:
        'Market fişinin fotoğrafını çek — ürünler fiyatlarıyla envanterine düşsün. Buzdolabı, dondurucu, kiler; ne kadar biriktirdiğini, ne kadar israf ettiğini ay ay gör.',
      ctaPrimary: 'Ücretsiz indir',
      ctaSecondary: 'Ekranları gör',
    },
    acts: [
      {
        key: 'scan',
        eyebrow: 'Bölüm 1',
        title: 'Fişi çek.',
        body: 'Market fişinin fotoğrafını çek, tarama çizgisi satırları teker teker okur.',
      },
      {
        key: 'parse',
        eyebrow: 'Bölüm 2',
        title: 'Yapay zekâ ayrıştırır.',
        body: 'Ham fiş satırları; ürün adı, marka ve fiyata ayrışır. Emin olamadığında sana sorar.',
      },
      {
        key: 'sort',
        eyebrow: 'Bölüm 3',
        title: 'Bölümlere düşer.',
        body: 'Her ürün doğru bölüme — buzdolabı, dondurucu, kiler. Şüpheli olan havada kalır, sen seçersin.',
      },
      {
        key: 'money',
        eyebrow: 'Bölüm 4',
        title: 'Para görünür.',
        body: 'Ne kadar biriktirdiğini, ne kadar israf ettiğini ve ne kadar harcadığını anında gör.',
      },
    ],
    features: [
      { key: 'receipt', title: 'Fiş tarama', body: 'Tek fotoğrafla ürünler envanterine düşer.' },
      { key: 'inventory', title: 'Envanter', body: 'Buzdolabı, dondurucu, kiler — tek ekranda.' },
      { key: 'expiry', title: 'SKT takibi', body: 'Son kullanma tarihi yaklaşan ürünler öne çıkar.' },
      { key: 'shopping', title: 'Alışveriş listesi', body: 'Biten ürün otomatik listeye eklenir.' },
      { key: 'recipes', title: 'Tarifler', body: 'Elindeki malzemeyle yapılabilecek tarifler önerilir.' },
      { key: 'chef', title: 'Şef sohbeti', body: 'Ne pişirsem diye sorduğunda yapay zekâ önerir.' },
      { key: 'sharing', title: 'Paylaşım', body: 'Evin tüm üyeleri aynı envanteri görür, günceller.' },
      { key: 'notifications', title: 'Bildirimler', body: 'Ürün bitmeden, tarih geçmeden haber verir.' },
    ],
    marquee: {
      heading: 'Uygulamanın içinden',
    },
    metrics: {
      heading: 'Her sayının bir hikâyesi var',
    },
    finalCta: {
      title: 'Fişini tara, gerisini Fridge halletsin.',
      body: 'Ücretsiz indir, ilk fişini bugün tara.',
      ctaPrimary: 'Ücretsiz indir',
      ctaSecondary: 'Ekranları gör',
    },
  },
};
