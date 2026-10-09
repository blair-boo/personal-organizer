import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Nome do repositório no GitHub Pages: https://<usuario>.github.io/personal-organizer/
const BASE_PATH = '/personal-organizer/';

// Duplicado de propósito: este config não importa código de `src` (roda fora do
// bundle da app). Manter em sincronia com src/config.ts.
const APP_NAME = 'Personal Organizer';

export default defineConfig(({ command }) => ({
  // Hora do build, mostrada em Settings > App pra saber qual versão está rodando.
  define: { __BUILD_ISO__: JSON.stringify(new Date().toISOString()) },
  base: command === 'build' ? BASE_PATH : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png'],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description: 'Organizador pessoal de finanças e apartamento',
        theme_color: '#0f4c3a',
        background_color: '#f4f6f5',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // pdfjs-dist (chunk + worker) só é baixado quando ela realmente importa um
        // PDF — sem isso o precache inicial do PWA baixaria +1MB pra quem nunca
        // usa a importação financeira. Fica disponível via rede normal na primeira
        // vez que um PDF é lido; a regra CacheFirst abaixo cacheia depois disso.
        globIgnores: ['**/assets/pdf-*.js', '**/assets/pdf.worker.min-*.mjs', '**/assets/ResumoGeralPage-*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/pdf(\.worker\.min)?-.*\.(js|mjs)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdfjs-chunk-cache',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Respostas da API (/rest/v1/) e arquivos privados (Storage autenticado e URLs
          // assinadas) NÃO ficam no cache do service worker: dados pessoais guardados
          // ali não seriam apagados ao sair da conta nem por "Apagar dados offline".
          // O offline de Apartamento e Documentos tem cache próprio (IndexedDB e
          // Cache Storage "arquivos-offline"), apagado nesses dois casos.
          {
            // Só os ícones públicos do bucket "icones" (URL estável), pra aparecerem offline.
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/public/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'storage-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}));
