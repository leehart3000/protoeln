import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // ProtoLIMS uses Vite's usual ports (5173 and 4173), so ProtoELN uses the next ones up, and
  // both can run at once. Requests to /api go to the API (backend), so the website and the API
  // share one address, as they will when deployed. The API is told the address the browser
  // used (changeOrigin: false keeps the Host header), so sign-in can move a browser on localhost
  // to 127.0.0.1 first.
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
  },
})
