import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* ============================================================
   개발 서버 설정

   [proxy 를 쓰는 이유 — CORS 를 피하기 위함]

   프론트(5173)에서 백엔드(8080)를 직접 부르면 출처가 달라서 브라우저가 막는다.
   백엔드에 CORS 설정이 추가되기 전까지는 아무것도 테스트할 수 없음.

   그런데 아래처럼 proxy 를 걸면 브라우저는 '자기 자신(5173)' 에게 요청하고,
   Vite 가 서버 쪽에서 8080 으로 전달해준다.
   브라우저 입장에서는 같은 출처이므로 CORS 규칙이 아예 적용되지 않는다.

   덤으로 응답 헤더도 그대로 넘어온다.
   → 로그인 토큰이 Authorization / Refresh-Token 헤더로 오는데,
     Access-Control-Expose-Headers 설정 없이도 읽을 수 있다.

   ※ 이건 개발 서버(npm run dev)에서만 동작한다.
     실제 배포할 때는 백엔드에 CORS 설정이 반드시 필요함.
   ============================================================ */

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      // /api 로 시작하는 요청을 백엔드로 전달
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
