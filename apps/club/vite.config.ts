import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaBeely } from '@beely/ui/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Íconos, metas de iOS y tema inicial. El manifest de cada negocio lo arma
    // api/manifest.ts sobre esta base (nombre y colores del negocio).
    pwaBeely({
      titulo: 'Club',
      archivoManifest: 'manifest-base.webmanifest',
      manifest: { nombre: 'Club Beely', nombreCorto: 'Club', descripcion: 'Tu tarjeta de sellos', inicio: null },
    }),
    // Service worker propio (src/sw.ts): precarga la app con Workbox y recibe los Web Push.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      // Solo las fuentes latinas: las de otros alfabetos se bajan si alguna vez hacen falta.
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-*.woff2'] },
    }),
  ],
  server: { host: '127.0.0.1' },
})
