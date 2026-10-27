import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { pwaBeely } from '@beely/ui/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pwaBeely({
      titulo: 'Beely',
      manifest: { nombre: 'Beely · Panel', nombreCorto: 'Beely', descripcion: 'Panel de fidelización de tu negocio' },
    }),
  ],
  server: { host: '127.0.0.1' },
})
