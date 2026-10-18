import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // O MSW só usa tough-cookie para cookies de Set-Cookie, que esta API não
      // emite; o stub tira ~250 KB do chunk dos mocks (ver o arquivo).
      'tough-cookie': fileURLToPath(new URL('./src/mocks/vendor/tough-cookie-stub.ts', import.meta.url)),
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})
