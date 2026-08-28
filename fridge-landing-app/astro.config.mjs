import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Fridge tanıtım sitesi. Bağımsız Astro projesi — fridge-monorepo kök
// workspace'ine dahil değildir (bkz. docs/WEB_SITE_SPEC.md §1).
export default defineConfig({
  site: 'https://fridge.app',
  trailingSlash: 'never',
  integrations: [react(), sitemap()],
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
});
