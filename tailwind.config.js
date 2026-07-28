/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        kb: {
          // 옐로우 (본문 CTA·배너 전용)
          yellow: '#FFBC00',
          yellowDark: '#EDAE00',
          yellowSoft: '#FFF3D6',
          yellowBg: '#FFFAEF',

          // 브라운 (KB CI 'KB Gray' 계열) — 사이드바
          brown: '#60584C',       // 사이드바 배경
          brownDark: '#4A443B',   // 더 진한 톤 / 텍스트
          brownLine: '#7B7364',   // 브라운 면 위의 구분선
          brownTint: '#FAF8F4',   // 브라운 위에 얹는 웜화이트 카드

          gray: '#60584C',
        },
        ink: { 900: '#1A1A1A', 700: '#4A4A4A', 500: '#8A8A8A', 300: '#B5B5B5' },
        line: '#F1F3F6',
        ok: '#22B573',
        warn: '#FF8A00',
        danger: '#F04452',
      },
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
