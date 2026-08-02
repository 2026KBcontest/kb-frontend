/* ============================================================
   KB 청년 자취 도우미 — 자취 목표 설정 & AI 분석 (시나리오 ③)
   독립만세팀 / KB AI Challenge 2026

   마이데이터(Mydata.jsx) 다음 화면.
   희망 지역과 계약 방식을 고르고 [AI 분석 시작] 을 누르면
   POST /api/forecast/simulate 로 필요 금액과 자취 가능 시점을 받아온다.

   ※ 소득이 저장돼 있지 않으면 서버가 SIMULATION_002 를 돌려줌.
     그래서 이 화면은 마이데이터 화면을 지난 뒤에만 들어올 수 있게 되어 있음.

   ※ 시나리오 ③ 에는 지도 핀 선택 / 목표 보증금 / 입주 희망 시기 / 대출 의향도 있는데,
     현재 simulate API 가 받는 값은 region 과 housingType 두 개뿐임.
     나머지는 백엔드에 요청해둔 상태라 화면에 아직 넣지 않았음.
   ============================================================ */

import { useEffect, useRef, useState } from 'react'
import { simulate, getRegions, getRegionOptions, ApiError } from './api.js'
import { saveForecast, saveRegionOptions, useAppData } from './store.js'
import { fixForecast } from './analysis.js'


/* ---------- 진행 단계 ---------- */

const STEPS = ['회원가입', '마이데이터 연결', '자취 목표 설정', 'AI 분석']


/* ---------- 선택 항목 ---------- */

// 백엔드 CSV 에 있는 서울 25개 자치구. 이름이 정확히 일치해야 함 (SIMULATION_001)
const SEOUL_GU = [
  '강남구', '강동구', '강북구', '강서구', '관악구',
  '광진구', '구로구', '금천구', '노원구', '도봉구',
  '동대문구', '동작구', '마포구', '서대문구', '서초구',
  '성동구', '성북구', '송파구', '양천구', '영등포구',
  '용산구', '은평구', '종로구', '중구', '중랑구',
]

const HOUSING_TYPES = [
  { value: 'JEONSE', label: '전세', desc: '보증금만 내고 월세 없음' },
  { value: 'WOLSE', label: '월세', desc: '보증금 + 매달 월세' },
]

// 시나리오 ③ 의 'AI 가 실시간으로 계산하는 연출'
const LOADING_STEPS = [
  '마이데이터에서 소비 패턴을 읽고 있어요',
  '선택한 지역의 전월세 시세를 확인하고 있어요',
  '저축 속도로 자취 가능 시점을 계산하고 있어요',
]

const STEP_MS = 700 // 문구 하나가 보이는 시간
const MIN_LOADING_MS = LOADING_STEPS.length * STEP_MS


/* ---------- 표시용 변환 ---------- */

const won = (n) => `${Number(n ?? 0).toLocaleString('ko-KR')}원`

// 427 → '35년 7개월' (12개월 미만이면 '개월' 만)
function monthsText(months) {
  if (months == null) return null
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}개월`
  if (m === 0) return `${y}년`
  return `${y}년 ${m}개월`
}

// '2062-02-28' → '2062년 2월'
function dateText(iso) {
  if (!iso) return null
  const [y, m] = iso.split('-')
  return `${y}년 ${Number(m)}월`
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))


/* ---------- 공통 조각 ---------- */

function Stepper({ current }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const isDone = i < current
        const isNow = i === current

        return (
          <li key={label} className="flex items-center gap-2 min-w-0">
            <span
              className={`shrink-0 grid place-items-center w-[26px] h-[26px] rounded-full text-[13px] font-bold ${
                isNow
                  ? 'bg-kb-brownDark text-white'
                  : isDone
                    ? 'bg-kb-yellow text-kb-brownDark'
                    : 'bg-line text-ink-300'
              }`}
            >
              {isDone ? '✓' : i + 1}
            </span>

            <span
              className={`text-[13px] whitespace-nowrap ${
                isNow ? 'font-bold text-kb-brownDark' : 'text-ink-500'
              }`}
            >
              {label}
            </span>

            {i < STEPS.length - 1 && (
              <span className="hidden sm:block w-6 h-px bg-line shrink-0" aria-hidden />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* right : 제목 오른쪽 보조 문구 (예: "노원구 · 전세 기준")
   금액만 크게 있으면 어느 조건으로 나온 값인지 알 수 없어서, 기준을 제목 줄에 붙인다 */
function GroupTitle({ title, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h3 className="flex items-center gap-2.5 text-[16px] font-bold text-kb-brownDark">
        <span className="w-[3px] h-[16px] rounded-full bg-kb-yellow" aria-hidden />
        {title}
      </h3>
      {right && <span className="text-[14px] font-semibold text-ink-500">{right}</span>}
    </div>
  )
}

// 금액 한 줄
function Row({ label, amount, strong }) {
  return (
    <li className="flex items-center justify-between gap-3 py-[7px]">
      <span className={`text-[14px] ${strong ? 'font-bold text-kb-brownDark' : 'text-ink-700'}`}>
        {label}
      </span>
      <span
        className={`tabular-nums ${
          Number(amount ?? 0) < 0
            ? 'text-[14px] font-semibold text-danger'
            : strong
              ? 'text-[16px] font-bold text-kb-brownDark'
              : 'text-[14px] font-semibold text-ink-900'
        }`}
      >
        {won(amount)}
      </span>
    </li>
  )
}

const CARD_SHADOW = { boxShadow: '0 6px 24px -8px rgba(74, 68, 59, 0.28)' }


/* ---------- 자취 목표 설정 화면 ---------- */

export default function Forecast({ onNext, onBack, onGoMydata }) {
  /* 마이데이터를 불러온 적이 있는지 (없으면 서버가 자산 0 · 저축 여력 추정으로 계산함)

     useAppData 로 받는다. 전에는 getAppData() 로 렌더 시점에 한 번만 동기로 읽었는데,
     그러면 서버 응답을 영원히 기다리지 않는다. 새 탭이나 재로그인처럼 브라우저 사본이
     비어 있는 상태에서는 마이데이터가 서버에 멀쩡히 있는데도
     "아직 연결하지 않았어요" 경고가 떴다 — 화면이 사실과 다른 말을 한 것이다. */
  const [appData] = useAppData()
  const hasMydata = Boolean(appData.mydata)

  const [region, setRegion] = useState('')
  const [housingType, setHousingType] = useState('JEONSE')

  /* 지역별 시세 — 고르는 순간 "이 동네가 대략 얼마인지" 를 옆에 보여준다.
     분석을 눌러야만 금액을 알 수 있으면, 감이 없는 사용자는 아무 구나 찍게 된다.
     실패하면 미리보기만 안 뜨고 분석 기능은 그대로 동작한다. */
  const [regionFees, setRegionFees] = useState({})
  useEffect(() => {
    getRegions()
      .then((res) => {
        const map = {}
        for (const item of res.regions ?? []) map[item.region] = item
        setRegionFees(map)
      })
      .catch(() => setRegionFees({}))
  }, [])

  // 지금 고른 지역·계약 방식의 시세 (아직 안 골랐으면 null)
  const preview = region ? regionFees[region] : null
  const previewCost = preview ? (housingType === 'JEONSE' ? preview.jeonse : preview.wolse) : null

  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  /* 지역 변경 추천 — 분석이 끝난 뒤에 받아온다.
     "267개월" 을 본 직후가 "강북구면 197개월" 이 가장 크게 와닿는 순간이다.
     저장된 분석 결과가 있어야 서버가 계산할 수 있어서 분석 이후에만 부른다.
     결과는 store 에도 담아서 홈 화면 카드가 다시 부르지 않게 한다. */
  const [regionOptions, setRegionOptions] = useState(null)

  useEffect(() => {
    if (!result) return
    getRegionOptions()
      .then((res) => {
        setRegionOptions(res)
        saveRegionOptions(res)
      })
      .catch(() => setRegionOptions(null)) // 실패하면 이 섹션만 안 보인다
  }, [result])

  // 결과가 나오면 그 위치로 스크롤해서 바로 보이게 함
  const resultRef = useRef(null)

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  async function runAnalysis() {
    if (!region) {
      setError('희망 지역을 선택해주세요.')
      return
    }

    setError('')
    setResult(null)
    setLoading(true)
    setLoadingStep(0)

    // 로딩 문구를 순서대로 넘겨줌
    const timer = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1))
    }, STEP_MS)

    try {
      /* 서버 응답이 너무 빨리 오면 로딩 연출이 깜빡이고 끝나버림.
         최소 표시 시간을 함께 기다려서 '계산하는 중' 이 보이게 함 */
      const [raw] = await Promise.all([
        simulate({ region, housingType }),
        sleep(MIN_LOADING_MS),
      ])

      /* 서버가 순자산을 이중 차감하는 문제가 있어 보정한다.
         보정하지 않으면 마이데이터 관리 화면(+300만원)과
         이 화면(−1,700만원)의 순자산이 서로 다르게 보인다.
         자세한 조건은 analysis.js 의 fixForecast() 주석 참고 */
      const data = fixForecast(raw, appData.mydata)

      setResult(data)
      saveForecast(data) // 홈화면이 꺼내 쓸 수 있게 보관
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : '분석에 실패했어요. 잠시 후 다시 시도해주세요.',
      )
    } finally {
      clearInterval(timer)
      setLoading(false)
    }
  }

  // estimatedMonths 가 null 이면 저축 여력이 없어 예측 불가한 경우
  const canPredict = result?.estimatedMonths != null

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      <header className="w-full max-w-[1720px] mx-auto flex items-center gap-3 px-8 lg:px-10 h-[78px]">
        <button type="button" onClick={onBack} className="flex items-center gap-3">
          {/* ★ 아이콘 : KB 로고 — public/assets/review_kblogo.png */}
          <img src="/assets/review_kblogo.png" alt="" className="h-[34px] w-auto object-contain" />
          <span className="text-[23px] font-bold text-kb-brownDark tracking-tight">
            KB 청년 자취 도우미
          </span>
        </button>
      </header>

      <main className="w-full max-w-[820px] mx-auto px-5 sm:px-8 pb-16">
        <div className="pt-2 pb-6 overflow-x-auto">
          <Stepper current={2} />
        </div>

        {/* 목표 입력 */}
        <section
          className="rounded-2xl border border-line bg-white px-6 sm:px-10 py-8"
          style={CARD_SHADOW}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[28px] font-extrabold tracking-tight text-kb-brownDark">
                자취 목표 설정
              </h1>
              <p className="mt-2 text-[15px] leading-[1.6] text-ink-500">
                어디서, 어떤 방식으로 살고 싶은지 알려주세요.
              </p>
            </div>

            {/* ★ 아이콘 : 지도 — public/assets/map.png */}
            <img
              src="/assets/map.png"
              alt=""
              className="hidden sm:block h-[52px] w-auto object-contain shrink-0"
            />
          </div>

          {/* 마이데이터 없이도 서버는 분석을 해준다.
               자산       → 0원으로 계산
               저축 여력  → 소득의 20%로 추정 (ForecastService.applyFallback)
             즉 결과가 나오긴 하는데 실제와 크게 다르다.
             결과를 보고 나서 알면 이미 늦으므로, 분석을 누르기 전에 미리 알린다 */}
          {!hasMydata && (
            <div className="mt-6 rounded-xl border border-warn/40 bg-warn/5 px-5 py-4">
              <p className="text-[15px] font-bold text-kb-brownDark">
                마이데이터를 아직 연결하지 않았어요
              </p>
              <p className="mt-1.5 text-[14px] leading-[1.7] text-ink-700">
                지금 분석하면 <span className="font-bold">모은 자산은 0원</span>, 저축 여력은{' '}
                <span className="font-bold">소득의 20%</span>로 추정해 계산해요. 실제와 차이가 클 수
                있어요.
              </p>
              {onGoMydata && (
                <button
                  type="button"
                  onClick={onGoMydata}
                  className="mt-3 h-[42px] px-5 rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                    text-[14px] font-bold text-kb-brownDark transition-colors"
                >
                  마이데이터 먼저 연결하기
                </button>
              )}
            </div>
          )}

          {/* 희망 지역 */}
          <div className="mt-8">
            <GroupTitle title="희망 지역" />
            {/* 시나리오에는 지도에 핀을 찍는 방식이지만, 지도 데이터가 아직 없어서
                자치구 버튼으로 대체함. 지도가 붙어도 선택 결과는 같은 region 값 */}
            <p className="mt-2 text-[13px] text-ink-500">현재 서울 25개 자치구를 지원해요.</p>

            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {SEOUL_GU.map((gu) => {
                const isOn = region === gu
                return (
                  <button
                    key={gu}
                    type="button"
                    onClick={() => {
                      setRegion(gu)
                      setError('')
                    }}
                    className={`h-[52px] rounded-xl border text-[15px] font-semibold transition-colors ${
                      isOn
                        ? 'border-kb-yellow bg-kb-yellow text-kb-brownDark'
                        : 'border-line bg-white text-ink-700 hover:bg-kb-yellowBg'
                    }`}
                  >
                    {gu}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 계약 방식 */}
          <div className="mt-8">
            <GroupTitle title="계약 방식" />

            <div className="mt-4 grid grid-cols-2 gap-3">
              {HOUSING_TYPES.map((type) => {
                const isOn = housingType === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setHousingType(type.value)}
                    className={`rounded-xl border px-5 py-4 text-left transition-colors ${
                      isOn
                        ? 'border-kb-yellow bg-kb-yellowBg'
                        : 'border-line bg-white hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`block text-[17px] font-bold ${
                        isOn ? 'text-kb-brownDark' : 'text-ink-700'
                      }`}
                    >
                      {type.label}
                    </span>
                    <span className="mt-1 block text-[13px] text-ink-500">{type.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 고른 지역·계약 방식의 평균 시세.
              분석을 눌러야만 금액을 알 수 있으면 감이 없는 사용자는 아무 구나 찍게 된다.
              지역과 방식을 다 고른 뒤에 바로 아래에서 확인하고 넘어가는 흐름이다.

              금액은 전부 서버가 계산해서 준 값이고 화면은 보여주기만 한다.
              중개수수료 식을 여기에 옮겨두면 분석 결과와 숫자가 어긋나는 순간이 온다. */}
          {previewCost && (
            <div className="mt-6 rounded-2xl border border-kb-yellow bg-kb-yellowBg px-6 py-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-[18px] font-extrabold text-kb-brownDark">{region}</p>
                <p className="text-[14px] font-semibold text-ink-500">
                  {housingType === 'JEONSE' ? '전세' : '월세'} 평균 시세
                </p>
              </div>

              {/* 재료(보증금·월세·중개수수료) 는 왼쪽에, 결론(필요한 돈) 은 오른쪽에 크게 */}
              <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
                <dl className="flex flex-wrap gap-x-10 gap-y-3">
                  <div>
                    {/* 전세 보증금만 CSV 의 자치구 평균값이다.
                        월세 보증금은 원본 데이터에 아예 없어서 1,000만원으로 고정해 쓴다.
                        고정값에 '평균' 을 붙이면 없는 근거를 있다고 말하는 셈이라 라벨을 나눈다 */}
                    <dt className="text-[13px] text-ink-500">
                      {housingType === 'JEONSE' ? '평균 보증금' : '보증금'}
                    </dt>
                    <dd className="mt-0.5 text-[17px] font-bold text-ink-900 tabular-nums">
                      {won(previewCost.deposit)}
                    </dd>
                  </div>

                  {housingType === 'WOLSE' && (
                    <div>
                      <dt className="text-[13px] text-ink-500">평균 월세</dt>
                      <dd className="mt-0.5 text-[17px] font-bold text-ink-900 tabular-nums">
                        매달 {won(previewCost.monthlyRent)}
                      </dd>
                    </div>
                  )}

                  <div>
                    {/* 중개수수료는 '수수료의 평균' 이 아니라 평균 보증금에서 요율로 계산한 값이라
                        '평균' 대신 '예상' 이라고 적는다 */}
                    <dt className="text-[13px] text-ink-500">예상 중개수수료</dt>
                    <dd className="mt-0.5 text-[17px] font-bold text-ink-900 tabular-nums">
                      {won(previewCost.brokerageFee)}
                    </dd>
                  </div>
                </dl>

                <div className="text-right">
                  <p className="text-[13px] text-ink-500">초기 필요 자본</p>
                  <p className="mt-0.5 text-[26px] font-extrabold text-kb-brownDark tabular-nums leading-tight">
                    {won(previewCost.requiredAmount)}
                  </p>
                </div>
              </div>

              <p className="mt-4 pt-4 border-t border-kb-yellow/50 text-[12px] leading-[1.6] text-ink-500">
                자치구 평균값이라 실제 매물과는 차이가 있어요.
                {housingType === 'WOLSE' &&
                  ' 보증금은 1,000만원 기준으로 잡았고, 초기 필요 자본은 보증금 + 월세 2개월분 + 중개수수료예요.'}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-6 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-[14px] leading-[1.6] text-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading}
            className="mt-8 w-full h-[62px] rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
              disabled:opacity-60 disabled:cursor-not-allowed
              text-[18px] font-bold text-kb-brownDark transition-colors"
          >
            {loading ? '분석 중…' : 'AI 분석 시작'}
          </button>
        </section>

        {/* 로딩 연출 */}
        {loading && (
          <section
            className="mt-5 rounded-2xl border border-line bg-white px-6 sm:px-10 py-9"
            style={CARD_SHADOW}
          >
            <div className="flex items-center gap-4">
              {/* ★ 아이콘 : AI 코치 — public/assets/ai_coach.png */}
              <img
                src="/assets/ai_coach.png"
                alt=""
                className="h-[54px] w-auto object-contain shrink-0 animate-pulse"
              />
              <div className="min-w-0">
                {/* 자취 시점 계산은 서버가 하는 산수라 AI 가 아니다. 정직하게 '분석 중' 으로 둔다 */}
                <p className="text-[17px] font-bold text-kb-brownDark">분석하고 있어요</p>
                <p className="mt-1 text-[14px] text-ink-500">{LOADING_STEPS[loadingStep]}</p>
              </div>
            </div>

            {/* 단계별로 차오르는 막대 */}
            <div className="mt-6 h-[8px] rounded-full bg-line overflow-hidden">
              <div
                className="h-full rounded-full bg-kb-yellow transition-all duration-700 ease-out"
                style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              />
            </div>

            <ol className="mt-5 space-y-2.5">
              {LOADING_STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-2.5">
                  <span
                    className={`shrink-0 grid place-items-center w-[20px] h-[20px] rounded-full text-[11px] font-bold ${
                      i < loadingStep
                        ? 'bg-kb-yellow text-kb-brownDark'
                        : i === loadingStep
                          ? 'bg-kb-brownDark text-white'
                          : 'bg-line text-ink-300'
                    }`}
                  >
                    {i < loadingStep ? '✓' : i + 1}
                  </span>
                  <span
                    className={`text-[14px] ${
                      i <= loadingStep ? 'text-ink-700' : 'text-ink-300'
                    }`}
                  >
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 결과 */}
        {/* AI 로딩 연출이 끝나고 결과가 뜨는 순간이라, 여기는 등장 효과가 특히 어울린다.
            결과 → 필요 금액 → 다음 행동 순으로 차례로 나타난다 */}
        {result && !loading && (
          <div ref={resultRef}>
            {/* 자취 가능 시점 — 가장 먼저 보여야 하는 값 */}
            <section
              className="kb-fade-up mt-5 rounded-2xl border border-kb-yellow bg-kb-yellowBg px-6 sm:px-10 py-8"
              style={CARD_SHADOW}
            >
              <p className="text-[15px] font-bold text-kb-brownDark">
                {result.region} · {result.housingType === 'JEONSE' ? '전세' : '월세'} 기준
              </p>

              {result.estimatedMonths === 0 ? (
                // 서버가 currentAsset >= requiredAmount 일 때 0 을 내려줌
                <>
                  <p className="mt-4 text-[16px] text-ink-700">필요한 자금을 이미 모았어요</p>
                  <p className="mt-2 text-[38px] leading-[1.2] font-extrabold text-kb-brownDark">
                    지금 바로
                    <br />
                    자취를 시작할 수 있어요
                  </p>
                </>
              ) : canPredict ? (
                <>
                  <p className="mt-4 text-[16px] text-ink-700">지금 저축 속도라면</p>
                  <p className="mt-2 text-[38px] leading-[1.2] font-extrabold text-kb-brownDark">
                    {monthsText(result.estimatedMonths)} 후
                    <br />
                    자취를 시작할 수 있어요
                  </p>
                  <p className="mt-4 text-[17px] font-bold text-kb-brownDark">
                    예상 시점 · {dateText(result.predictedStartDate)}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-4 text-[26px] leading-[1.35] font-extrabold text-kb-brownDark">
                    아직 자취 시점을
                    <br />
                    예측할 수 없어요
                  </p>
                  {/* 서버가 estimatedMonths: null 을 주는 유일한 조건 */}
                  <p className="mt-4 text-[15px] leading-[1.7] text-ink-700">
                    월 저축 여력이 <span className="font-bold">0원</span>이라 목표 금액에 도달하는
                    시점을 계산할 수 없어요. 고정 지출을 줄이거나 소득을 늘리면 다시 예측할 수 있어요.
                  </p>
                </>
              )}
            </section>

            {/* 필요 금액 */}
            <section
              className="kb-fade-up mt-5 rounded-2xl border border-line bg-white px-6 sm:px-10 py-8"
              style={{ ...CARD_SHADOW, animationDelay: '260ms' }}
            >
              {/* 이 카드만 따로 보거나 캡처했을 때도 어느 지역 기준인지 알 수 있어야 한다.
                  위 카드에도 같은 문구가 있지만, 금액이 있는 자리에 붙어 있는 게 중요함 */}
              <GroupTitle
                title="필요한 초기 자금"
                right={`${result.region} · ${result.housingType === 'JEONSE' ? '전세' : '월세'} 기준`}
              />

              <p className="mt-4 text-[32px] font-extrabold text-kb-brownDark tabular-nums">
                {won(result.requiredAmount)}
              </p>

              <ul className="mt-5 border-t border-line pt-3">
                <Row label="보증금" amount={result.deposit} />
                {/* 전세는 월세가 0 으로 오므로 월세일 때만 보여줌.
                    서버는 requiredAmount 에 월세 2개월분을 포함시킴 */}
                {result.housingType === 'WOLSE' && (
                  <Row label="월세 2개월분" amount={result.monthlyRent * 2} />
                )}
                <Row label="중개보수" amount={result.brokerageFee} />
              </ul>

              <ul className="mt-3 border-t border-line pt-3">
                {/* 서버는 (예금+적금+투자) − (대출+남은상환액) 을 내려줌.
                    학자금 대출이 있으면 마이너스가 나오는 게 정상이라 라벨을 '순자산' 으로 씀 */}
                <Row label="현재 순자산" amount={result.currentAsset} />
                <Row label="월 저축 여력" amount={result.monthlySavingCapacity} strong />
              </ul>

              {result.currentAsset < 0 && (
                <p className="mt-4 text-[13px] leading-[1.6] text-ink-500">
                  순자산은 <span className="font-bold">자산에서 부채를 뺀 금액</span>이에요. 대출이
                  자산보다 많아 마이너스로 표시되고, 그만큼 더 모아야 해요.
                </p>
              )}

              {/* isFallbackApplied 는 '시세 추정' 이 아니라 '저축 여력 추정' 을 뜻함.
                  마이데이터가 없거나 (소득 − 소비) 가 음수일 때 서버가 소득의 20% 로 대체함 */}
              {result.isFallbackApplied && (
                <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-kb-yellowSoft bg-kb-yellowBg px-4 py-3 text-[13px] leading-[1.6] text-ink-700">
                  {/* ★ 아이콘 : 전구 — public/assets/light_bulb.png */}
                  <img
                    src="/assets/light_bulb.png"
                    alt=""
                    className="h-[18px] w-auto object-contain shrink-0 mt-px"
                  />
                  소비 내역으로 저축 여력을 계산할 수 없어 <b className="font-bold">소득의 20%</b>로
                  추정했어요. 실제 저축 가능 금액과 차이가 있을 수 있어요.
                </p>
              )}
            </section>

            {/* AI 추천 지역 — 인접 구 중 더 저렴한 곳.
                금액과 개월 수는 서버가 계산했고, AI 는 그중 어디를 권할지 고르고 설명만 한다.
                후보가 없으면 "지금이 제일 저렴하다" 는 안내가 recommendation 으로 온다 */}
            {regionOptions?.recommendation && (
              <section
                className="kb-fade-up mt-5 rounded-2xl border border-line bg-white px-6 sm:px-10 py-8"
                style={{ ...CARD_SHADOW, animationDelay: '400ms' }}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-kb-brownDark">
                    <span className="w-[3px] h-[17px] rounded-full bg-kb-yellow" aria-hidden />
                    이런 지역은 어때요?
                  </h2>
                </div>

                {/* 후보가 없을 때는 고른 것도 없으므로 이 줄을 띄우지 않는다 */}
                {regionOptions.picks?.length > 0 && (
                  <p className="mt-2 text-[13px] leading-[1.6] text-ink-500">
                    기준을 나눠서 한 곳씩 골라봤어요. 무엇을 더 중요하게 볼지는 직접 정하면 돼요.
                  </p>
                )}

                {/* 카테고리 카드 — 성격이 다른 추천을 나란히 놓는다.
                    한 곳만 내놓으면 그게 유일한 답처럼 읽히는데, 사는 곳은 돈만으로 정하지 않는다.

                    picks 가 비어 있으면(구버전 서버 등) 아래 recommendation 한 장으로 내려간다. */}
                {regionOptions.picks?.length > 0 ? (
                  <ul className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {regionOptions.picks.map((p) => {
                      const c = regionOptions.candidates?.find((x) => x.region === p.region)
                      /* 아끼는 자리를 후보 데이터로 판단한다.
                         result.housingType 을 보면 화면 상태와 서버 계산이 어긋났을 때
                         엉뚱한 라벨이 붙는다. 월세 절감액이 있으면 월세를 아끼는 것이다. */
                      const savesRent = Number(c?.monthlyRentSaved) > 0
                      const isAi = p.source === 'ai'

                      return (
                        /* 세 칸의 테두리·배경을 똑같이 둔다.
                           예전에는 AI 칸에만 진한 테두리와 노란 배경을 줬는데, 그러면 읽기도 전에
                           AI 쪽이 더 나은 답처럼 보인다. 셋은 우열이 아니라 축이 다른 답이고
                           (①돈 ②③생활 여건), 고르는 건 사용자다.
                           출처는 오른쪽 배지 하나로만 구분한다. */
                        <li
                          key={p.kind}
                          className="flex flex-col rounded-xl border border-line bg-white px-5 py-5"
                        >
                          {/* 칸 이름 + 출처. 계산으로 고른 걸 AI 가 고른 것처럼 보이게 하지 않는다 */}
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-bold text-ink-500">{p.label}</p>
                            {/* 배지는 둘 다 같은 무게(테두리형)로 두고 색으로만 구분한다.
                                한쪽만 채워두면 그게 더 중요한 답처럼 읽힌다. */}
                            <span
                              className={`shrink-0 h-[21px] px-2 rounded-full bg-white border text-[11px] font-bold grid place-items-center text-kb-brownDark ${
                                isAi ? 'border-kb-brownDark' : 'border-kb-yellow'
                              }`}
                            >
                              {isAi ? 'AI 분석' : '계산 기반'}
                            </span>
                          </div>

                          <p className="mt-2.5 text-[19px] font-extrabold text-kb-brownDark">
                            {p.region}
                          </p>
                          <p className="mt-1 text-[13px] leading-[1.55] text-ink-700">
                            {p.headline}
                          </p>

                          {p.reasons?.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                              {p.reasons.map((reason) => (
                                <li
                                  key={reason}
                                  className="flex gap-2 text-[13px] leading-[1.55] text-kb-brownDark"
                                >
                                  <span className="shrink-0 text-kb-yellowDark" aria-hidden>
                                    ✓
                                  </span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* 숫자는 맨 아래 한 줄로 고정. 어느 칸을 보든 같은 자리에서 비교된다 */}
                          {c && (
                            <p className="mt-auto pt-3.5 text-[13px] leading-[1.6] text-ink-700">
                              <span className="text-ink-500">
                                {savesRent ? '월세 ' : '초기 자금 '}
                              </span>
                              <b className="font-extrabold text-kb-brownDark tabular-nums">
                                {won(savesRent ? c.monthlyRentSaved : c.savedAmount)}
                              </b>{' '}
                              적어요
                              {c.shortenMonths > 0 && (
                                <>
                                  {' · '}
                                  <b className="font-bold">{c.shortenMonths}개월</b> 빨라져요
                                </>
                              )}
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  /* 후보가 없을 때 — "지금이 제일 저렴하다" 는 안내가 recommendation 으로 온다.
                     이건 고장이 아니라 좋은 소식이라 빈 화면 대신 그대로 보여준다 */
                  <div className="mt-4 rounded-xl bg-kb-yellowBg px-5 py-4">
                    <p className="text-[16px] font-bold text-kb-brownDark">
                      {regionOptions.recommendation.headline}
                    </p>
                    {regionOptions.recommendation.reasons?.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {regionOptions.recommendation.reasons.map((reason) => (
                          <li
                            key={reason}
                            className="flex gap-2 text-[13px] leading-[1.55] text-kb-brownDark"
                          >
                            <span className="shrink-0 text-kb-yellowDark" aria-hidden>
                              ✓
                            </span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <p className="mt-4 text-[12px] leading-[1.6] text-ink-500">
                  지금 고른 지역과 맞닿아 있는 자치구만 비교했어요. 금액은 자치구 평균값이라
                  실제 매물과는 차이가 있어요. 어디에 살지는 직장·학교·생활권까지 봐야 하니
                  여기 숫자는 참고로만 봐주세요.
                </p>
              </section>
            )}

            <button
              type="button"
              onClick={onNext}
              className="mt-6 w-full h-[62px] rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                text-[18px] font-bold text-kb-brownDark transition-colors"
            >
              분석 결과 자세히 보기
            </button>

            <button
              type="button"
              onClick={() => setResult(null)}
              className="mt-3 w-full h-[54px] rounded-xl border border-line bg-white hover:bg-gray-50
                text-[16px] font-bold text-kb-brownDark transition-colors"
            >
              조건 바꿔서 다시 분석하기
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
