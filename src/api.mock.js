/* ============================================================
   KB 청년 자취 도우미 — 목(mock) 서버
   독립만세팀 / KB AI Challenge 2026

   백엔드 서버 없이 화면 전체를 눌러볼 수 있게 만든 가짜 응답 모음.
   api.js 의 USE_MOCK 이 true 일 때만 쓰인다.

   [원칙]
   실제 명세서와 '똑같은 모양' 으로만 응답한다. 성공 응답도, 에러 코드도.
   여기서 편하게 만들어두면 실제 서버로 바꿀 때 화면이 깨지기 때문에,
   불편한 부분(예: currentAsset 이 0 이라 예측이 427개월로 나오는 것)도 그대로 재현했다.

   ※ 이 파일은 백엔드 연동이 끝나면 지워도 되는 파일임.
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
}

// 미리 넣어둔 테스트 계정 — 로그인 화면에서 바로 쓸 수 있음
export const DEMO_ACCOUNT = { loginId: 'testUser', password: 'abcdefg!123' }


/* ---------- 마이데이터 mock (명세서의 mydata-mock.json 과 동일) ---------- */

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

// 월 총지출 = 변동비 + 고정비 (자산·부채 항목은 제외)
const SPENDING_KEYS = [
  'food', 'culture', 'shopping', 'etc',
  'fixedCostTransport', 'fixedCostTelecom', 'fixedCostInsurance',
  'fixedCostSubscription', 'fixedCostLoanInterest', 'fixedCostHousing',
]
const TOTAL_SPENDING = SPENDING_KEYS.reduce((s, k) => s + MYDATA[k], 0) // 1,680,000


/* ---------- 지역별 전세 보증금 (더미) ----------

   명세서 예시에 나온 두 곳은 실제 응답값을 그대로 씀.
     강남구 255,270,000 / 강북구 108,770,000
   나머지는 대략적인 시세 순서만 맞춘 가짜 값이다.
   실제 서버는 CSV 를 읽으므로 값이 다를 수 있음.                        */

const DEPOSIT_JEONSE = {
  강남구: 255270000, 서초구: 243100000, 송파구: 198400000, 용산구: 191700000,
  성동구: 175300000, 마포구: 168900000, 광진구: 161200000, 강동구: 152800000,
  양천구: 149500000, 영등포구: 146200000, 동작구: 141800000, 서대문구: 136400000,
  종로구: 134900000, 중구: 132600000, 성북구: 127300000, 동대문구: 124800000,
  관악구: 121500000, 강서구: 119700000, 구로구: 116300000, 노원구: 114900000,
  은평구: 113600000, 중랑구: 111200000, 금천구: 110400000, 도봉구: 109800000,
  강북구: 108770000,
}

// 중개보수 0.3% — 명세서 예시에서 역산한 값 (255,270,000 × 0.003 = 765,810)
const BROKERAGE_RATE = 0.003

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 실제 통신처럼 약간의 지연을 줌. 로딩 상태가 눈에 보이게 하려는 목적
const LATENCY = 450


/* ---------- auth ---------- */

export async function mockSignup({ loginId, password, email, name }) {
  await sleep(LATENCY)

  if (MOCK_DB.users.some((u) => u.loginId === loginId)) {
    throw new ApiError('AUTH_001', '이미 사용 중인 아이디입니다.', 409)
  }
  if (MOCK_DB.users.some((u) => u.email === email)) {
    throw new ApiError('AUTH_002', '이미 가입된 이메일입니다.', 409)
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
    throw new ApiError('AUTH_003', '아이디 또는 비밀번호가 올바르지 않습니다.', 401)
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
  return { ...MYDATA }
}


/* ---------- forecast ---------- */

export async function mockSimulate({ region, housingType }) {
  await sleep(LATENCY)

  const jeonse = DEPOSIT_JEONSE[region]
  if (!jeonse) {
    throw new ApiError('SIMULATION_001', '지원하지 않는 지역입니다.', 400)
  }
  if (MOCK_DB.monthlyIncome == null) {
    throw new ApiError('SIMULATION_002', '월 소득 정보가 등록되지 않았습니다.', 400)
  }

  // 월세는 보증금을 낮추고 매달 월세를 내는 구조로 환산
  const isJeonse = housingType === 'JEONSE'
  const deposit = isJeonse ? jeonse : Math.round((jeonse * 0.08) / 100000) * 100000
  const monthlyRent = isJeonse ? 0 : Math.round((jeonse * 0.0022) / 10000) * 10000

  const brokerageFee = Math.round(deposit * BROKERAGE_RATE)
  const requiredAmount = deposit + brokerageFee

  /* currentAsset 이 0 인 것은 실제 서버 응답과 같음.
     sync 의 자산 합계(18,000,000)와 연결되지 않은 상태라
     예측 개월 수가 크게 나온다. 백엔드에 확인 요청해둔 항목(BACKEND_REQUEST.md 8번) */
  const currentAsset = 0

  const monthlySavingCapacity = Math.max(MOCK_DB.monthlyIncome - TOTAL_SPENDING, 0)

  // 저축 여력이 0 이면 예측 불가 — 명세서의 두 번째 응답 예시와 같은 형태
  let estimatedMonths = null
  let predictedStartDate = null

  if (monthlySavingCapacity > 0) {
    estimatedMonths = Math.ceil((requiredAmount - currentAsset) / monthlySavingCapacity)

    // 오늘부터 N개월 뒤의 '말일'
    const now = new Date()
    const target = new Date(now.getFullYear(), now.getMonth() + estimatedMonths + 1, 0)
    const yyyy = target.getFullYear()
    const mm = String(target.getMonth() + 1).padStart(2, '0')
    const dd = String(target.getDate()).padStart(2, '0')
    predictedStartDate = `${yyyy}-${mm}-${dd}`
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
    isFallbackApplied: true,
    estimatedMonths,
    predictedStartDate,
  }
}
