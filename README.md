# KB 청년 자취 도우미 — 프론트엔드

독립만세팀 / 2026 KB A.I Challenge

청년의 첫 자취 준비를 마이데이터 기반으로 진단하고, 자금·저축·정책을 한 번에 설계해주는 웹 서비스입니다.
React 18 + Vite 5 + Tailwind CSS 3 기반의 단일 페이지 애플리케이션(SPA)입니다.

---

## 실행 방법

### 1. 백엔드를 먼저 실행합니다

이 프론트엔드는 `http://localhost:8080` 의 백엔드 API를 호출합니다.
`kb-backend/README.md` 를 따라 백엔드를 먼저 띄워 주세요.

> **백엔드 없이 화면만 확인하려면** `src/api.js` 상단의
> `export const USE_MOCK = false` 를 `true` 로 바꾸면 됩니다.
> 가짜 응답(`src/api.mock.js`)으로 전 화면이 동작합니다.
> 테스트 계정 — 아이디 `testUser` / 비밀번호 `abcdefg!123`

### 2. 프론트엔드 실행

```bash
cd kb-frontend
npm install
npm run dev
```

브라우저에서 **http://localhost:5173** 으로 접속합니다.

### 빌드

```bash
npm run build     # dist/ 생성
npm run preview   # 빌드 결과 확인
```

### 요구 환경

- Node.js 18 이상 (Node 22에서 빌드 검증)
- 별도 환경변수 파일 필요 없음

---

## 화면 구성

랜딩 → 가입 흐름 → 로그인 후 사이드바 메뉴 구조입니다.

| 화면 | 파일 | 설명 |
|---|---|---|
| 랜딩(소개) | `Review.jsx` | 처음 접속 시 보이는 서비스 소개 |
| 회원가입 | `Signup.jsx` | 약관 동의 + 계정 생성 |
| 마이데이터 연결 | `Mydata.jsx` | 가입 직후 자산·소비 데이터 연동 |
| 목표 설정 | `Forecast.jsx` | 희망 지역·주거형태 입력 → 자취 가능 시점 시뮬레이션 |
| 로그인 | `Login.jsx` | JWT 로그인 |
| **홈** | `Home.jsx` | AI 분석 결과 요약 대시보드 |
| 자금조달 설계 | `FundingPlan.jsx` | 보증금·월세 조달 계획, DSR 반영 |
| 저축 플랜 추천 | `SavingPlan.jsx` | 목표 시점 역산 저축 계획 |
| 맞춤 정책·지원금 | `Policy.jsx` | 온통청년 API 연동 청년 정책 추천 |
| 마이데이터 관리 | `MydataManage.jsx` | 연동 자산 확인·재동기화 |
| 마이페이지 | `MyPage.jsx` | 프로필·소득 수정, 비밀번호 변경 |

---

## 파일 구조

```
index.html
vite.config.js            # /api → localhost:8080 프록시 (CORS 회피)
tailwind.config.js        # KB 옐로우 등 브랜드 색상 정의
public/assets/            # 아이콘·일러스트 이미지
src/
├─ main.jsx               # 진입점
├─ App.jsx                # 화면 전환 (useState 기반, 라우터 미사용)
├─ Shell.jsx              # 사이드바·헤더·ErrorBoundary 공통 레이아웃
├─ api.js                 # ★ 백엔드 통신 공통 모듈
├─ api.mock.js            # 백엔드 없이 실행하기 위한 가짜 응답
├─ store.js               # 화면 간 데이터 보관소
├─ analysis.js            # 서버 원본 데이터 → 화면용 파생 계산
├─ AiPick.jsx             # AI 어드바이스 공통 카드
├─ index.css              # Tailwind 불러오기
└─ (화면별 .jsx 11개 — 위 표 참고)
```

### `src/api.js`

화면마다 `fetch` 를 직접 쓰면 토큰 처리 코드가 중복되므로 한 곳에 모았습니다.

1. **토큰 보관** — 로그인 상태 유지 여부에 따라 저장 위치를 변경
2. **헤더 자동 부착** — 인증이 필요한 API에 `Authorization` 자동 추가
3. **만료 시 자동 갱신** — 401 응답 시 토큰 재발급 후 원래 요청을 한 번 재시도
4. **에러 변환** — 백엔드 `errorCode` 를 사용자용 한글 문구로 변환

### CORS 처리

`vite.config.js` 의 프록시가 `/api` 요청을 백엔드(8080)로 전달합니다.
브라우저 입장에서는 같은 출처(5173)이므로 개발 중 CORS 문제가 발생하지 않습니다.
(개발 서버 전용 설정이며, 실제 배포 시에는 백엔드 CORS 설정이 필요합니다.)

---

## 관련 저장소

- 백엔드 — [kb-backend](https://github.com/2026KBcontest/kb-backend)
