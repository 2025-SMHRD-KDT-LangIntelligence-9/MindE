import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const BACKEND = env.BACKEND_URL || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 3000,
      allowedHosts: true,
      proxy: {
        '/users':         { target: BACKEND, changeOrigin: true },
        '/complaints':    { target: BACKEND, changeOrigin: true },
        '/admin':         { target: BACKEND, changeOrigin: true, bypass: (req) => { if (req.headers.accept?.includes('text/html')) return '/index.html'; } },
        '/chat':          { target: BACKEND, changeOrigin: true },
        '/notifications': { target: BACKEND, changeOrigin: true, bypass: (req) => { if (req.headers.accept?.includes('text/html')) return '/index.html'; } },
      },
    },
  }
})
