# KB 청년 자취 도우미 — 홈화면

독립만세팀 / KB AI Challenge 2026
개발 시나리오 ④ **홈화면(= AI 분석 결과 요약 페이지)**

## 실행

VS Code에서 이 폴더(`vscode`)를 열고, 터미널(Ctrl + `)에서:

```bash
npm install
npm run dev      # http://localhost:5173
```

터미널 프롬프트가 `...\KB공모전\vscode>` 로 시작하는지 꼭 확인.
다른 폴더에서 실행하면 `ENOENT package.json` 에러가 남.

## 파일 구성

```
index.html
tailwind.config.js        # KB 옐로우 등 색상 정의
src/
├─ main.jsx               # 진입점
├─ index.css              # Tailwind 불러오기
└─ Home.jsx               # ★ 홈화면 전체 (여기만 보면 됨)
```

`Home.jsx` 안 순서:

1. 공통 조각 — `IconBox` / `Card` / `Donut` / `Sparkline` / `Toggle` / 버튼
2. `Sidebar`, `Header`
3. 1행 `HeroBanner` → 2행 `TimelineCard` `FundStatusCard`
   → 3행 `AiInsightCard` `ChecklistCard` → 4행 `CoachBanner`
4. `export default Home` — 위 조각들을 그리드에 배치

## 레이아웃

```
1행 │ [ D+14개월 요약 배너   7 ] [ 다음 분석 예정일  5 ]
2행 │ [ 자취 가능 시점 예측  7 ] [ 자금 현황        5 ]
3행 │ [ AI 추천 인사이트     7 ] [ 오늘의 체크리스트 5 ]
4행 │ [ AI 자취 코치 한 마디 + 요약 카드 3개         ]
```

## 아이콘 넣는 법

전부 `<IconBox />`(회색 점선 박스)로 자리만 잡아둠.
`public/assets/` 폴더 만들어서 파일 넣고 `src` 만 주면 끝.

```jsx
<IconBox size={20} />                          // 지금 상태
<IconBox size={20} src="/assets/home.svg" />   // 아이콘 넣은 상태
```

넣을 자리: 사이드바(KB 심볼·메뉴 7개·코치 캐릭터), 헤더(알림·문의·프로필),
히어로 배너(집/동전 일러스트), 인사이트(전구·절약 팁 3개), 하단 배너(코치·저금통·방패·지도핀)

## 참고

- 숫자·문구는 시안 값을 화면에 그대로 적어둔 상태.
  백엔드 API 나오면 각 컴포넌트에 props 로 내려주면 됨
- 마이데이터 스키마는 백엔드 담당
- `이번 달 추천 금융 상품`, `맞춤 정책·지원금` 은 홈에서 제외 (⑤·⑦ 페이지로)
- `npm run build` 통과 확인 (vite 5.4)
