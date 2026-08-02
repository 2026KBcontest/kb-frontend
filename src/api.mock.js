/* ============================================================
   KB 청년 자취 도우미 — 목(mock) 서버
   독립만세팀 / KB AI Challenge 2026

   백엔드 서버 없이 화면 전체를 눌러볼 수 있게 만든 가짜 응답 모음.
   api.js 의 USE_MOCK 이 true 일 때만 쓰인다.

   [원칙]
   실제 백엔드 코드(feature/forecast 브랜치)를 그대로 옮겼다.
   지역 시세는 seoul_housingfee_pergu.csv, 계산식은 ForecastService.java,
   검증 규칙은 SignupRequest.java 를 보고 맞췄음.

   편하게 만들지 않은 이유 — 목에서만 예쁘게 나오면 실제 서버로 바꿀 때 화면이 깨진다.
   그래서 순자산이 마이너스로 나오는 것도, 저축 여력을 소득 20% 로 추정하는 것도
   서버와 똑같이 재현했다.

   ※ 백엔드 연동이 끝나면 지워도 되는 파일임.
   ============================================================ */

import { ApiError } from './api.js'


/* ---------- 가짜 저장소 ---------- */

/* 새로고침하면 초기화됨. 매번 회원가입부터 다시 하지 않도록
   테스트용 계정 하나를 미리 넣어둠 */

/* [새로고침을 견디게 하는 이유]
   목 모드는 배포해서 링크로 보여줄 때 쓴다. 심사위원이 F5 를 누르면
   메모리에만 있던 가입 정보·마이데이터·분석 결과가 전부 날아가서
   홈이 빈 화면이 된다. 그래서 sessionStorage 에 함께 저장한다.

   sessionStorage 를 고른 이유 — 탭을 닫으면 지워져서 다음 사람이
   앞사람 데이터를 보지 않는다. 시연용으로는 이게 맞다. */

const MOCK_KEY = 'kb_mock_db'

const INITIAL_DB = {
  users: [
    {
      userId: '3a19cd0a-8912-4e83-8cce-8ddfe3426904',
      loginId: 'testUser',
      password: 'abcdefg!123',
      email: 'test@example.com',
      name: '홍길동',
      birthDate: '1999-04-11',
      gender: '남성',
      job: '직장인',
      residenceRegion: '서울특별시',
      phone: '010-1234-5678',
    },
  ],
  monthlyIncome: null, // PATCH /api/users/me/income 으로 채워짐
  monthlySavingGoal: null, // PATCH /api/users/me
  snapshot: null, // POST /api/mydata/sync 를 한 번이라도 했는지
  forecast: null, // POST /api/forecast/simulate 결과 (GET 으로 다시 꺼낼 수 있게)
  loginUserId: null, // 지금 로그인한 사용자 (GET /api/users/me 용)
}

function loadDb() {
  try {
    const raw = window.sessionStorage.getItem(MOCK_KEY)
    return raw ? { ...INITIAL_DB, ...JSON.parse(raw) } : { ...INITIAL_DB }
  } catch {
    return { ...INITIAL_DB }
  }
}

const MOCK_DB = loadDb()

// 값이 바뀔 때마다 부른다. 실패해도 화면은 계속 동작해야 하므로 조용히 넘어감
function saveDb() {
  try {
    window.sessionStorage.setItem(MOCK_KEY, JSON.stringify(MOCK_DB))
  } catch {
    /* 무시 */
  }
}

// 미리 넣어둔 테스트 계정 — 로그인 화면에서 바로 쓸 수 있음
export const DEMO_ACCOUNT = { loginId: 'testUser', password: 'abcdefg!123' }


/* ---------- 마이데이터 (mydata-mock.json 과 동일한 값) ---------- */

const MYDATA = {
  food: 350000,
  culture: 120000,
  shopping: 200000,
  etc: 80000,
  fixedCostTransport: 90000,
  fixedCostTelecom: 60000,
  fixedCostInsurance: 150000,
  fixedCostSubscription: 30000,
  fixedCostLoanInterest: 100000,
  fixedCostHousing: 500000,
  assetDeposit: 5000000,
  assetSaving: 3000000,
  assetInvestment: 10000000,
  assetLoan: 20000000,
  assetRemainingRepayment: 15000000,
  // 기존 대출의 매달 상환액(원금+이자). DSR 계산에 쓴다 (mydata-mock.json 과 같은 값)
  assetMonthlyRepayment: 350000,
  /* 마지막으로 연동한 시각. 서버 MyDataSnapshot.updatedAt 자리.
     '어제 연동해둔 계정' 을 흉내 내려고 일부러 과거 시각으로 둔다 —
     현재 시각을 넣으면 "방금 업데이트" 버그가 되살아나도 목에서는 안 보인다 */
  updatedAt: '2026-08-01T21:40:00',
}

// ForecastService.calculateTotalConsumption 과 같은 항목 구성
const CONSUMPTION_KEYS = [
  'food', 'culture', 'shopping', 'etc',
  'fixedCostTransport', 'fixedCostTelecom', 'fixedCostInsurance',
  'fixedCostSubscription', 'fixedCostLoanInterest', 'fixedCostHousing',
]


/* ---------- 지역별 시세 (seoul_housingfee_pergu.csv 실제 값) ----------

   CSV 는 만원 단위로 되어 있어서 원 단위로 바꿔 적었다.
   서버는 이 값을 그대로 읽으므로 목과 실제 응답의 금액이 같다.                */

const REGION_FEE = {
  서초구: { deposit: 286340000, rent: 740000 },
  중구: { deposit: 273020000, rent: 650000 },
  강남구: { deposit: 255270000, rent: 1010000 },
  용산구: { deposit: 241950000, rent: 830000 },
  광진구: { deposit: 241950000, rent: 710000 },
  종로구: { deposit: 235290000, rent: 540000 },
  영등포구: { deposit: 228630000, rent: 610000 },
  송파구: { deposit: 228630000, rent: 580000 },
  마포구: { deposit: 224190000, rent: 680000 },
  동작구: { deposit: 221970000, rent: 560000 },
  강동구: { deposit: 219750000, rent: 610000 },
  동대문구: { deposit: 219750000, rent: 740000 },
  성동구: { deposit: 219750000, rent: 860000 },
  중랑구: { deposit: 206430000, rent: 500000 },
  관악구: { deposit: 204210000, rent: 630000 },
  서대문구: { deposit: 201990000, rent: 580000 },
  강서구: { deposit: 197550000, rent: 610000 },
  양천구: { deposit: 197550000, rent: 650000 },
  금천구: { deposit: 193110000, rent: 610000 },
  성북구: { deposit: 184240000, rent: 650000 },
  은평구: { deposit: 175360000, rent: 630000 },
  구로구: { deposit: 170920000, rent: 470000 },
  노원구: { deposit: 146500000, rent: 430000 },
  도봉구: { deposit: 142060000, rent: 560000 },
  강북구: { deposit: 108770000, rent: 390000 },
}


/* ---------- ForecastService 의 상수 ---------- */

const WOLSE_FIXED_DEPOSIT = 10000000 // 월세는 보증금을 1천만원으로 고정
const BRACKET_LOW = 50000000
const BRACKET_HIGH = 100000000
const BRACKET_LOW_CAP = 200000
const BRACKET_MID_CAP = 300000
const SAVING_FALLBACK_RATE = 0.2 // 저축 여력을 못 구할 때 소득의 20% 로 추정

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const LATENCY = 450 // 로딩 상태가 눈에 보이게 하려는 지연


/* ---------- auth ---------- */

export async function mockSignup({
  loginId,
  password,
  email,
  name,
  birthDate,
  gender,
  job,
  residenceRegion,
  phone,
  agreements,
}) {
  await sleep(LATENCY)

  // SignupRequest 의 @Pattern / @Size 와 같은 규칙 (2026-08-01 개편 반영)
  if (!/^[a-zA-Z0-9]{4,20}$/.test(loginId)) {
    throw new ApiError('COMMON_001', '아이디는 영문 대소문자와 숫자 4~20자여야 합니다.', 400)
  }
  if (password.length < 10 || password.length > 22) {
    throw new ApiError('COMMON_001', '비밀번호는 10~22자여야 합니다.', 400)
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    throw new ApiError('COMMON_001', '비밀번호는 특수문자를 최소 1개 포함해야 합니다.', 400)
  }

  /* 새로 필수가 된 항목들. 서버가 @NotNull / @NotBlank 로 막는 것과 같게 검사한다.
     목이 더 느슨하면 목에서는 되는데 실서버에서 400 이 나는 상황이 생긴다 */
  if (!birthDate) throw new ApiError('COMMON_001', '생년월일은 필수입니다.', 400)
  if (!['남성', '여성'].includes(gender)) {
    throw new ApiError('COMMON_001', '성별 값이 올바르지 않습니다.', 400)
  }
  if (!['학생', '무직', '직장인'].includes(job)) {
    throw new ApiError('COMMON_001', '직업 값이 올바르지 않습니다.', 400)
  }
  if (!residenceRegion) throw new ApiError('COMMON_001', '거주지역은 필수입니다.', 400)
  if (!/^010-\d{4}-\d{4}$/.test(phone ?? '')) {
    throw new ApiError('COMMON_001', '휴대폰 번호 형식이 올바르지 않습니다.', 400)
  }
  if (!agreements?.privacyAgreed) {
    throw new ApiError('COMMON_001', '개인정보 처리방침에 동의해야 합니다.', 400)
  }
  if (!agreements?.mydataAgreed) {
    throw new ApiError('COMMON_001', '마이데이터 수집·이용에 동의해야 합니다.', 400)
  }

  if (MOCK_DB.users.some((u) => u.loginId === loginId)) {
    throw new ApiError('AUTH_001', '이미 사용 중인 아이디입니다.', 400)
  }
  if (MOCK_DB.users.some((u) => u.email === email)) {
    throw new ApiError('AUTH_002', '이미 가입된 이메일입니다.', 400)
  }

  const userId = crypto.randomUUID()
  MOCK_DB.users.push({
    userId, loginId, password, email, name,
    birthDate, gender, job, residenceRegion, phone,
  })
  saveDb()

  return { userId, message: '회원가입이 완료되었습니다.' }
}

export async function mockLogin({ loginId, password }) {
  await sleep(LATENCY)

  const user = MOCK_DB.users.find((u) => u.loginId === loginId && u.password === password)

  // 명세서대로 '아이디 없음' 과 '비밀번호 불일치' 를 같은 코드로 통일
  if (!user) {
    throw new ApiError('AUTH_003', '아이디 또는 비밀번호가 올바르지 않습니다.', 400)
  }

  MOCK_DB.loginUserId = user.userId // GET /api/users/me 에서 쓴다
  saveDb()

  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: { userId: user.userId, loginId: user.loginId, name: user.name },
  }
}


/* ---------- 조회 3종 (2026-08-01 백엔드 추가) ---------- */

/* GET /api/users/me
   서버는 회원 정보를 그대로 돌려준다. 목도 같은 필드 구성으로 맞춘다 */
export async function mockGetMe() {
  await sleep(LATENCY)

  const user =
    MOCK_DB.users.find((u) => u.userId === MOCK_DB.loginUserId) ?? MOCK_DB.users[0]
  if (!user) throw new ApiError('USER_001', '사용자 정보를 찾을 수 없습니다.', 404)

  return {
    loginId: user.loginId,
    name: user.name,
    email: user.email,
    monthlyIncome: MOCK_DB.monthlyIncome,
    monthlySavingGoal: MOCK_DB.monthlySavingGoal,
    birthDate: user.birthDate ?? null,
    residenceRegion: user.residenceRegion ?? null,
    gender: user.gender ?? null,
    job: user.job ?? null,
  }
}

/* GET /api/mydata
   연동한 적이 없으면 서버가 MYDATA_002 를 던진다. 목도 똑같이 던져야
   '아직 없음' 처리 흐름이 실서버와 같아진다 */
export async function mockGetMydata() {
  await sleep(LATENCY)
  if (!MOCK_DB.snapshot) {
    throw new ApiError('MYDATA_002', '마이데이터 연동 내역이 없습니다.', 404)
  }
  return { ...MOCK_DB.snapshot }
}

// PATCH /api/users/me — 보낸 필드만 갱신
export async function mockUpdateProfile(patch) {
  await sleep(LATENCY)

  const user = MOCK_DB.users.find((u) => u.userId === MOCK_DB.loginUserId) ?? MOCK_DB.users[0]
  if (!user) throw new ApiError('USER_001', '사용자 정보를 찾을 수 없습니다.', 404)

  // undefined 인 필드는 건드리지 않는다 (부분 수정)
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    // 저축 목표는 회원별이 아니라 DB 최상위에 둔다 (서버의 user 컬럼과 같은 역할)
    if (key === 'monthlySavingGoal') MOCK_DB.monthlySavingGoal = value
    else user[key] = value
  }
  saveDb()
  return mockGetMe()
}

// GET /api/forecast — 분석한 적이 없으면 SIMULATION_004
export async function mockGetForecast() {
  await sleep(LATENCY)
  if (!MOCK_DB.forecast) {
    throw new ApiError('SIMULATION_004', '저장된 시뮬레이션 결과가 없습니다.', 404)
  }
  return { ...MOCK_DB.forecast }
}


/* ---------- user ---------- */

export async function mockUpdateIncome(monthlyIncome) {
  await sleep(LATENCY)
  MOCK_DB.monthlyIncome = Number(monthlyIncome)
  saveDb()
  return null // 실제 API 도 응답 바디가 없음
}


/* ---------- mydata ---------- */

export async function mockSyncMydata() {
  await sleep(LATENCY + 400) // 연동은 조금 더 오래 걸리는 느낌으로
  MOCK_DB.snapshot = { ...MYDATA }
  saveDb()
  return { ...MYDATA }
}


/* ---------- forecast ---------- */

// ForecastService.calculateBrokerageFee 그대로 (구간별 요율 + 상한)
function brokerageFeeOf(deposit, monthlyRent) {
  const base = deposit + monthlyRent * 100
  const tx = base < BRACKET_LOW ? deposit + monthlyRent * 70 : base

  if (tx < BRACKET_LOW) return Math.min(Math.floor((tx * 5) / 1000), BRACKET_LOW_CAP)
  if (tx < BRACKET_HIGH) return Math.min(Math.floor((tx * 4) / 1000), BRACKET_MID_CAP)
  return Math.floor((tx * 3) / 1000)
}

export async function mockSimulate({ region, housingType }) {
  await sleep(LATENCY)

  const fee = REGION_FEE[region]
  if (!fee) {
    throw new ApiError('SIMULATION_001', '지원하지 않는 지역입니다.', 400)
  }
  if (MOCK_DB.monthlyIncome == null) {
    throw new ApiError('SIMULATION_002', '소득 정보가 없습니다.', 400)
  }

  const isJeonse = housingType === 'JEONSE'
  const deposit = isJeonse ? fee.deposit : WOLSE_FIXED_DEPOSIT
  const monthlyRent = isJeonse ? 0 : fee.rent

  const brokerageFee = brokerageFeeOf(deposit, monthlyRent)

  // 월세 2개월분을 초기 비용에 포함 (서버와 동일)
  const requiredAmount = deposit + monthlyRent * 2 + brokerageFee

  const snapshot = MOCK_DB.snapshot

  /* 순자산 = (예금 + 적금 + 투자) − (대출 + 남은 상환액)
     목 데이터로는 18,000,000 − 35,000,000 = −17,000,000 원이 된다.
     명세서 예시의 0 은 마이데이터 연동 전(스냅샷 없음) 상태였던 것 */
  /* 순자산 = 자산 − 남은 상환액
     2026-08-01 백엔드 수정 반영. 예전에는 최초 대출액(assetLoan)까지 빼서
     같은 빚을 두 번 차감했고, 순자산이 −1,700만원으로 나왔다 */
  const currentAsset = snapshot
    ? snapshot.assetDeposit + snapshot.assetSaving + snapshot.assetInvestment
      - snapshot.assetRemainingRepayment
    : 0

  /* 저축 여력. 스냅샷이 없거나 (소득 − 소비) 가 음수면 소득의 20% 로 추정하고
     isFallbackApplied 를 true 로 내린다. 즉 이 값은 '시세 추정' 이 아니라
     '저축 여력 추정' 을 뜻함 */
  let monthlySavingCapacity
  let isFallbackApplied

  if (!snapshot) {
    monthlySavingCapacity = Math.floor(MOCK_DB.monthlyIncome * SAVING_FALLBACK_RATE)
    isFallbackApplied = true
  } else {
    const raw = MOCK_DB.monthlyIncome - CONSUMPTION_KEYS.reduce((s, k) => s + snapshot[k], 0)
    if (raw < 0) {
      monthlySavingCapacity = Math.floor(MOCK_DB.monthlyIncome * SAVING_FALLBACK_RATE)
      isFallbackApplied = true
    } else {
      monthlySavingCapacity = raw
      isFallbackApplied = false
    }
  }

  let estimatedMonths = null
  let predictedStartDate = null

  if (currentAsset >= requiredAmount) {
    // 이미 목표 금액을 모은 상태
    estimatedMonths = 0
    predictedStartDate = isoDate(new Date())
  } else if (monthlySavingCapacity > 0) {
    estimatedMonths = Math.ceil((requiredAmount - currentAsset) / monthlySavingCapacity)

    // 서버는 LocalDate.now().plusMonths(n) — 오늘 '일자' 를 유지하고 달만 더함
    const now = new Date()
    const target = new Date(now.getFullYear(), now.getMonth() + estimatedMonths, now.getDate())
    predictedStartDate = isoDate(target)
  }

  const result = {
    region,
    housingType,
    deposit,
    monthlyRent,
    brokerageFee,
    requiredAmount,
    currentAsset,
    monthlySavingCapacity,
    isFallbackApplied,
    estimatedMonths,
    predictedStartDate,
    // 서버도 마지막 분석 시각을 함께 준다 (화면의 '마지막 분석일')
    updatedAt: new Date().toISOString(),
  }

  MOCK_DB.forecast = result // GET /api/forecast 로 다시 꺼낼 수 있게 보관
  saveDb()
  return result
}

function isoDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/* ---------- 금융상품 ---------- */

// GET /api/products — 실제 ProductController 가 주는 값과 같은 구성
export async function mockGetProducts() {
  await sleep(LATENCY)

  /* 실제 서버는 resources/data/kb_products.json 을 읽어서 준다.
     목도 같은 3건으로 맞춰둔다 — 목에서만 다른 상품이 나오면 화면 확인이 의미가 없다.
     적금·예금(SAVINGS)은 원본 파일에 아직 없어서 목에도 넣지 않는다. */
  const products = [
    {
      productId: 'KB-LOAN-002',
      name: 'KB 버팀목 전세자금대출 (정부연계)',
      category: 'LOAN',
      tag: '전세자금대출',
      target: '부부합산 연소득 5천만 원 이하 무주택 세대주',
      specs: [
        { label: '금리', value: '연 2.10~2.90%' },
        { label: '최대 한도', value: '2.2억원' },
        { label: '상환 기간', value: '10년 가정' },
      ],
      calc: { maxLimit: 220000000, minRate: 2.1, maxRate: 2.9, assumedYears: 10 },
      link: 'https://kbstar.com',
    },
    {
      productId: 'KB-LOAN-001',
      name: 'KB 청년 맞춤형 전세자금대출',
      category: 'LOAN',
      tag: '전세자금대출',
      target: '만 19세 이상 ~ 만 34세 이하 무주택 청년 (연소득 7천만 원 이하)',
      specs: [
        { label: '금리', value: '연 3.42~4.15%' },
        { label: '최대 한도', value: '2억원' },
        { label: '상환 기간', value: '10년 가정' },
      ],
      calc: { maxLimit: 200000000, minRate: 3.42, maxRate: 4.15, assumedYears: 10 },
      link: 'https://kbstar.com',
    },
    {
      productId: 'KB-LOAN-003',
      name: 'KB 내집마련 주택담보대출',
      category: 'LOAN',
      tag: '주택담보대출',
      target: '주택 구입 자금이 필요한 무주택자 또는 1주택자',
      specs: [
        { label: '금리', value: '연 3.85~4.80%' },
        { label: '최대 한도', value: '5억원' },
        { label: '상환 기간', value: '10년 가정' },
      ],
      calc: { maxLimit: 500000000, minRate: 3.85, maxRate: 4.8, assumedYears: 10 },
      link: 'https://kbstar.com',
    },
  ]

  /* 목에서는 recommendation 을 null 로 둔다.
     프론트가 '추천이 없을 때' 경로도 제대로 도는지 확인할 수 있어야 한다. */
  return { products, recommendation: null }
}


/* ---------- policy ---------- */

/* PolicyService 의 DB 미적재 시 fallback 목록과 같은 값.
   실제 서버는 온통청년 API 로 동기화한 DB 가 있으면 그걸 최대 4개까지 내려줌 */
/* 지역 시세 미리보기 — 실제 서버는 25개 구를 전부 준다.
   목에서는 화면 확인에 필요한 몇 개만 둔다 (금액은 서버 CSV 와 같은 값) */
export async function mockGetRegions() {
  await sleep(LATENCY)

  const cost = (deposit, monthlyRent) => {
    const base = deposit + monthlyRent * 100
    const tx = base < 50_000_000 ? deposit + monthlyRent * 70 : base
    const brokerageFee =
      tx < 50_000_000
        ? Math.min(Math.floor((tx * 5) / 1000), 200_000)
        : tx < 100_000_000
          ? Math.min(Math.floor((tx * 4) / 1000), 300_000)
          : Math.floor((tx * 3) / 1000)
    return {
      deposit,
      monthlyRent,
      brokerageFee,
      requiredAmount: deposit + monthlyRent * 2 + brokerageFee,
    }
  }

  const raw = [
    ['강남구', 255270000, 1010000],
    ['노원구', 146500000, 430000],
    ['도봉구', 142060000, 560000],
    ['강북구', 108770000, 390000],
    ['마포구', 224190000, 680000],
    ['은평구', 175360000, 630000],
  ]

  return {
    regions: raw.map(([region, deposit, rent]) => ({
      region,
      jeonse: cost(deposit, 0),
      wolse: cost(10_000_000, rent),
    })),
  }
}

/* 지역 변경 추천 — 실제 서버는 인접 구를 계산해서 준다.
   목은 노원구(전세) 기준 한 가지만 둔다. recommendation 은 rule 로 둬서
   프론트가 '조건 기반' 경로도 제대로 그리는지 확인할 수 있게 한다. */
export async function mockGetRegionOptions() {
  await sleep(LATENCY)

  return {
    current: {
      region: '노원구',
      housingType: 'JEONSE',
      requiredAmount: 146939500,
      estimatedMonths: 267,
    },
    candidates: [
      {
        region: '강북구',
        deposit: 108770000,
        monthlyRent: 0,
        requiredAmount: 109096310,
        savedAmount: 37843190,
        monthlyRentSaved: 0,
        estimatedMonths: 197,
        shortenMonths: 70,
      },
      {
        region: '성북구',
        deposit: 125200000,
        monthlyRent: 0,
        requiredAmount: 125539500,
        savedAmount: 21400000,
        monthlyRentSaved: 0,
        estimatedMonths: 228,
        shortenMonths: 39,
      },
      {
        region: '도봉구',
        deposit: 142060000,
        monthlyRent: 0,
        requiredAmount: 142486180,
        savedAmount: 4453320,
        monthlyRentSaved: 0,
        estimatedMonths: 259,
        shortenMonths: 8,
      },
    ],
    /* 대표 추천 — 서버는 picks 중 AI 칸을 먼저 고른다 (RegionSwitchService).
       그래서 여기서도 아래 picks 의 similar 칸과 같은 지역이어야 한다 */
    recommendation: {
      source: 'ai',
      pickRegion: '도봉구',
      headline: '도봉구는 지금과 지내는 결이 비슷해요',
      reasons: [
        '1호선·7호선이 그대로 이어져 환승 없이 다닐 수 있어요',
        '광화문까지 걸리는 시간이 5분 정도밖에 차이 나지 않아요',
        '초기 자금은 4,453,320원 적어요',
      ],
    },

    /* 성격이 다른 추천 묶음. cheapest·fastest 는 서버 계산, similar 만 AI 판단 */
    picks: [
      {
        kind: 'cheapest',
        label: '가장 저렴한 곳',
        source: 'rule',
        region: '강북구',
        headline: '강북구가 주변에서 가장 저렴해요',
        reasons: [
          '초기 자금이 37,843,190원 적게 들어요',
          '자취 시점은 70개월 빨라져요',
          '지금 목표 지역과 맞닿아 있는 구예요',
        ],
      },
      {
        /* 여건 판단과 그 이유는 AI 가 쓰고, 마지막 한 줄(① 보다 얼마를 더 내는지)은
           코드가 계산해서 덧붙인다. 이 칸은 ① 보다 비쌀 수밖에 없어서,
           대신 무엇을 얻는지와 함께 얼마를 더 내는지를 같이 보여줘야 비교가 된다. */
        kind: 'similar',
        label: '여건이 비슷한 곳',
        source: 'ai',
        region: '도봉구',
        headline: '도봉구는 지금과 지내는 결이 비슷해요',
        reasons: [
          '1호선·7호선이 그대로 이어져 환승 없이 다닐 수 있어요',
          '광화문까지 걸리는 시간이 5분 정도밖에 차이 나지 않아요',
          '강북구보다 초기 자금이 33,389,870원 더 필요해요',
        ],
      },
    ],
  }
}

export async function mockRecommendPolicy({ residenceRegion, income, birthDate }) {
  await sleep(LATENCY)

  /* 2026-08-01 응답 개편 반영 — 실제 PolicyService 가 주는 4건과 같은 구성.
     정책 이름은 name, 조건 문구는 supportNote, 추천은 recommendation 객체 */
  const policies = [
    {
      policyId: 'youth-rent-01',
      name: '서울시 청년 월세 지원',
      category: 'HOUSING',
      description: '청년층의 주거비 부담 완화를 위해 월세를 지원합니다.',
      status: '신청 가능',
      link: 'https://youth.seoul.go.kr',
      supportAmount: 2400000,
      supportNote: '월 20만원 × 12개월',
    },
    {
      policyId: 'youth-jeonse-02',
      name: '청년 버팀목 전세자금대출',
      category: 'LOAN',
      description: '무주택 청년 전세보증금 저리 대출 지원 서비스입니다.',
      status: '신청 가능',
      link: 'https://nhuf.molit.go.kr',
      supportAmount: null, // 대출은 지원금이 아니라서 null (지어내지 않음)
      supportNote: '대출 한도 우대 (최대 2억원)',
    },
    {
      policyId: 'youth-savings-03',
      name: '청년도약계좌 정부기여금',
      category: 'SAVINGS',
      description: '만기 5년 동안 매월 납입금에 비례해 정부기여금을 지원합니다.',
      status: '조건 확인 필요',
      link: 'https://kinfa.or.kr',
      supportAmount: 1440000,
      supportNote: '최대 월 2.4만원 × 60개월',
    },
    {
      policyId: 'youth-transport-04',
      name: 'K-패스 청년 대중교통비 환급',
      category: 'TRANSPORT',
      description: '대중교통 이용 금액의 30%를 적립 및 환급해 드립니다.',
      status: '신청 가능',
      link: 'https://korea-pass.kr',
      supportAmount: 360000,
      supportNote: '월 평균 3만원 환급 기준',
    },
  ]

  /* 서버 PolicyService 와 같은 필터를 건다 (2026-08-01).
     목에서만 4건이 다 나오면, 서버가 지역·나이로 거른다는 사실을 화면에서 확인할 수 없다.

       - 서울시 사업은 서울 거주자만
       - 버팀목·청년도약계좌는 만 19~34세
       - 청년 정책 공통 연령 만 19~39세 */
  const age = birthDate ? Math.floor((Date.now() - new Date(birthDate)) / 31557600000) : null

  const matched = policies.filter((p) => {
    if (age != null && (age < 19 || age > 39)) return false
    if (p.policyId === 'youth-rent-01' && residenceRegion && !residenceRegion.startsWith('서울')) {
      return false
    }
    if (age != null && age > 34 && ['youth-jeonse-02', 'youth-savings-03'].includes(p.policyId)) {
      return false
    }
    return true
  })

  /* 서버는 AI 가 만든 recommendation 을 주기로 되어 있다.
     목에서는 null 로 둬서, 프론트가 조건 기반으로 대체하는 경로도 테스트되게 한다.
     (AI 실패 시 서버도 null 을 주기로 했으므로 이 경로는 실제로 쓰인다) */
  return { policies: matched, recommendation: null }
}
