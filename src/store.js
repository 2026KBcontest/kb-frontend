/* ============================================================
   KB 청년 자취 도우미 — 화면 간 데이터 보관소
   독립만세팀 / KB AI Challenge 2026

   [무엇을 하는 파일인가]
   서버에서 받아온 값을 화면 간에 나르고, 다시 그릴 때 흰 화면이 보이지 않게
   sessionStorage 에 사본을 남겨둔다.

   2026-08-01 백엔드에 조회 API 3개가 생기면서 성격이 바뀌었다.

     이전   여기 담긴 값이 유일한 원본 (새로고침하면 날아감)
     지금   서버가 원본, 여기 있는 건 사본 (useAppData 가 매번 서버와 맞춤)

     GET /api/users/me    이름·이메일·소득·생년월일·지역·성별·직업
     GET /api/mydata      마지막 연동 결과
     GET /api/forecast    마지막 분석 결과

     PATCH /api/users/me  월 저축 목표 등 프로필 수정

   [아직 서버에 자리가 없어 여기에만 있는 값]
     checks        체크리스트 표시   (표시용이라 서버에 둘 필요 없음)
     policySupport 정책 지원 금액    (policy API 가 금액을 주면 채워짐)
   ============================================================ */

import { useEffect, useState } from 'react'

const KEY = 'kb_app_data'

const EMPTY = {
  mydata: null,      // POST /api/mydata/sync 응답
  forecast: null,    // POST /api/forecast/simulate 응답
  monthlyIncome: null, // 사용자가 입력한 월 소득 (원 단위)

  /* 회원가입에서 받았지만 서버가 아직 안 받는 5개 항목.
     정책 추천은 지역·생년월일이 있어야 조건을 맞출 수 있어서 여기 담아둔다.
     signup 이 이 필드들을 받게 되면 이 자리는 지우고 GET /api/users/me 로 대체 */
  profile: null, // { birthDate, gender, job, residenceRegion, phone }
  me: null,      // GET /api/users/me 응답 (loginId·name·email 등)

  /* 사용자가 스스로 정한 월 저축 목표 (원).
     서버의 monthlySavingCapacity(소득 − 지출)는 '가능한 최대치' 이고
     이건 '실제로 모으기로 한 금액' 이라 다른 값이다.
     2026-08-01 부터 user.monthly_saving_goal 컬럼에 저장된다 */
  savingGoal: null,

  /* 정책으로 받을 수 있는 지원 금액 (원).
     지금 policy API 는 정책 '목록' 만 주고 금액을 주지 않아서 항상 비어 있다.
     금액이 내려오기 시작하면 Policy 화면에서 합계를 여기에 담고,
     자금조달 설계의 '지원금' 칸이 자동으로 채워진다. */
  policySupport: null,
  syncedAt: null,    // 마이데이터를 마지막으로 불러온 시각 (ISO)
  analyzedAt: null,  // 자취 분석을 마지막으로 실행한 시각 (ISO)

  /* 지역 변경 추천 (GET /api/forecast/region-options 결과).
     자취 시뮬레이션 화면에서 받아서 담아두고, 홈 카드가 그걸 그대로 읽는다.
     홈에서 또 부르면 같은 답을 받으려고 AI 호출이 한 번 더 나간다. */
  regionOptions: null,

  /* 자금조달 설계에서 고른 대출 상품.
     { name, amount, rate, years, own, support, source } 형태.

     홈의 '대출 활용 시' 칸이 이 값을 읽는다. 화면을 넘어가도 남아야 해서
     여기 담아두는 것 — FundingPlan 의 useState 는 화면을 나가면 사라진다.
     서버에는 아직 저장할 자리가 없다 (user 테이블에 컬럼 없음). */
  fundingPlan: null,

  /* 체크리스트 — '그 화면에서 실제로 해봤는지' 를 기록한다.
     { policy: "2026-07-31T13:20:00.000Z", funding: ... } 형태.

     마이데이터·소득·시뮬레이션은 결과 데이터가 남아서 그걸로 판단할 수 있지만,
     정책 조회처럼 남는 데이터가 없는 항목은 따로 표시해두지 않으면 알 수 없다. */
  checks: {},
}

function read() {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    const data = raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY }
    // checks 가 없던 시절에 저장된 값이 남아 있을 수 있어 항상 객체로 맞춰준다
    return { ...data, checks: data.checks ?? {} }
  } catch {
    return { ...EMPTY, checks: {} } // 저장값이 깨져 있으면 빈 상태로
  }
}

function write(next) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* 저장 공간이 없어도 화면은 계속 동작해야 하므로 무시 */
  }
}


/* ---------- 읽기 ---------- */

export const getAppData = () => read()


/* ---------- 서버에서 다시 받아오기 (2026-08-01 조회 API 추가) ---------- */

/* [무엇이 달라졌나]
   전에는 화면에서 받은 값을 브라우저에 담아두는 게 유일한 방법이었다.
   조회 API 3개가 생기면서 이제 서버가 원본이 되고, 여기 저장하는 값은 '사본' 이다.

     서버에 있는 것   회원 정보 · 마이데이터 · 분석 결과
     브라우저만 있는 것  월 저축 목표 · 체크리스트 표시 (아직 컬럼이 없음)

   [사본을 남겨두는 이유]
   화면을 열자마자 흰 화면이 보이지 않게 하려고. 먼저 사본으로 그리고,
   서버 응답이 오면 그 값으로 바꾼다. 서버가 응답하면 사본은 항상 덮어쓴다.

   [에러를 성공처럼 다루는 부분]
   '아직 연동 안 함(MYDATA_002)' 과 '아직 분석 안 함(SIMULATION_004)' 은
   실패가 아니라 상태다. 그때는 값을 비우고 넘어간다. */

export async function hydrateFromServer() {
  const { getMe, getMydata, getForecast } = await import('./api.js')

  const [me, mydata, forecast] = await Promise.allSettled([
    getMe(),
    getMydata(),
    getForecast(),
  ])

  const prev = read()
  const next = { ...prev }

  if (me.status === 'fulfilled' && me.value) {
    const v = me.value
    next.monthlyIncome = v.monthlyIncome ?? null
    next.savingGoal = v.monthlySavingGoal ?? null // 서버 값이 원본
    next.profile = {
      birthDate: v.birthDate ?? null,
      gender: v.gender ?? null,
      job: v.job ?? null,
      residenceRegion: v.residenceRegion ?? null,
      // 서버 응답에 phone 이 없으면 기존 값을 유지 (지우지 않는다)
      phone: v.phone ?? prev.profile?.phone ?? null,
    }
    next.me = v // 이름·이메일 등 화면에서 바로 쓰는 원본
  }

  /* 실패를 두 갈래로 나눈다.

       '아직 안 함'   MYDATA_002 / SIMULATION_004  → 서버에 정말 없음. null 로 비운다
       '못 물어봄'    NETWORK · NO_TOKEN · 500 …   → 있는지 없는지 모름. 사본을 유지한다

     전에는 둘을 똑같이 null 로 덮고 그 상태를 sessionStorage 에 써버렸다.
     백엔드가 잠깐 안 떠 있을 때 홈에 들어가면 "마이데이터를 연결하면…" 으로 바뀌고,
     그게 저장돼서 서버가 다시 떠도 화면이 빈 채로 남았다. */
  const settle = (r, emptyCode, prevValue) => {
    if (r.status === 'fulfilled') return r.value
    const code = r.reason?.errorCode // ApiError 는 errorCode 로 담는다 (api.js)
    if (code === emptyCode) return null // 진짜로 아직 안 한 것
    console.warn(
      `[store] ${emptyCode === 'MYDATA_002' ? 'GET /api/mydata' : 'GET /api/forecast'} 실패 (${code ?? '알 수 없음'}) — ` +
        '서버에 값이 없는 건지 확인이 안 돼서 이전 값을 그대로 씁니다.',
      r.reason,
    )
    return prevValue ?? null
  }

  next.mydata = settle(mydata, 'MYDATA_002', prev.mydata)

  /* 분석 결과에도 순자산 보정을 한 번 통과시킨다.
     백엔드가 2026-08-01 에 고쳐서 지금은 아무 일도 하지 않지만,
     예전 버전 서버에 붙었을 때 화면 숫자가 어긋나지 않게 남겨둔다.
     (조건이 정확히 일치할 때만 동작하므로 고쳐진 서버에서는 자동으로 꺼진다) */
  const rawForecast = settle(forecast, 'SIMULATION_004', prev.forecast)
  if (rawForecast) {
    const { fixForecast } = await import('./analysis.js')
    next.forecast = fixForecast(rawForecast, next.mydata)

    /* 마지막 분석 시각도 서버 값으로 되살린다.
       analyzedAt 은 원래 이 브라우저에서 분석을 돌렸을 때만 기록됐다.
       그래서 다른 기기나 새 로그인으로 들어오면 분석 결과는 있는데
       '마지막 분석일' 칸만 비어 있는 상태가 됐다. */
    next.analyzedAt = rawForecast.updatedAt ?? prev.analyzedAt ?? null
  } else {
    next.forecast = null
    next.analyzedAt = null // 분석 결과가 없으면 시각도 남겨두지 않는다
  }

  /* 마지막 연동 시각 — 서버 값(MyDataSnapshot.updatedAt)이 원본이다.

     잠깐 '값이 없으면 현재 시각을 넣는' 코드를 뒀었는데, 그러면 며칠 전에 연동해둔 계정도
     다시 로그인할 때마다 "방금 업데이트" 로 보였다. 모르면 비워두는 게 맞고,
     실제로는 서버가 알고 있었으므로 DTO 에 updatedAt 을 추가해 받아온다.
     옛 서버에 붙어 응답에 updatedAt 이 없으면 이 브라우저에서 sync 를 돌린 시각을 쓴다. */
  next.syncedAt = next.mydata?.updatedAt ?? (next.mydata ? prev.syncedAt : null)

  write(next)
  return next
}

/* 화면에서 쓰는 훅.
   처음에는 브라우저 사본으로 그리고, 서버 응답이 오면 그 값으로 바꾼다.

     const [data, loading] = useAppData()                                  */
export function useAppData() {
  const [data, setData] = useState(() => read())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    hydrateFromServer()
      .then((next) => {
        if (alive) setData(next)
      })
      .catch(() => {
        /* 서버가 꺼져 있거나 토큰이 없는 경우.
           이미 사본으로 그려져 있으므로 화면을 비우지 않는다 */
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [])

  return [data, loading]
}


/* ---------- 쓰기 ---------- */

export function saveMydata(snapshot) {
  /* 방금 sync 한 직후라 서버 updatedAt 이 곧 지금이다.
     응답에 있으면 그걸 쓰고(서버 시계 기준), 없으면 이 브라우저 시각으로 대신한다 */
  const next = {
    ...read(),
    mydata: snapshot,
    syncedAt: snapshot?.updatedAt ?? new Date().toISOString(),
  }
  write(next)
  return next
}

/* 분석 결과 저장.

   [분석에 쓴 소득을 함께 남기는 이유]
   forecast.monthlySavingCapacity 는 '소득 − 지출' 로 서버가 계산해서 준 값이다.
   그런데 마이데이터 관리에서 월 소득만 바꾸면 forecast 는 그대로 남는다.
   그러면 저축 플랜 화면이 옛 소득으로 계산된 금액을 "지금 소득으로는 매달 ○○원"
   이라며 보여준다. 실제보다 많이 모을 수 있다고 잘못 안내하는 방향이라,
   금융 화면에서는 그냥 안 바뀌는 것보다 나쁘다.

   그 어긋남을 화면이 알아채려면 분석 당시 소득을 기억해둬야 한다. */
export function saveForecast(result) {
  const prev = read()
  const next = {
    ...prev,
    forecast: result,
    analyzedAt: new Date().toISOString(),
    incomeAtAnalysis: prev.monthlyIncome ?? null,
  }
  write(next)
  return next
}

export function saveProfile(profile) {
  const next = { ...read(), profile }
  write(next)
  return next
}

/* 체크리스트 한 칸을 완료로 표시.
   화면에서 그 일을 실제로 해냈을 때만 부른다 (버튼을 누르는 것만으로는 부르지 않음) */
export function markCheck(key) {
  const prev = read()
  const next = { ...prev, checks: { ...prev.checks, [key]: new Date().toISOString() } }
  write(next)
  return next
}

/* 월 저축 목표 저장.
   2026-08-01 백엔드에 monthly_saving_goal 컬럼이 생겨서 서버에도 함께 보낸다.
   서버 저장이 실패해도 이번 세션에서는 쓸 수 있게 사본을 먼저 갱신한다.

   [실패를 삼키지 않는다]
   전에는 catch 를 비워두고 무조건 성공한 것처럼 돌려줬다. 그래서 백엔드가 잠깐 죽어 있으면
   화면은 '✓ 저장됨' 이라고 말해놓고 다음 로그인에 목표가 사라졌다.
   사용자가 다시 입력할 기회를 잃는 게 문제라, 실패했다는 사실을 호출한 쪽에 넘긴다. */
export async function saveSavingGoal(amount) {
  const value = amount == null ? null : Number(amount)
  const next = { ...read(), savingGoal: value }
  write(next)

  try {
    const { updateProfile } = await import('./api.js')
    await updateProfile({ monthlySavingGoal: value })
    return { data: next, saved: true }
  } catch (err) {
    return { data: next, saved: false, error: err }
  }
}

export function savePolicySupport(amount) {
  const next = { ...read(), policySupport: amount == null ? null : Number(amount) }
  write(next)
  return next
}

export function saveIncome(amount) {
  const next = { ...read(), monthlyIncome: Number(amount) }
  write(next)
  return next
}

/* ---------- 마지막으로 보던 화면 ---------- */

/* 새로고침하면 App 이 처음 화면부터 다시 시작한다.
   토큰은 남아 있는데 화면만 홍보 페이지로 돌아가서, 시연 중 F5 를 누르면
   회원가입부터 다시 해야 했다. 그래서 화면 키를 따로 기억해둔다.

   데이터와 다른 키를 쓰는 이유 — 로그아웃 시 데이터는 지워야 하지만
   화면 복구는 토큰 유무로 판단하는 게 더 안전해서 관심사를 나눴다. */

const PAGE_KEY = 'kb_last_page'

// 로그인 이후 화면만 복구 대상. 가입 도중 화면은 중간부터 시작하면 이상해짐
const RESTORABLE = ['home', 'mydataManage', 'forecast', 'policy', 'mypage', 'savingPlan', 'fundingPlan']

export function saveLastPage(page) {
  try {
    if (RESTORABLE.includes(page)) window.sessionStorage.setItem(PAGE_KEY, page)
  } catch {
    /* 무시 */
  }
}

export function getLastPage() {
  try {
    const page = window.sessionStorage.getItem(PAGE_KEY)
    return RESTORABLE.includes(page) ? page : null
  } catch {
    return null
  }
}


/* 로그아웃 시 함께 비움 (다음 사용자에게 이전 값이 보이면 안 됨)

   정책 캐시(Policy.jsx 의 kb_policy_cache)도 같이 지운다. 전에는 이것만 남아서,
   재로그인하면 정책 화면에는 이전 사용자의 목록이 그대로 뜨는데 홈 체크리스트와
   자금조달 설계는 비어 있는 상태가 됐다. 캐시 키에 사용자 구분도 없다. */
const POLICY_CACHE_KEY = 'kb_policy_cache'

export function clearAppData() {
  try {
    window.sessionStorage.removeItem(KEY)
    window.sessionStorage.removeItem(PAGE_KEY)
    window.sessionStorage.removeItem(POLICY_CACHE_KEY)
  } catch {
    /* 무시 */
  }
}


/* 자금조달 설계에서 고른 대출 상품을 담아둔다.
   '상품 넣어보기' 를 눌렀을 때 저장하고, '대출 없이 보기' 면 null 로 지운다.
   홈의 자취 시점 예측이 이 값으로 '대출 활용 시' 칸을 채운다. */
export function saveFundingPlan(plan) {
  const next = { ...read(), fundingPlan: plan ?? null }
  write(next)
  return next
}


/* 지역 변경 추천 결과를 담아둔다. 자취 시뮬레이션 화면이 받아서 넣고,
   홈 화면의 '추천 지역' 카드가 이 값을 읽는다. */
export function saveRegionOptions(options) {
  write({ ...read(), regionOptions: options ?? null })
}
