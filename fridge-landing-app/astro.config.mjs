import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Fridge tanıtım sitesi. Bağımsız Astro projesi — fridge-monorepo kök
// workspace'ine dahil değildir (bkz. docs/WEB_SITE_SPEC.md §1).
export default defineConfig({
  site: 'https://fridge.app',
  trailingSlash: 'never',
  integrations: [
    react(),
    sitemap({
      // capture-tool: WebGL doku üretimi için dahili build aracı, herkese açık
      // içerik değil — sitemap'ten ve arama motorlarından hariç tutulur.
      filter: (page) => !page.includes('/capture-tool/'),
    }),
  ],
  build: {
    // Küçük sayfa CSS'lerini <style> olarak HTML'e göm — ayrı bir
    // render-blocking istek (bkz. WEB_SITE_SPEC §9 LCP ölçümü, Lighthouse
    // "render-blocking-insight") elenir, ilk boya hızlanır.
    inlineStylesheets: 'auto',
  },
  i18n: {
    defaultLocale: 'tr',
    locales: ['tr', 'en'],
    routing: {
      prefixDefaultLocale: false, // tr kökte (/), en /en/ altında
    },
  },
  // Görüntü fontu — bkz. plan "Tipografi — Türkçe kararı belirliyor".
  // `subsets: ['latin', 'latin-ext']` ZORUNLU: ç ö ü latin'de ama
  // ğ ı İ Ş ş latin-ext'te — latin-only bir alt küme sayfanın en önemli dört
  // kelimesini ("Buzdolabı", "İsraf", "Ayrıştırır", "Şef") sessizce tofu yapar.
  // Astro derleme zamanında indirir, size-adjust/ascent-override yedek
  // metrikleriyle @font-face üretir (font-swap CLS'ini öldüren şey bu) ve
  // preload ekler — sıfır dış istek.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Bricolage Grotesque',
      cssVariable: '--font-display',
      subsets: ['latin', 'latin-ext'],
      weights: ['200 800'],
      styles: ['normal'],
      fallbacks: ['Archivo', 'sans-serif'],
    },
  ],
});
