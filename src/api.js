/* ============================================================
   KB 청년 자취 도우미 — 백엔드 통신 공통 모듈
   독립만세팀 / KB AI Challenge 2026

   화면마다 fetch 를 직접 쓰면 토큰 붙이는 코드가 여기저기 복사되고,
   토큰 만료 처리를 화면마다 따로 만들게 됨. 그래서 한 곳에 모았음.

   [이 파일이 하는 일]
   1. 토큰 보관        — 로그인 상태 유지 여부에 따라 저장 위치를 바꿈
   2. 헤더 자동 부착    — 인증 필요한 API 에 Authorization 을 알아서 붙임
   3. 만료 시 자동 갱신 — 401 이 오면 reissue 로 새 토큰을 받고 원래 요청을 한 번 재시도
   4. 에러 변환        — 백엔드 errorCode 를 사용자에게 보여줄 한글 문구로 바꿈
   ============================================================ */


/* ---------- 목(mock) 모드 ---------- */

/* ★ 백엔드 서버 없이 화면을 눌러보려면 true.
     백엔드 서버가 준비되면 false 로 바꾸면 됨. (이 한 줄만 고치면 됨)

   테스트 계정 — 아이디 testUser / 비밀번호 abcdefg!123
   가짜 응답은 api.mock.js 에 있고, 실제 명세서와 같은 모양으로 만들어뒀음 */
export const USE_MOCK = false

if (USE_MOCK && typeof console !== 'undefined') {
  console.warn(
    '[api] 목(mock) 모드로 동작 중입니다. 실제 백엔드에 연결하려면 src/api.js 의 USE_MOCK 을 false 로 바꾸세요.',
  )
}


/* ---------- 서버 주소 ---------- */

/* 기본값이 빈 문자열인 이유 —

   빈 값이면 '/api/auth/login' 처럼 상대 경로로 요청이 나가고,
   vite.config.js 의 proxy 가 이를 localhost:8080 으로 전달해준다.
   브라우저는 같은 출처로 보기 때문에 CORS 에 막히지 않고,
   응답 헤더(Authorization / Refresh-Token)도 그대로 읽을 수 있다.

   배포할 때는 .env 에 VITE_API_BASE=https://실제주소 를 넣으면 그 값을 쓴다.
   (그때는 백엔드에 CORS 설정이 반드시 필요함) */
export const API_BASE = import.meta.env.VITE_API_BASE ?? ''


/* ---------- 토큰 보관 ---------- */

/* 로그인 상태 유지를 켰으면 localStorage(브라우저를 닫아도 남음),
   껐으면 sessionStorage(탭을 닫으면 사라짐)에 넣는다.
   두 곳을 다 뒤져서 읽기 때문에 어디에 저장했는지 신경 쓸 필요가 없음. */

const ACCESS_KEY = 'kb_access_token'
const REFRESH_KEY = 'kb_refresh_token'
const USER_KEY = 'kb_user'

function pickStore(keepLogin) {
  return keepLogin ? window.localStorage : window.sessionStorage
}

function readKey(key) {
  return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
}

export function saveSession({ accessToken, refreshToken, user, keepLogin = false }) {
  clearSession() // 이전에 다른 저장소에 남은 값이 섞이지 않게 먼저 비움

  const store = pickStore(keepLogin)
  if (accessToken) store.setItem(ACCESS_KEY, accessToken)
  if (refreshToken) store.setItem(REFRESH_KEY, refreshToken)
  if (user) store.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  for (const store of [window.localStorage, window.sessionStorage]) {
    store.removeItem(ACCESS_KEY)
    store.removeItem(REFRESH_KEY)
    store.removeItem(USER_KEY)
  }
}

export const getAccessToken = () => readKey(ACCESS_KEY)
export const isLoggedIn = () => Boolean(getAccessToken())

export function getUser() {
  const raw = readKey(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null // 저장값이 깨져 있으면 로그인 안 한 것으로 취급
  }
}

// 새 access token 을 기존 저장소(local/session)에 그대로 덮어씀
function updateAccessToken(token) {
  const store = window.localStorage.getItem(ACCESS_KEY) !== null
    ? window.localStorage
    : window.sessionStorage
  store.setItem(ACCESS_KEY, token)
}


/* ---------- 에러 ---------- */

/* 백엔드 에러 응답 형식이 두 갈래로 갈려 있음 (개발자 2명이 각자 만든 상태)

   forecast·mydata·user 쪽 : { "success": false, "errorCode": "AUTH_003", "message": "...", "timestamp": "..." }
   auth·policy 쪽          : { "code": "INVALID_INPUT", "message": "..." }

   어느 쪽이 와도 코드를 읽을 수 있게 errorCode 와 code 를 모두 본다.
   백엔드에서 하나로 통일되면 이 관용 처리는 지워도 됨 */

const ERROR_TEXT = {
  AUTH_001: '이미 사용 중인 아이디예요.',
  AUTH_002: '이미 가입된 이메일이에요.',
  AUTH_003: '아이디 또는 비밀번호가 올바르지 않아요.',
  AUTH_004: '로그인이 만료되었어요. 다시 로그인해주세요.',
  USER_001: '사용자 정보를 찾을 수 없어요. 다시 로그인해주세요.',
  MYDATA_001: '사용자 정보를 찾을 수 없어요. 다시 로그인해주세요.',
  SIMULATION_001: '아직 지원하지 않는 지역이에요. 다른 지역을 선택해주세요.',
  SIMULATION_002: '월 소득이 등록되지 않았어요. 소득을 먼저 입력해주세요.',
  SIMULATION_003: '사용자 정보를 찾을 수 없어요. 다시 로그인해주세요.',
  COMMON_001: '입력값을 다시 확인해주세요.',

  /* auth·policy 쪽 GlobalExceptionHandler 가 쓰는 코드.
     main 브랜치에서 401·409 핸들러가 추가되며 UNAUTHORIZED / DUPLICATE_EMAIL 이 생겼음 */
  INVALID_INPUT: '입력값을 다시 확인해주세요.',
  BAD_REQUEST: '요청을 처리할 수 없어요. 입력값을 확인해주세요.',
  UNAUTHORIZED: '아이디 또는 비밀번호가 올바르지 않아요.',
  DUPLICATE_EMAIL: '이미 가입된 이메일이에요.',

  // AI 응답 API 가 아직 서버에 없을 때
  AI_NOT_READY: 'AI 분석 기능은 준비 중이에요. 연결되면 바로 답변해드릴게요.',

  // 서버에 닿지 못한 경우 (errorCode 가 없어서 프론트에서 붙이는 코드)
  NETWORK: '백엔드 서버에 연결할 수 없어요. 서버가 실행 중인지, 시작 중에 오류로 종료되지 않았는지 터미널을 확인해주세요.',
  NO_TOKEN: '로그인이 필요한 기능이에요. 다시 로그인해주세요.',
}

/* 서버가 코드도 메시지도 안 줬을 때 상태 코드만으로 원인을 좁혀주는 문구.
   '알 수 없는 오류' 만 뜨면 사용자도 개발자도 다음에 뭘 해야 할지 알 수 없다 */
const STATUS_TEXT = {
  400: '입력값을 서버가 거절했어요. 형식을 다시 확인해주세요. (400)',
  403: '서버 접근이 거부됐어요. 로그인 상태를 확인해주세요. (403)',
  404: '요청한 주소를 서버에서 찾지 못했어요. (404)',
  409: '이미 사용 중인 아이디 또는 이메일이에요. (409)',
  500: '서버 내부 오류예요. 백엔드 터미널의 오류 메시지를 확인해주세요. (500)',
}

export class ApiError extends Error {
  constructor(errorCode, message, status) {
    // 서버가 준 message → 코드별 문구 → 상태 코드별 문구 순으로 고른다
    super(
      message ||
        ERROR_TEXT[errorCode] ||
        STATUS_TEXT[status] ||
        `알 수 없는 오류가 발생했어요.${status ? ` (${status})` : ''}`,
    )
    this.errorCode = errorCode
    this.status = status
  }
}

// 필드 하나짜리 에러를 화면에서 쓰기 쉽게, 코드에 해당하는 문구만 꺼내는 용도
export const errorTextOf = (code) => ERROR_TEXT[code] ?? null


/* ---------- 요청 ---------- */

/* auth: true 면 Authorization 헤더를 붙이고, 401 이면 자동 갱신을 시도한다.
   raw: true 면 응답 객체를 그대로 넘겨준다 (헤더를 직접 읽어야 하는 로그인용) */

async function request(path, { method = 'GET', body, auth = false, raw = false, headers = {} } = {}) {
  const finalHeaders = { ...headers }
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json'

  if (auth) {
    const token = getAccessToken()

    /* 토큰이 아예 없으면 요청을 보내지 않고 여기서 끝낸다.
       그냥 보내면 서버가 401·403 을 주고 → 갱신 시도 실패 → AUTH_004(만료) 로 이어져서
       '한 번도 로그인한 적 없는데 만료됐다' 는 이상한 안내가 나간다 */
    if (!token) throw new ApiError('NO_TOKEN', null, 0)

    finalHeaders.Authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // fetch 자체가 실패 — 서버가 꺼져 있거나 CORS 에 막힌 경우
    throw new ApiError('NETWORK', null, 0)
  }

  /* access token 만료 → refresh 로 한 번만 재발급 시도 후 원래 요청 재시도

     401 과 403 을 함께 본다. 백엔드 SecurityConfig 에 authenticationEntryPoint 가
     지정돼 있지 않아서, 인증 실패 시 Spring Security 기본값인 403 이 내려올 수 있음.
     401 만 보면 자동 갱신이 아예 동작하지 않는다 */
  if ((res.status === 401 || res.status === 403) && auth) {
    const renewed = await tryReissue()
    if (renewed) {
      return request(path, { method, body, auth, raw, headers })
    }
    clearSession()
    throw new ApiError('AUTH_004', null, 401)
  }

  if (!res.ok) {
    /* 에러 바디를 텍스트로 먼저 읽는다.
       JSON 이 아닐 수도 있고(HTML 오류 페이지 등), 그 내용이 원인 파악에 제일 중요하다 */
    const rawBody = await res.text().catch(() => '')

    let payload = {}
    try {
      payload = JSON.parse(rawBody)
    } catch {
      /* JSON 이 아님 — payload 는 빈 객체로 두고 아래 로그로 원본을 남긴다 */
    }

    /* 서버가 에러 코드도 메시지도 안 주면 화면에는 '알 수 없는 오류' 밖에 못 띄운다.
       그때 개발자 도구에서 원인을 바로 볼 수 있게 응답 원본을 남긴다.
       (Spring 기본 오류 응답은 { timestamp, status, error, path } 라 code·message 가 없다) */
    if (!payload.errorCode && !payload.code) {
      console.error(
        `[api] ${method} ${path} → ${res.status} ${res.statusText}\n` +
          `응답 본문: ${rawBody || '(비어 있음)'}`,
      )
    }

    /* 500 인데 본문이 완전히 비어 있으면 서버가 만든 응답이 아니다.
       Vite 프록시(vite.config.js)가 백엔드에 연결하지 못했을 때 이 형태로 내려준다.
       — 백엔드가 안 떠 있거나, 뜨는 도중 DB 접속 실패로 죽은 경우가 대부분이다.

       이걸 '서버 내부 오류' 라고 안내하면 백엔드 코드를 뒤지게 되어 시간을 크게 버린다.
       실제로 겪은 경우 : DB_PASSWORD 가 틀려서 서버가 시작 중 종료 → 화면에는 500 */
    if (res.status === 500 && !rawBody) {
      throw new ApiError('NETWORK', null, 500)
    }

    // errorCode(forecast 계열) 와 code(auth·policy 계열) 를 모두 받아들임
    throw new ApiError(payload.errorCode ?? payload.code, payload.message, res.status)
  }

  if (raw) return res

  // 204 나 본문 없는 200 (예: PATCH income) 은 null 을 돌려줌
  const text = await res.text()
  if (!text) return null
  return JSON.parse(text)
}

// 성공하면 true. 실패하면 false (호출한 쪽에서 세션을 비움)
async function tryReissue() {
  const refreshToken = readKey(REFRESH_KEY)
  if (!refreshToken) return false

  try {
    const res = await fetch(`${API_BASE}/api/auth/reissue`, {
      method: 'POST',
      headers: { 'Refresh-Token': refreshToken },
    })
    if (!res.ok) return false

    const newAccess = readBearer(res.headers.get('Authorization'))
    if (!newAccess) return false

    updateAccessToken(newAccess)
    return true
  } catch {
    return false
  }
}

// "Bearer eyJhb..." 에서 토큰만 떼어냄. 접두사가 없어도 그대로 받아들임
function readBearer(value) {
  if (!value) return null
  return value.startsWith('Bearer ') ? value.slice(7) : value
}


/* ============================================================
   화면에서 쓰는 함수들
   ============================================================ */

/* ---------- auth ---------- */

/* POST /api/auth/signup — 인증 불필요

   2026-08-01 백엔드 개편으로 받는 항목이 4개 → 9개 + 약관 동의로 늘었다.
   전부 필수이고, 하나라도 빠지면 400 이 온다.

     loginId          ^[a-zA-Z0-9]{4,20}$   (숫자 허용으로 바뀜)
     password         10~22자 + 특수문자 1개 이상
     email            이메일 형식
     name
     birthDate        "1999-04-11"  (LocalDate)
     gender           남성 | 여성            (enum — 다른 값이면 400)
     job              학생 | 무직 | 직장인    (enum — '취업준비생' 은 없음)
     residenceRegion  "서울특별시"
     phone            "010-1234-5678"        (하이픈 필수)
     agreements       { privacyAgreed, mydataAgreed, marketingAgreed }
                      privacy·mydata 는 true 가 아니면 400 */
export async function signup(payload) {
  if (USE_MOCK) {
    const { mockSignup } = await import('./api.mock.js')
    return mockSignup(payload)
  }

  return request('/api/auth/signup', {
    method: 'POST',
    body: payload,
  })
}

/* POST /api/auth/login — 인증 불필요

   ★ 주의 : 토큰이 응답 '바디' 가 아니라 '헤더' 로 온다.
     브라우저는 CORS 요청에서 기본적으로 몇 개의 안전한 헤더만 읽을 수 있어서,
     서버가 Access-Control-Expose-Headers 에 Authorization·Refresh-Token 을
     명시해주지 않으면 아래 headers.get() 이 항상 null 이 된다.
     (BACKEND_REQUEST.md 에 요청해둔 항목) */
export async function login({ loginId, password, keepLogin = false }) {
  if (USE_MOCK) {
    const { mockLogin } = await import('./api.mock.js')
    const { accessToken, refreshToken, user } = await mockLogin({ loginId, password })
    saveSession({ accessToken, refreshToken, user, keepLogin })
    return user
  }

  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { loginId, password },
    raw: true,
  })

  const accessToken = readBearer(res.headers.get('Authorization'))
  const refreshToken = res.headers.get('Refresh-Token')
  const user = await res.json()

  if (!accessToken) {
    // 로그인 자체는 성공(200)했는데 토큰을 못 읽은 상황.
    // 거의 항상 Expose-Headers 누락이라 원인을 바로 알 수 있게 문구를 따로 씀
    throw new ApiError(
      'NO_TOKEN_HEADER',
      '로그인은 됐지만 토큰을 읽지 못했어요. 서버의 Access-Control-Expose-Headers 설정이 필요해요.',
      200,
    )
  }

  saveSession({ accessToken, refreshToken, user, keepLogin })
  return user
}

export function logout() {
  clearSession()
}


/* ---------- user ---------- */

// PATCH /api/users/me/income — 응답 바디 없음
export async function updateIncome(monthlyIncome) {
  if (USE_MOCK) {
    const { mockUpdateIncome } = await import('./api.mock.js')
    return mockUpdateIncome(monthlyIncome)
  }

  return request('/api/users/me/income', {
    method: 'PATCH',
    body: { monthlyIncome },
    auth: true,
  })
}


/* ---------- mydata ---------- */

// POST /api/mydata/sync — 요청 바디 없음. 소비·자산 값을 돌려줌 (소득은 포함되지 않음)
export async function syncMydata() {
  if (USE_MOCK) {
    const { mockSyncMydata } = await import('./api.mock.js')
    return mockSyncMydata()
  }

  return request('/api/mydata/sync', { method: 'POST', auth: true })
}


/* ---------- 조회 3종 (2026-08-01 백엔드 추가) ---------- */

/* 이 세 개가 생기면서 화면이 '한 번 받아온 값을 브라우저에 들고 있는' 방식에서
   '필요할 때 서버에 물어보는' 방식으로 바뀔 수 있게 됐다.

   [데이터가 없을 때는 에러가 온다 — 정상 흐름이다]
     GET /api/mydata    연동 전  → MYDATA_002     (404)
     GET /api/forecast  분석 전  → SIMULATION_004 (404)

   '아직 안 했다' 는 실패가 아니라 상태다. 화면은 이 두 코드를 빈 값으로 처리한다. */

// GET /api/users/me — 이름·이메일·소득·생년월일·지역·성별·직업
export async function getMe() {
  if (USE_MOCK) {
    const { mockGetMe } = await import('./api.mock.js')
    return mockGetMe()
  }
  return request('/api/users/me', { auth: true })
}

// GET /api/mydata — 마지막으로 연동한 소비·자산·부채
export async function getMydata() {
  if (USE_MOCK) {
    const { mockGetMydata } = await import('./api.mock.js')
    return mockGetMydata()
  }
  return request('/api/mydata', { auth: true })
}

// GET /api/forecast — 마지막 분석 결과
export async function getForecast() {
  if (USE_MOCK) {
    const { mockGetForecast } = await import('./api.mock.js')
    return mockGetForecast()
  }
  return request('/api/forecast', { auth: true })
}

// PATCH /api/users/me — 마이페이지에서 프로필 수정 (보낸 필드만 갱신)
export async function updateProfile(patch) {
  if (USE_MOCK) {
    const { mockUpdateProfile } = await import('./api.mock.js')
    return mockUpdateProfile(patch)
  }
  return request('/api/users/me', { method: 'PATCH', auth: true, body: patch })
}

/* DELETE /api/users/me — 회원 탈퇴 (204 No Content)

   서버가 마이데이터 스냅샷·시뮬레이션 결과·약관 동의까지 함께 지운다
   (UserService.deleteAccount). 되돌릴 수 없으므로 화면에서 한 번 더 확인받는다. */
export async function deleteAccount() {
  if (USE_MOCK) {
    clearSession()
    return null
  }
  return request('/api/users/me', { method: 'DELETE', auth: true })
}


/* ---------- 금융상품 ---------- */

/* GET /api/products — 인증 불필요

   응답 { products: [{ productId, name, category, tag,
                       specs: [{ label, value }],           화면 표시용 문자열
                       calc:  { maxLimit, minRate, maxRate, maxYears },  계산용 숫자
                       link }] }

   category 는 'LOAN' | 'SAVINGS'.
   specs 는 사람이 읽는 값이라 계산에 쓰지 않는다. DSR·월 납입액은 calc 로 계산한다 */
export async function getProducts() {
  if (USE_MOCK) {
    const { mockGetProducts } = await import('./api.mock.js')
    return mockGetProducts()
  }
  return request('/api/products')
}

/* POST /api/products/recommend — 인증 불필요

   상품 목록 + AI 추천을 함께 받는다.
   금액은 화면이 이미 계산한 값을 보낸다. 서버가 다시 계산하면
   화면에 보이는 숫자와 추천 이유의 숫자가 어긋날 수 있다.

   후보가 1개뿐이면 서버가 AI 를 부르지 않고 recommendation: null 을 준다.
   (고를 게 없는데 부르면 크레딧만 나간다)

   응답 : { products: [...], recommendation: { source, pickId, headline, reasons } | null } */
export async function recommendProducts({ category, neededAmount, monthlyIncome, currentAsset }) {
  if (USE_MOCK) {
    const { mockGetProducts } = await import('./api.mock.js')
    return mockGetProducts()
  }
  return request('/api/products/recommend', {
    method: 'POST',
    body: { category, neededAmount, monthlyIncome, currentAsset },
  })
}

/* GET /api/forecast/regions — 인증 불필요

   서울 25개 자치구의 전세·월세 시세. 자취 목표 설정 화면에서
   지역을 고르는 순간 "이 동네가 대략 얼마인지" 를 보여주는 데 쓴다.

   금액은 서버가 계산해서 준다. 중개수수료 식을 화면에 옮겨두면
   미리보기와 분석 결과의 숫자가 어긋나는 순간이 온다.

   응답 : { regions: [ { region, jeonse: {deposit, monthlyRent, brokerageFee, requiredAmount},
                          wolse: {...} } ] } */
/* GET /api/forecast/region-options — 인증 필요

   지금 목표 지역과 붙어 있으면서 더 저렴한 구를 알려준다.
   저장된 시뮬레이션 결과가 있어야 한다(없으면 SIMULATION_004).

   금액·개월 수는 전부 서버가 계산한 값이고, AI 는 그중 어디를 권할지
   고르고 설명만 한다. 후보가 없으면 "지금이 제일 저렴하다" 는 안내가 온다.

   응답 : { current: {...}, candidates: [...], recommendation: {...} | null } */
export async function getRegionOptions() {
  if (USE_MOCK) {
    const { mockGetRegionOptions } = await import('./api.mock.js')
    return mockGetRegionOptions()
  }
  return request('/api/forecast/region-options', { auth: true })
}

export async function getRegions() {
  if (USE_MOCK) {
    const { mockGetRegions } = await import('./api.mock.js')
    return mockGetRegions()
  }
  return request('/api/forecast/regions')
}


/* ---------- AI 어드바이스 ---------- */

/* POST /api/ai/advice — 아직 서버에 없는 API. 붙으면 이 함수 하나로 연결된다.

   [보내는 것]
     scope    'policy' | 'funding' | 'saving'   어느 화면에서 물었는지
     question 사용자가 고른 질문
     context  그 화면이 계산해둔 값들 (금액·개월수·DSR 등)

   [context 를 함께 보내는 이유]
   AI 가 숫자를 지어내지 않게 하려면, 인용할 수 있는 값을 먼저 줘야 한다.
   서버 프롬프트에서 "여기 준 값만 쓰고 새 숫자를 만들지 마시오" 로 묶어야 한다.
   (BACKEND_REQUEST_1D.md 7번)

   [응답]
   { source: 'ai', question, text, updatedAt }

   ★ 서버가 없으면 AI_NOT_READY 를 던진다. 화면은 '연동 예정' 상태를 그대로 둔다.
     여기서 그럴듯한 문장을 지어내면 시연은 되지만, 그건 AI 가 한 말이 아니다. */

export async function askAi({ scope, question, context }) {
  if (USE_MOCK) throw new ApiError('AI_NOT_READY', null, 0)

  return request('/api/ai/advice', {
    method: 'POST',
    auth: true,
    body: { scope, question, context },
  })
}


/* ---------- policy ---------- */

/* POST /api/policy/recommend   (2026-08-01 응답 개편)

   요청  { residenceRegion, income, birthDate }
         ※ 필드명이 region → residenceRegion 으로 바뀌었다.
           예전 이름으로 보내면 서버가 null 로 받아 조건이 빠진다.

   응답  {
           policies: [{ policyId, name, category, description, status, link,
                        supportAmount, supportNote }],
           recommendation: { source, pick, headline, reasons[], alternative } | null
         }

   - policyName → name 으로 바뀜
   - eligibility 없어짐 → supportNote(계산 근거 한 줄)
   - aiReason(문자열) → recommendation(객체). 만들지 못하면 null 이 온다
   - supportAmount 는 모르면 null (지어낸 금액을 넣지 않기로 함)

   ※ 이 API 는 인증이 필요 없음 (SecurityConfig 에서 /api/policy/** 는 permitAll) */
export async function recommendPolicy({ residenceRegion, income, birthDate }) {
  if (USE_MOCK) {
    const { mockRecommendPolicy } = await import('./api.mock.js')
    return mockRecommendPolicy({ residenceRegion, income, birthDate })
  }

  return request('/api/policy/recommend', {
    method: 'POST',
    body: { residenceRegion, income, birthDate },
  })
}


/* ---------- forecast ---------- */

// POST /api/forecast/simulate — housingType 은 'JEONSE' | 'WOLSE'
export async function simulate({ region, housingType }) {
  if (USE_MOCK) {
    const { mockSimulate } = await import('./api.mock.js')
    return mockSimulate({ region, housingType })
  }

  return request('/api/forecast/simulate', {
    method: 'POST',
    body: { region, housingType },
    auth: true,
  })
}
