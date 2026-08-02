/* ============================================================
   KB 청년 자취 도우미 — 저축 플랜 추천 (시나리오 ⑥)
   독립만세팀 / KB AI Challenge 2026

   사이드바의 [저축 플랜 추천] 화면.

   [이 화면이 하는 일]
   1. 월 저축 목표를 정한다  ← 지금 만든 부분
   2. 목표대로 모으면 자취 시점이 어떻게 되는지 보여준다
   3. 목표에 맞는 KB 적금·예금 상품을 추천한다  ← 상품 API 가 있어야 가능

   [저축 목표를 왜 따로 받나]
   서버가 주는 monthlySavingCapacity 는 '소득 − 지출' 로 계산된 최대치다.
   실제로는 예상 못 한 지출이 있어서 그만큼 다 모으지 못한다.
   사용자가 스스로 정한 금액이 있어야 홈에서 '목표 대비 얼마나 했는지' 를 볼 수 있다.

   목표는 PATCH /api/users/me 로 서버에 저장된다 (monthly_saving_goal 컬럼).
   다른 기기에서 로그인해도 목표가 그대로 보인다.
   ============================================================ */

import { useEffect, useState } from 'react'
import { Sidebar, TopBar, IconBox } from './Shell.jsx'
import { getUser, askAi, getProducts, ApiError } from './api.js'
import { useAppData, saveSavingGoal } from './store.js'
import {
  buildGoalPlan,
  goalPresets,
  incomeChangedSinceAnalysis,
  pickSaving,
  won,
  monthsText,
} from './analysis.js'
import AiPick from './AiPick.jsx'

const CARD = 'rounded-2xl border border-line bg-white'

// 이보다 작은 목표는 받지 않는다 (자릿수 실수 방지)
const MIN_GOAL = 10000

const digitsOnly = (v) => v.replace(/\D/g, '').slice(0, 12)
const withComma = (v) => (v ? Number(v).toLocaleString('ko-KR') : '')

/* ---------- 공통 조각 ---------- */

function SectionTitle({ title, right }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-kb-brownDark">
        <span className="w-[3px] h-[17px] rounded-full bg-kb-yellow" aria-hidden />
        {title}
      </h2>
      {right}
    </div>
  )
}

// 큰 숫자 한 칸
function Stat({ label, value, sub, tone }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${tone ?? 'border-line bg-gray-50'}`}>
      <p className="text-[13px] text-ink-500">{label}</p>
      <p className="mt-1.5 text-[20px] font-extrabold text-kb-brownDark whitespace-nowrap">
        {value}
      </p>
      {sub && <p className="mt-1 text-[12px] leading-[1.5] text-ink-500">{sub}</p>}
    </div>
  )
}

/* ---------- 저축 플랜 추천 화면 ---------- */

export default function SavingPlan({ onNavigate, onLogout }) {
  const [saved] = useAppData()
  const userName = saved.me?.name ?? getUser()?.name ?? '고객'

  const [goalText, setGoalText] = useState(saved.savingGoal ? String(saved.savingGoal) : '')
  const [savedGoal, setSavedGoal] = useState(saved.savingGoal ?? null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  /* saving : 서버 응답을 기다리는 동안 버튼을 잠근다 (같은 목표를 두 번 보내지 않게)
     saveWarning : 화면에는 반영됐지만 서버 저장에 실패했을 때만 뜬다 */
  const [saving, setSaving] = useState(false)
  const [saveWarning, setSaveWarning] = useState('')

  const goal = Number(goalText || 0)

  const plan = buildGoalPlan({
    forecast: saved.forecast,
    mydata: saved.mydata,
    income: saved.monthlyIncome,
    goal: savedGoal, // 저장한 값 기준으로 계산 (입력 중인 값이 아니라)
  })

  const presets = goalPresets(plan.capacity)

  /* 분석 뒤에 소득을 고쳤으면 저축 여력이 옛 소득 기준이다.
     프론트에서 다시 계산하지 않고 사실만 알린다 — 서버가 준 숫자와 어긋나면 안 된다 */
  const staleIncome = incomeChangedSinceAnalysis({
    forecast: saved.forecast,
    mydata: saved.mydata,
    incomeAtAnalysis: saved.incomeAtAnalysis,
    monthlyIncome: saved.monthlyIncome,
  })

  // GET /api/products 에서 적금·예금만 골라둔다
  const [savings, setSavings] = useState([])
  useEffect(() => {
    getProducts()
      .then((res) => setSavings((res.products ?? []).filter((p) => p.category === 'SAVINGS')))
      .catch(() => setSavings([]))
  }, [])

  /* 목표와 저축 여력의 차액 — 기간 차이가 왜 생기는지 설명하는 값

     월 차액 : 매달 얼마나 벌어지는지
     총 차액 : 그 차이가 목표 기간(goalMonths) 동안 쌓인 금액
               = 같은 기간에 최대로 모았다면 더 있었을 금액 */
  const monthlyGap = Math.abs(plan.capacity - (savedGoal ?? 0))
  const totalGap = plan.goalMonths != null ? monthlyGap * plan.goalMonths : 0

  /* AI 어드바이스 — 서버 API 가 붙으면 여기서 답변이 채워진다.
     지금은 askAi 가 AI_NOT_READY 를 던져서 안내만 뜬다 */
  const [advice, setAdvice] = useState(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceError, setAdviceError] = useState('')

  async function ask(question) {
    setAdviceError('')
    setAdviceLoading(true)
    try {
      const res = await askAi({ scope: 'saving', question, context: { capacity: plan.capacity, goal: savedGoal, baseMonths: plan.baseMonths, goalMonths: plan.goalMonths, remaining: plan.remaining } })
      setAdvice({ ...res, question })
    } catch (err) {
      setAdvice(null)
      setAdviceError(err instanceof ApiError ? err.message : 'AI 답변을 받지 못했어요.')
    } finally {
      setAdviceLoading(false)
    }
  }

  async function submit() {
    if (goal <= 0) {
      setError('목표 금액을 입력해주세요.')
      return
    }
    /* 너무 작은 금액을 막는다. 1,000원을 목표로 두면 도달까지 수십만 개월이 나와서
       홈 화면 숫자가 전부 이상해진다. 실수로 자릿수를 덜 친 경우가 대부분이다 */
    if (goal < MIN_GOAL) {
      setError(`목표는 ${won(MIN_GOAL)} 이상으로 정해주세요.`)
      return
    }
    if (goal > plan.capacity * 3 && plan.capacity > 0) {
      // 여력의 3배가 넘으면 자릿수를 잘못 넣었을 가능성이 크다
      setError('저축 여력에 비해 금액이 너무 커요. 자릿수를 확인해주세요.')
      return
    }

    setError('')
    setSaving(true)

    /* 서버 응답을 기다렸다가 표시한다.
       전에는 기다리지 않고 바로 '✓ 저장됨' 을 켰는데, 백엔드가 죽어 있으면
       저장됐다고 말해놓고 다음 로그인에 목표가 사라졌다. 다시 입력할 기회를 뺏는 셈이다.

       화면 값(savedGoal)은 실패해도 그대로 둔다 — 이번 세션에서는 이 목표로
       계산을 보여주는 게 맞고, 저장이 안 됐다는 것만 따로 알린다. */
    const { saved } = await saveSavingGoal(goal)
    setSavedGoal(goal)
    setDone(true)
    setSaving(false)
    setSaveWarning(
      saved ? '' : '목표는 이번 접속에만 남아 있어요. 서버에 저장하지 못했어요 — 잠시 후 다시 저장해주세요.',
    )
    resetAdvice()
  }

  async function clear() {
    setSaving(true)
    const { saved } = await saveSavingGoal(null)
    setSavedGoal(null)
    setGoalText('')
    setDone(false)
    setSaving(false)
    setSaveWarning(saved ? '' : '서버에서 목표를 지우지 못했어요. 다시 로그인하면 되살아날 수 있어요.')
    resetAdvice()
  }

  /* 목표가 바뀌면 이전 답변은 버린다.
     AI 답변은 물어본 시점의 숫자를 근거로 쓴 글이라, 목표를 99만원으로 바꿨는데
     54만원 기준 답변이 그대로 남아 있으면 화면의 숫자와 설명이 서로 다른 말을 하게 된다.
     지워두면 카드가 규칙 기반으로 돌아가고, 다시 물어보면 새 숫자로 답한다. */
  function resetAdvice() {
    setAdvice(null)
    setAdviceError('')
  }

  return (
    <div className="min-h-screen flex bg-white">
      <Sidebar active="저축 플랜 추천" onNavigate={onNavigate} />

      <main className="flex-1 min-w-0 flex flex-col gap-5 px-5 sm:px-8 py-5 pb-14">
        <TopBar
          userName={userName}
          onNavigate={onNavigate}
          onLogout={onLogout}
          title="저축 플랜 추천"
          subtitle="매달 얼마씩 모을지 정하면 자취 시점이 어떻게 바뀌는지 보여드려요."
        />

        {/* ① 월 저축 목표 */}
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          <SectionTitle
            title="월 저축 목표"
            right={
              savedGoal ? (
                <button
                  type="button"
                  onClick={clear}
                  className="text-[13px] text-ink-500 hover:text-ink-700 underline underline-offset-2"
                >
                  목표 지우기
                </button>
              ) : null
            }
          />

          <p className="mt-2 text-[14px] leading-[1.7] text-ink-500">
            {plan.capacity > 0 ? (
              <>
                {/* 소득을 고친 뒤라면 '지금 소득' 이라고 말하면 안 된다. 그 값이 아니다 */}
                {staleIncome ? '분석 당시 소득과 지출로는 매달 ' : '지금 소득과 지출로는 매달 '}
                <span className="font-bold text-ink-700">{won(plan.capacity)}</span> 까지 모을 수
                있어요. 예상 못 한 지출을 감안해 조금 낮게 잡아도 괜찮아요.
              </>
            ) : (
              '마이데이터를 연결하고 월 소득을 입력하면 모을 수 있는 금액을 계산해드려요.'
            )}
          </p>

          {/* 분석 뒤에 소득이 바뀌었으면 알려준다.
              숫자를 조용히 그대로 두면 사용자는 자기가 고친 값이 반영된 줄 안다 */}
          {staleIncome && (
            <div className="mt-3 rounded-xl border border-kb-yellow/60 bg-kb-yellowBg px-4 py-3.5">
              <p className="text-[13px] leading-[1.7] text-kb-brownDark">
                {/* 분석 당시 소득을 아는 경우와 모르는 경우의 문장이 다르다.
                    모르면서 아는 척하면 틀린 숫자를 적게 된다 */}
                {staleIncome.before ? (
                  <>
                    위 금액은 <span className="font-bold">월 소득 {won(staleIncome.before)}</span>{' '}
                    으로 분석했을 때의 값이에요. 지금 저장된 소득은{' '}
                    <span className="font-bold">{won(staleIncome.now)}</span> 이에요.
                  </>
                ) : (
                  <>
                    위 금액은 이전에 분석했을 때의 값이라, 지금 저장된 소득·지출과 맞지 않아요.
                    (지금 월 소득 <span className="font-bold">{won(staleIncome.now)}</span>)
                  </>
                )}{' '}
                <span className="font-bold">
                  다시 분석하면 약 {won(staleIncome.expected)} 가 돼요.
                </span>
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.('자취 시뮬레이션')}
                className="mt-3 h-[40px] px-4 rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                  text-[13px] font-bold text-kb-brownDark transition-colors"
              >
                다시 분석하러 가기
              </button>
            </div>
          )}

          {/* 추천값 — 빈 칸에 직접 적는 것보다 기준점을 고르는 쪽이 쉽다.
              (50%) 는 저축 여력 대비 비율. 금액만 보면 빡빡한 목표인지 알 수 없어서 붙였다.
              작고 회색으로 둔 이유 — 고를 때 먼저 읽는 건 이름과 금액이고,
              비율은 '아 절반이구나' 하고 확인하는 보조 정보라서 */}
          {presets.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {presets.map((p) => {
                const isOn = goal === p.amount
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setGoalText(String(p.amount))
                      setDone(false)
                      setError('')
                    }}
                    className={`px-4 py-2.5 rounded-xl border text-left transition-colors ${
                      isOn
                        ? 'border-kb-yellow bg-kb-yellowBg text-kb-brownDark'
                        : 'border-line bg-white text-ink-700 hover:bg-gray-50'
                    }`}
                  >
                    {/* 이름·비율은 위, 금액은 아래 — 한 줄로 붙이면 길어서 읽기 어려움 */}
                    <span className="block text-[14px] font-semibold whitespace-nowrap">
                      {p.label}
                      <span className="ml-1 text-[12px] font-medium text-ink-500">
                        ({p.percent}%)
                      </span>
                    </span>
                    <span className="block mt-0.5 text-[15px] font-extrabold tabular-nums whitespace-nowrap">
                      {won(p.amount)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <p className="mt-2 text-[13px] text-ink-500">
            괄호 안 % 는 저축 여력({won(plan.capacity)}) 대비 비율이에요.
          </p>

          <div className="mt-4 flex flex-wrap items-start gap-3">
            <div className="relative w-full sm:w-[280px]">
              <input
                type="text"
                inputMode="numeric"
                value={withComma(goalText)}
                onChange={(ev) => {
                  setGoalText(digitsOnly(ev.target.value))
                  setDone(false)
                }}
                placeholder="600,000"
                className={`w-full h-[52px] px-4 pr-10 rounded-xl border bg-white text-[15px]
                  text-ink-900 placeholder:text-ink-300 outline-none tabular-nums transition-colors
                  focus:border-kb-yellow focus:ring-2 focus:ring-kb-yellow/30
                  ${error ? 'border-danger' : 'border-line'}`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-ink-500">
                원
              </span>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className={`h-[52px] px-7 rounded-xl text-[15px] font-bold transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed ${
                  done && !saveWarning
                    ? 'bg-ok/10 text-ok border border-ok/40'
                    : 'bg-kb-yellow hover:bg-kb-yellowDark text-kb-brownDark'
                }`}
            >
              {saving ? '저장 중…' : done && !saveWarning ? '✓ 저장됨' : '목표 저장하기'}
            </button>
          </div>

          {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
          {/* 서버에 못 넣었을 때. 화면 값은 살아 있으므로 danger 가 아니라 경고 톤으로 */}
          {saveWarning && (
            <p className="mt-3 text-[13px] leading-[1.6] text-kb-brownDark">{saveWarning}</p>
          )}

          <p className="mt-4 text-[13px] leading-[1.6] text-ink-500">
            저장한 목표는 홈 화면의 <span className="font-bold">월 저축 목표</span> 칸에 바로
            표시돼요.
          </p>
        </section>

        {/* ② 추천 — 목표를 어떻게 잡을지 */}
        <AiPick
          {...(pickSaving({
            capacity: plan.capacity,
            goal: savedGoal,
            baseMonths: plan.baseMonths,
            goalMonths: plan.goalMonths,
            overCapacity: plan.overCapacity,
          }) ?? {})}
          advice={advice}
          loading={adviceLoading}
          error={adviceError}
          onAsk={ask}
          questions={['이 목표 현실적인가요?', '어디를 줄이면 목표를 지킬 수 있나요?', '목표를 올리면 얼마나 빨라지나요?']}
        />

        {/* ③ 목표를 정했을 때 달라지는 것 */}
        {/* 목표를 저장한 직후에 새로 생기는 영역이라, 나타나는 게 보이면 저장됐다는 신호가 된다 */}
        {savedGoal && plan.hasForecast && (
          <section className={`${CARD} kb-fade-up px-6 sm:px-8 py-6`}>
            <SectionTitle title="예상 자취 도달 시점" />

            {/* 순서 : 내가 정한 목표 → 최대로 모았을 때 → 그 차이.
                'monthlySavingCapacity' 는 소득에서 지출을 뺀 전부라 '지금 속도' 가 아니라
                '더 못 올리는 상한' 이다. 그래서 '최대한 빠른 속도' 로 부른다.
                실제로 그렇게 살면 한 달 지출이 0이 되므로, 비교 기준선으로만 쓴다. */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* '1년 4개월' 만 있으면 기간인지 시점인지 헷갈린다. '뒤' 를 붙여 시점으로 읽히게 */}
              <Stat
                label="목표대로 저축 시"
                value={plan.goalMonths != null ? `${monthsText(plan.goalMonths)} 뒤` : '—'}
                sub={`월 ${won(savedGoal)} 기준`}
                tone="border-kb-yellowSoft bg-kb-yellowBg"
              />
              <Stat
                label="최대한 많이 저축 시"
                value={plan.baseMonths != null ? `${monthsText(plan.baseMonths)} 뒤` : '—'}
                sub={`월 ${won(plan.capacity)}(저축 여력 전부) 기준`}
              />
              <Stat
                label="최대 저축과 차이"
                value={
                  plan.diffMonths == null
                    ? '—'
                    : plan.diffMonths < 0
                      ? `${-plan.diffMonths}개월 더 걸려요`
                      : plan.diffMonths > 0
                        ? `${plan.diffMonths}개월 빨라져요`
                        : '가장 빠른 속도예요'
                }
                /* 기간 차이만 보면 '왜 4개월이나 차이 나지?' 싶다.
                   월 차액과, 그게 목표 기간 동안 쌓인 총액을 함께 적어 이유가 보이게 한다.
                   '덜 모아서예요' 같은 표현은 사용자 선택을 탓하는 말로 읽혀서 쓰지 않는다 */
                sub={
                  monthlyGap === 0 ? (
                    '저축 여력을 전부 모으는 목표예요'
                  ) : (
                    <>
                      매달 {won(monthlyGap)} 차이
                      {totalGap > 0 && (
                        <>
                          <br />총 차이 금액 : {won(totalGap)}
                        </>
                      )}
                    </>
                  )
                }
              />
            </div>

            {/* 목표가 여력을 넘으면 그냥 두지 않고, 얼마를 줄여야 하는지 알려준다 */}
            {plan.overCapacity > 0 && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-kb-yellow/45 bg-kb-yellowBg px-4 py-3.5">
                {/* ★ 아이콘 : 전구 — public/assets/light_bulb.png */}
                <IconBox size={26} src="/assets/light_bulb.png" />
                <p className="text-[14px] leading-[1.7] text-kb-brownDark">
                  지금 저축 여력보다 <span className="font-bold">{won(plan.overCapacity)}</span> 높은
                  목표예요. 매달 그만큼 소비를 줄여야 달성할 수 있어요.
                  <button
                    type="button"
                    onClick={() => onNavigate?.('마이데이터 관리')}
                    className="ml-1.5 font-bold underline underline-offset-2"
                  >
                    소비 내역 보기
                  </button>
                </p>
              </div>
            )}
          </section>
        )}

        {/* 목표는 정했는데 분석 결과가 없을 때 */}
        {savedGoal && !plan.hasForecast && (
          <section className={`${CARD} px-6 py-10 grid place-items-center`}>
            <div className="text-center max-w-[400px]">
              <p className="text-[15px] font-bold text-kb-brownDark">
                자취 목표를 정하면 시점을 비교해드려요
              </p>
              <p className="mt-2 text-[14px] leading-[1.7] text-ink-500">
                희망 지역과 계약 방식을 고르면, 지금 속도와 목표대로 모았을 때를 나란히 볼 수 있어요.
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.('자취 시뮬레이션')}
                className="mt-4 h-[46px] px-6 rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                  text-[14px] font-bold text-kb-brownDark transition-colors"
              >
                자취 시뮬레이션 하러 가기
              </button>
            </div>
          </section>
        )}

        

        {/* 상품 추천 — 적금·예금 데이터가 있을 때만 그린다.

            원본 상품 파일(data/kb_products.json)에 지금은 대출 상품만 있다.
            빈 목록일 때 "불러오지 못했어요" 를 띄우면 고장난 화면처럼 보이는데,
            사실은 보여줄 상품이 없는 것뿐이다. 그래서 섹션 자체를 그리지 않는다.
            나중에 적금 상품을 파일에 넣으면 이 섹션이 저절로 다시 나타난다. */}
        {savings.length > 0 && (
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          <SectionTitle title="추천 적금·예금" />

              <p className="mt-2 text-[14px] leading-[1.7] text-ink-500">
                {savedGoal
                  ? `월 ${won(savedGoal)} 목표에 맞는 상품이에요.`
                  : '목표를 정하면 납입 한도와 비교해 알려드려요.'}
              </p>

              <ul className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {savings.map((item) => {
                  const limit = Number(item.calc?.maxLimit ?? 0)
                  // 목표가 월 납입한도를 넘으면 한 상품으로는 다 못 담는다
                  const over = savedGoal && limit > 0 && savedGoal > limit

                  return (
                    <li key={item.productId} className="rounded-xl border border-line bg-white px-5 py-5 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[16px] font-bold text-kb-brownDark leading-[1.4]">
                          {item.name}
                        </h3>
                        {item.tag && (
                          <span className="shrink-0 h-[26px] px-2.5 rounded-full bg-kb-yellow text-[12px] font-bold text-kb-brownDark grid place-items-center">
                            {item.tag}
                          </span>
                        )}
                      </div>

                      {/* 누가 신청할 수 있는지 — 조건을 모르면 카드만 보고 판단할 수 없다 */}
                      {item.target && (
                        <p className="mt-2 text-[13px] leading-[1.6] text-ink-500">
                          <span className="font-semibold text-ink-700">대상</span> {item.target}
                        </p>
                      )}

                      <ul className="mt-3 space-y-1.5">
                        {(item.specs ?? []).map((spec) => (
                          <li key={spec.label} className="flex items-center justify-between gap-3 text-[13px]">
                            <span className="text-ink-500">{spec.label}</span>
                            <span className="font-semibold text-ink-900">{spec.value}</span>
                          </li>
                        ))}
                      </ul>

                      {/* 목표를 한 상품에 다 넣을 수 있는지 알려준다 */}
                      {savedGoal > 0 && limit > 0 && (
                        <p className={`mt-3 text-[13px] leading-[1.6] ${over ? 'text-danger' : 'text-ok'}`}>
                          {over
                            ? `월 납입한도(${won(limit)})보다 목표가 커요. 다른 상품과 나눠 담아야 해요.`
                            : `월 목표 ${won(savedGoal)}을 이 상품 하나로 넣을 수 있어요.`}
                        </p>
                      )}

                      <div className="flex-1 min-h-[10px]" />

                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 h-[44px] grid place-items-center rounded-xl bg-kb-yellow
                            hover:bg-kb-yellowDark text-[14px] font-bold text-kb-brownDark transition-colors"
                        >
                          상품 자세히 보기
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
        </section>
        )}

      </main>
    </div>
  )
}
