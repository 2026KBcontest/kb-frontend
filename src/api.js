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

  // 서버에 닿지 못한 경우 (errorCode 가 없어서 프론트에서 붙이는 코드)
  NETWORK: '서버에 연결할 수 없어요. 백엔드 서버가 실행 중인지 확인해주세요.',
}

export class ApiError extends Error {
  constructor(errorCode, message, status) {
    // 서버가 준 message 를 우선 쓰고, 없으면 코드별 기본 문구로 대체
    super(message || ERROR_TEXT[errorCode] || '알 수 없는 오류가 발생했어요.')
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
    if (token) finalHeaders.Authorization = `Bearer ${token}`
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
    // 에러 바디가 JSON 이 아닐 수도 있으므로 실패해도 넘어가게 함
    let payload = {}
    try {
      payload = await res.json()
    } catch {
      /* 본문 없음 */
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

// POST /api/auth/signup — 인증 불필요
export async function signup({ loginId, password, email, name }) {
  if (USE_MOCK) {
    const { mockSignup } = await import('./api.mock.js')
    return mockSignup({ loginId, password, email, name })
  }

  return request('/api/auth/signup', {
    method: 'POST',
    body: { loginId, password, email, name },
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


/* ---------- policy ---------- */

/* POST /api/policy/recommend

   응답이 단건 → 배열로 개편됨.
   { policies: [{ policyId, policyName, description, eligibility, status, link }], aiReason }

   status 는 '신청 가능' / '조건 확인 필요' 두 값만 오고, 그대로 뱃지로 표시하면 됨.
   요청 파라미터는 region(시·도) / income(원 단위) / birthDate(YYYY-MM-DD) 3개.

   ※ 이 API 는 인증이 필요 없음 (SecurityConfig 에서 /api/policy/** 는 permitAll) */
export async function recommendPolicy({ region, income, birthDate }) {
  if (USE_MOCK) {
    const { mockRecommendPolicy } = await import('./api.mock.js')
    return mockRecommendPolicy({ region, income, birthDate })
  }

  return request('/api/policy/recommend', {
    method: 'POST',
    body: { region, income, birthDate },
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
