# fridge-landing-app

Fridge'in tanıtım/pazarlama sitesi. Kök `CLAUDE.md`'nin (OpenWolf) yanında, bu alt-uygulamaya
özel derinlemesine referans — bkz. monorepo şablonu §10.11.

## Teknoloji Yığını

Astro (statik-öncelikli) + React 19 adaları (`client:visible`) + saf JavaScript — TypeScript kullanılmıyor.
3B: three.js + @react-three/fiber (**sadece** hero adasında). Scroll: GSAP ScrollTrigger.
Yumuşak scroll: Lenis (reduced-motion'da hiç kurulmaz). Stil: SCSS Modules.
i18n: Astro routing — TR kökte (`/`), EN `/en/` altında.

**Bağımsızlık:** Bu paket kök `fridge-monorepo/package.json`'ın `workspaces`'ine dahil
DEĞİLDİR. Kendi `package.json`, kendi `node_modules`'ı var. `cd fridge-landing-app` içinden
çalıştırılır.

## Tam spesifikasyon

`docs/WEB_SITE_SPEC.md` (repo kökünde) — sayfa haritası, 23 ekran maketi envanteri, seed
şeması, animasyon senaryoları, performans bütçesi. Tasarım token'ları için tek kaynak
`docs/DESIGN_SPEC.md`.

## Kritik kurallar

1. **Token'lar elle yazılmaz.** `npm run sync:tokens` → `fridge-mobil/lib/core/theme/app_theme.dart`'ı
   okuyup `src/styles/_tokens.scss` üretir.
2. **String'ler elle yazılmaz** (pazarlama metinleri hariç). `npm run sync:strings` →
   `fridge-mobil/lib/l10n/app_{tr,en}.arb`'yi okuyup `src/i18n/app-strings.*.ts` üretir.
3. **Maketler seed'den beslenir, asla kendi içinde veri barındırmaz.** `src/seed/index.ts`
   → `getSeed('full' | 'empty')`.
4. **3B hero'nun yükleme kapısı zorunlu**: `prefers-reduced-motion`, <768px viewport,
   düşük donanım, veya WebGL2 yoksa → `public/posters/hero-*.webp` + CSS parallax.
   Asla canvas'ı zorla mount etme.
5. **Ara boşluk/yarıçap değeri yasak** — sadece DESIGN_SPEC §3-4'teki değerler (4/8/16/24/32,
   12/14/16/20/999).
6. Bu projede yapılan mimari kararlar için önce `docs/WEB_SITE_SPEC.md`'yi güncelle, sonra
   kök `.wolf/cerebrum.md`'ye Decision Log girişi ekle.
