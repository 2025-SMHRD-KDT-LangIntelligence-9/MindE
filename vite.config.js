import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// API는 client.js에서 VITE_API_URL(=http://minde.ai.kr:8000) 절대주소로 직접 호출한다.
// (CORS 허용됨) → dev 프록시가 필요 없고, 있으면 /chatbot 같은 프론트 경로를
// 백엔드로 넘겨 새로고침 시 404가 나므로 프록시를 두지 않는다.
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 3000,
      allowedHosts: true,
    },
  }
})
