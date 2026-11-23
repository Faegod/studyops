import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['studyops-192.png', 'studyops-512.png'],
      manifest: {
        id: './',
        name: 'StudyOps — Painel de estudos de TI',
        short_name: 'StudyOps',
        description: 'Planeje sua formação em TI e continue de onde parou.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f5f7f6',
        theme_color: '#112d25',
        icons: [
          { src: 'studyops-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'studyops-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,png,woff2}'],
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
