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
import { simulate, ApiError } from './api.js'


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

function GroupTitle({ title }) {
  return (
    <h3 className="flex items-center gap-2.5 text-[16px] font-bold text-kb-brownDark">
      <span className="w-[3px] h-[16px] rounded-full bg-kb-yellow" aria-hidden />
      {title}
    </h3>
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
          strong ? 'text-[16px] font-bold text-kb-brownDark' : 'text-[14px] font-semibold text-ink-900'
        }`}
      >
        {won(amount)}
      </span>
    </li>
  )
}

const CARD_SHADOW = { boxShadow: '0 6px 24px -8px rgba(74, 68, 59, 0.28)' }


/* ---------- 자취 목표 설정 화면 ---------- */

export default function Forecast({ onNext, onBack }) {
  const [region, setRegion] = useState('')
  const [housingType, setHousingType] = useState('JEONSE')

  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

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
      const [data] = await Promise.all([
        simulate({ region, housingType }),
        sleep(MIN_LOADING_MS),
      ])
      setResult(data)
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
                    className={`h-[44px] rounded-xl border text-[14px] font-semibold transition-colors ${
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
                <p className="text-[17px] font-bold text-kb-brownDark">AI가 분석하고 있어요</p>
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
        {result && !loading && (
          <div ref={resultRef}>
            {/* 자취 가능 시점 — 가장 먼저 보여야 하는 값 */}
            <section
              className="mt-5 rounded-2xl border border-kb-yellow bg-kb-yellowBg px-6 sm:px-10 py-8"
              style={CARD_SHADOW}
            >
              <p className="text-[15px] font-bold text-kb-brownDark">
                {result.region} · {result.housingType === 'JEONSE' ? '전세' : '월세'} 기준
              </p>

              {canPredict ? (
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
              className="mt-5 rounded-2xl border border-line bg-white px-6 sm:px-10 py-8"
              style={CARD_SHADOW}
            >
              <GroupTitle title="필요한 초기 자금" />

              <p className="mt-4 text-[32px] font-extrabold text-kb-brownDark tabular-nums">
                {won(result.requiredAmount)}
              </p>

              <ul className="mt-5 border-t border-line pt-3">
                <Row label="보증금" amount={result.deposit} />
                {/* 전세는 월세가 0 으로 오므로 월세일 때만 보여줌 */}
                {result.housingType === 'WOLSE' && (
                  <Row label="월세" amount={result.monthlyRent} />
                )}
                <Row label="중개보수" amount={result.brokerageFee} />
              </ul>

              <ul className="mt-3 border-t border-line pt-3">
                <Row label="현재 자산" amount={result.currentAsset} />
                <Row label="월 저축 여력" amount={result.monthlySavingCapacity} strong />
              </ul>

              {/* 서버가 정확한 시세를 못 찾아 평균값으로 계산한 경우 */}
              {result.isFallbackApplied && (
                <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-kb-yellowSoft bg-kb-yellowBg px-4 py-3 text-[13px] leading-[1.6] text-ink-700">
                  {/* ★ 아이콘 : 전구 — public/assets/light_bulb.png */}
                  <img
                    src="/assets/light_bulb.png"
                    alt=""
                    className="h-[18px] w-auto object-contain shrink-0 mt-px"
                  />
                  이 지역의 상세 시세가 없어 평균값으로 계산했어요. 실제 매물 가격과 차이가 있을 수
                  있어요.
                </p>
              )}
            </section>

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
