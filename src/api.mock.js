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

const MOCK_DB = {
  users: [
    {
      userId: '3a19cd0a-8912-4e83-8cce-8ddfe3426904',
      loginId: 'testUser',
      password: 'abcdefg!123',
      email: 'test@example.com',
      name: '홍길동',
    },
  ],
  monthlyIncome: null, // PATCH /api/users/me/income 으로 채워짐
  snapshot: null, // POST /api/mydata/sync 를 한 번이라도 했는지
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

export async function mockSignup({ loginId, password, email, name }) {
  await sleep(LATENCY)

  // SignupRequest 의 @Pattern / @Size 와 같은 규칙
  if (!/^[a-zA-Z]{4,20}$/.test(loginId)) {
    throw new ApiError('COMMON_001', '아이디는 영문 대소문자 4~20자여야 합니다.', 400)
  }
  if (password.length < 10 || password.length > 22) {
    throw new ApiError('COMMON_001', '비밀번호는 10~22자여야 합니다.', 400)
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    throw new ApiError('COMMON_001', '비밀번호는 특수문자를 최소 1개 포함해야 합니다.', 400)
  }

  if (MOCK_DB.users.some((u) => u.loginId === loginId)) {
    throw new ApiError('AUTH_001', '이미 사용 중인 아이디입니다.', 400)
  }
  if (MOCK_DB.users.some((u) => u.email === email)) {
    throw new ApiError('AUTH_002', '이미 가입된 이메일입니다.', 400)
  }

  const userId = crypto.randomUUID()
  MOCK_DB.users.push({ userId, loginId, password, email, name })

  return { userId, message: '회원가입이 완료되었습니다.' }
}

export async function mockLogin({ loginId, password }) {
  await sleep(LATENCY)

  const user = MOCK_DB.users.find((u) => u.loginId === loginId && u.password === password)

  // 명세서대로 '아이디 없음' 과 '비밀번호 불일치' 를 같은 코드로 통일
  if (!user) {
    throw new ApiError('AUTH_003', '아이디 또는 비밀번호가 올바르지 않습니다.', 400)
  }

  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: { userId: user.userId, loginId: user.loginId, name: user.name },
  }
}


/* ---------- user ---------- */

export async function mockUpdateIncome(monthlyIncome) {
  await sleep(LATENCY)
  MOCK_DB.monthlyIncome = Number(monthlyIncome)
  return null // 실제 API 도 응답 바디가 없음
}


/* ---------- mydata ---------- */

export async function mockSyncMydata() {
  await sleep(LATENCY + 400) // 연동은 조금 더 오래 걸리는 느낌으로
  MOCK_DB.snapshot = { ...MYDATA }
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
  const currentAsset = snapshot
    ? snapshot.assetDeposit + snapshot.assetSaving + snapshot.assetInvestment
      - (snapshot.assetLoan + snapshot.assetRemainingRepayment)
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

  return {
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
  }
}

function isoDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/* ---------- policy ---------- */

/* PolicyService 의 DB 미적재 시 fallback 목록과 같은 값.
   실제 서버는 온통청년 API 로 동기화한 DB 가 있으면 그걸 최대 4개까지 내려줌 */
export async function mockRecommendPolicy({ region, income, birthDate }) {
  await sleep(LATENCY)

  return {
    policies: [
      {
        policyId: 'jeonse-loan',
        policyName: '청년 버팀목 전세자금대출',
        description: '최대 1.2억원 대출 가능',
        eligibility: '만 19~34세 / 연소득 5천만원 이하',
        status: '신청 가능',
        link: 'https://nhuf.molit.go.kr/',
      },
      {
        policyId: 'monthly-rent',
        policyName: '서울시 청년 월세 지원',
        description: '월 최대 20만원 × 12개월',
        eligibility: '만 19~39세 / 중위소득 150% 이하',
        status: '조건 확인 필요',
        link: 'https://youth.seoul.go.kr/',
      },
    ],
    aiReason:
      '현재 연령·소득 조건 및 자취 목표를 종합 고려할 때 맞춤 정책을 우선 신청하는 것이 유리합니다.',
  }
}
