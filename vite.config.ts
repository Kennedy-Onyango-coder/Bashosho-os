import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['assets/logo.png', 'assets/favicon.png', 'assets/pwa-192.png', 'assets/pwa-512.png'],
        manifest: {
          name: 'Bashosho OS',
          short_name: 'Bashosho',
          description: 'Unified Operational System for Bashosho Talents CBO',
          theme_color: '#E31E24',
          background_color: '#FFFFFF',
          display: 'standalone',
          icons: [
            { src: '/assets/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/assets/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/assets/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
          // Default is 2 MiB. The app's main bundle has grown past that as features have
          // been added (permissions matrix, activity log, Daraja integration, etc.), so the
          // build was failing outright at precache-manifest generation. Raised with headroom;
          // the real fix long-term is code-splitting via dynamic import(), not just raising
          // this ceiling indefinitely.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
