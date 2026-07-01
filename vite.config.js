import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/users':         { target: 'http://localhost:8000', changeOrigin: true },
      '/complaints':    { target: 'http://localhost:8000', changeOrigin: true },
      '/admin':         { target: 'http://localhost:8000', changeOrigin: true, bypass: (req) => { if (req.headers.accept?.includes('text/html')) return '/index.html'; } },
      '/chat':          { target: 'http://localhost:8000', changeOrigin: true },
      '/notifications': { target: 'http://localhost:8000', changeOrigin: true, bypass: (req) => { if (req.headers.accept?.includes('text/html')) return '/index.html'; } },
    },
  },
})
