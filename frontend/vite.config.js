import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

// Let's Encrypt(win-acme)로 발급한 minde.ai.kr 공인 인증서가 있으면 https로 서비스한다.
// 공인 CA 인증서라 어떤 기기에서도 "주의 요함" 경고 없이 신뢰됨. (90일마다 갱신)
// 인증서 파일이 없는 환경(팀원/CI)에선 자동으로 http로 폴백 → 안 깨짐.
const CERT = 'C:/minde-cert/minde.ai.kr-chain.pem'
const KEY = 'C:/minde-cert/minde.ai.kr-key.pem'
const https = (fs.existsSync(CERT) && fs.existsSync(KEY))
  ? { key: fs.readFileSync(KEY), cert: fs.readFileSync(CERT) }
  : undefined

// API는 client.js에서 VITE_API_URL 절대주소로 직접 호출한다. (CORS 허용됨)
// https로 서비스할 땐 백엔드도 https여야 혼합 콘텐츠 차단이 안 난다 → VITE_API_URL도 https로.
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 443,
      allowedHosts: true,
      ...(https ? { https } : {}),
      watch: {
        ignored: ['**/README.md', '**/*.md', '**/node_modules/**'],
      },
    },
  }
})
