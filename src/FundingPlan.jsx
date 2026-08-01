/* ============================================================
   KB 청년 자취 도우미 — 자금조달 설계 (시나리오 ⑤)
   독립만세팀 / KB AI Challenge 2026

   화면 순서 (위에서부터)
     1. 내 목표          필요 초기자금 · 예상 입주 시점
     2. 추천 금융상품    상품을 고르면 아래 두 칸이 그 조건으로 계산됨
     3. DSR 점검         고른 상품의 금액·금리·기간으로 상환 부담 계산
     4. 자금조달 구성    자기자본 + 지원금 + 대출 도넛

   [값의 출처 — 직접 입력받는 것이 하나도 없다]
     자기자본  마이데이터 순자산            (실제 값)
     필요 자금 서버 분석 결과 requiredAmount (실제 값)
     지원금    맞춤 정책·지원금 화면에서 조회한 supportAmount 합계
     대출      GET /api/products 목록에서 고른 상품

   숫자를 우리가 정하지 않는다. 대출 금액은 '부족분과 상품 한도 중 작은 값',
   금리는 상품의 최저 금리를 쓴다. 둘 다 서버가 준 값에서 나온다.
   금액을 모르는 정책(supportAmount: null)은 합계에서 빼고, 0 으로 두고 밝힌다.
   ============================================================ */

import { useEffect, useState } from 'react'
import { Sidebar, TopBar } from './Shell.jsx'
import { getUser, askAi, recommendProducts, ApiError } from './api.js'
import { useAppData, saveFundingPlan } from './store.js'
import { pickFunding, won, wonShort, yearMonth } from './analysis.js'
import AiPick from './AiPick.jsx'

const CARD = 'rounded-2xl border border-line bg-white'
const num = (v) => Number(v ?? 0)

/* 원리금균등 상환 월 납입액.
     M = P × r / (1 − (1+r)^-n)      r = 월이자율, n = 개월수
   대출 계산의 표준 공식이라 우리가 지어낸 식이 아니다. */
function monthlyPayment(principal, annualRatePercent, years) {
  const n = years * 12
  const r = annualRatePercent / 100 / 12
  if (principal <= 0 || n <= 0) return 0
  if (r === 0) return Math.round(principal / n)
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -n)))
}

/* DSR 등급 — 은행권 규제선(40%)이 기준.
   30% 이하를 '안전' 으로 둔 건 규제선까지 여유를 두기 위한 화면상의 구분이다. */
function dsrGrade(percent) {
  if (percent == null) return null
  if (percent <= 30) return { label: '안전', tone: 'ok', desc: '상환 부담이 크지 않아요' }
  if (percent <= 40) return { label: '보통', tone: 'warn', desc: '규제 한도(40%)에 가까워요' }
  return { label: '위험', tone: 'danger', desc: '규제 한도를 넘어 대출이 어려울 수 있어요' }
}

const TONE = {
  ok: { text: 'text-ok', bg: 'bg-ok/10', border: 'border-ok/40', bar: 'bg-ok' },
  warn: {
    text: 'text-kb-brownDark',
    bg: 'bg-kb-yellowBg',
    border: 'border-kb-yellow/45',
    bar: 'bg-kb-yellow',
  },
  danger: { text: 'text-danger', bg: 'bg-danger/5', border: 'border-danger/40', bar: 'bg-danger' },
}

/* ---------- 공통 조각 ---------- */

function SectionTitle({ title, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-kb-brownDark">
        <span className="w-[3px] h-[17px] rounded-full bg-kb-yellow" aria-hidden />
        {title}
      </h2>
      {right && <span className="text-[14px] font-semibold text-ink-500">{right}</span>}
    </div>
  )
}

/* 도넛 — 조각 여러 개를 이어 그린다.

   total 은 '한 바퀴에 해당하는 금액' 이다. 반드시 필요 자금을 넣어야 한다.
   조각들의 합으로 계산하면, 자기자본 300만원만 있어도 한 바퀴가 300만원이 되어
   2억 5천이 필요한데도 도넛이 꽉 차 보인다. (실제로 그렇게 보였다)
   남은 부분은 회색 트랙으로 남아서 '아직 못 채운 만큼' 이 눈에 보인다. */
/* size 는 바깥 지름, thickness 는 링 두께.
   안쪽 구멍 지름 = size − thickness×2 이고, 가운데 글자는 이 안에 들어가야 한다.
   172/24 이던 시절 구멍이 124px 밖에 안 돼서 '11,072,000원' 이 링 위로 삐져나왔다 */
function Donut({ parts, total: totalProp, size = 188, thickness = 22, center }) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const total = num(totalProp) || parts.reduce((s, p) => s + p.value, 0) || 1

  let offset = 0
  const arcs = parts.map((p) => {
    const len = (p.value / total) * c
    const arc = { ...p, len, offset }
    offset += len
    return arc
  })

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F3F6" strokeWidth={thickness} />
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={thickness}
            strokeDasharray={`${a.len} ${c - a.len}`}
            strokeDashoffset={-a.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
        {center}
      </div>
    </div>
  )
}

/* 구성 항목 한 줄.
   라벨과 금액이 화면 양 끝에 붙어 있으면 눈이 멀리 이동해 읽기 불편하다.
   왼쪽 묶음(점 + 이름 + 출처)을 붙이고, 금액은 고정 폭으로 오른쪽에 둔다 */
function PartRow({ color, label, source, amount, muted }) {
  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-line last:border-b-0">
      <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className={`text-[14px] font-semibold ${muted ? 'text-ink-300' : 'text-ink-700'}`}>
        {label}
      </span>
      <span className="text-[12px] text-ink-500 truncate">{source}</span>
      <span className="flex-1 min-w-[8px]" />
      <span
        className={`shrink-0 text-[15px] tabular-nums ${
          muted ? 'text-ink-300' : 'font-bold text-ink-900'
        }`}
      >
        {/* amount 가 null 이면 '모르는 값' 이다. 0원으로 적으면 알아본 결과처럼 읽힌다 */}
        {amount == null ? '—' : won(amount)}
      </span>
    </li>
  )
}

/* ---------- 자금조달 설계 화면 ---------- */

export default function FundingPlan({ onNavigate, onLogout }) {
  const [appData] = useAppData()
  const { forecast, mydata, monthlyIncome, policySupport } = appData
  const userName = appData.me?.name ?? getUser()?.name ?? '고객'

  /* 고른 대출 상품. { name, amount, rate, years } 형태로 보관한다.
     금액은 부족분과 상품 한도 중 작은 쪽, 금리는 최저 금리를 기준으로 잡는다.

     처음 값을 store 에서 가져오는 이유 — 홈에 갔다가 돌아오면 고른 상품이
     사라져서 매번 다시 고르게 됐다. 홈의 '대출 활용 시' 칸도 같은 값을 읽는다 */
  const [product, setProduct] = useState(() => appData.fundingPlan ?? null)

  /* 화면 상태와 store 를 한 곳에서 같이 바꾼다.
     setProduct 를 직접 부르는 자리가 여러 군데라, 한쪽만 저장하면 어긋난다 */
  const chooseProduct = (next) => {
    setProduct(next)
    saveFundingPlan(next)
  }

  const required = num(forecast?.requiredAmount)
  const own = Math.max(num(forecast?.currentAsset), 0) // 자기자본 (순자산, 마이너스면 0)

  /* 지원금 — '0원' 과 '아직 안 알아봄' 은 다른 상태다.

     policySupport 는 맞춤 정책 화면을 다녀와야 채워진다. 안 다녀왔으면 null 인데,
     전에는 num() 이 이걸 0 으로 바꿔서 부족액·달성률·추천 대출 금액이 전부
     "지원금은 0원" 을 사실로 확정한 채 계산됐다. 하필 '더 빌려야 한다' 쪽으로 틀리는
     방향이라, 금융 화면에서는 그냥 비워두는 것보다 나쁘다.

     계산 자체는 그대로 둔다 — 지원금을 빼기 전 금액은 '최대 이만큼' 이라는 뜻으로
     여전히 쓸모가 있다. 대신 화면에서 확정된 숫자처럼 보이지 않게 표시를 바꾼다. */
  const supportKnown = policySupport != null
  const support = num(policySupport)

  // 상품을 고르기 전에 아직 모자란 금액. 이 값으로 AI 가 상품을 고른다
  const neededAmount = Math.max(required - own - support, 0)

  /* 대출 상품 + AI 추천.
     부족한 금액과 소득을 함께 보내야 AI 가 고를 근거가 생긴다.
     후보가 1개뿐이면 서버가 AI 를 부르지 않고 recommendation: null 을 준다. */
  const [loans, setLoans] = useState([])
  const [productPick, setProductPick] = useState(null)
  useEffect(() => {
    recommendProducts({
      category: 'LOAN',
      neededAmount,
      monthlyIncome: num(monthlyIncome),
      currentAsset: own,
    })
      .then((res) => {
        setLoans((res.products ?? []).filter((p) => p.category === 'LOAN'))
        setProductPick(res.recommendation ?? null)
      })
      .catch(() => {
        setLoans([]) // 못 불러오면 '불러오지 못했어요' 안내가 뜬다
        setProductPick(null)
      })
    // 필요 금액이 바뀔 때마다 다시 부르면 크레딧이 샌다. 화면에 들어올 때 한 번만 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const loan = num(product?.amount) // 대출 — 상품을 고르기 전엔 0

  const funded = own + support + loan
  const gap = required - funded

  const parts = [
    { label: '자기자본', value: own, color: '#FFBC00' },
    { label: '지원금', value: support, color: '#FFD466' },
    /* 대출은 KB CI 브라운(#60584C). 처음엔 무채색 회색(#8E8E8E)을 썼는데
       '비활성' 처럼 보여서 도넛에서 제일 큰 조각이 죽어 보였다.
       사이드바와 같은 색이라 화면 전체와도 붙는다 */
    { label: '대출', value: loan, color: '#60584C' },
  ].filter((p) => p.value > 0)

  /* DSR = (연간 원리금 상환액 ÷ 연소득) × 100
           = (월 원리금 상환액 ÷ 월소득) × 100   ← 분자·분모에 12를 곱한 것과 같다

     기존 대출은 마이데이터의 '매달 상환액(assetMonthlyRepayment)' 을 쓴다.
     예전에는 이자(fixedCostLoanInterest)만 넣었는데, 그러면 원금을 빼먹어서
     DSR 이 실제보다 낮게 나온다. "빌릴 수 있다" 고 잘못 안내하게 되는 방향이라
     금융 화면에서는 그냥 틀린 것보다 나쁘다.

     마이데이터에 상환액이 없는 옛 데이터면 이자로 대신한다(그때는 과소 추정임을 화면에 밝힌다) */
  const newPayment = product ? monthlyPayment(loan, product.rate, product.years) : 0
  const existingRepayment = num(mydata?.assetMonthlyRepayment)
  const interestOnly = num(mydata?.fixedCostLoanInterest)
  const usesInterestOnly = existingRepayment <= 0 && interestOnly > 0
  const existingPayment = existingRepayment > 0 ? existingRepayment : interestOnly
  const totalPayment = newPayment + existingPayment
  const dsr =
    monthlyIncome > 0 ? Math.round((totalPayment / monthlyIncome) * 1000) / 10 : null
  const grade = dsrGrade(dsr)
  const tone = grade ? TONE[grade.tone] : TONE.warn

  /* AI 어드바이스 — 서버 API 가 붙으면 여기서 답변이 채워진다.
     지금은 askAi 가 AI_NOT_READY 를 던져서 안내만 뜬다 */
  const [advice, setAdvice] = useState(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceError, setAdviceError] = useState('')

  async function ask(question) {
    setAdviceError('')
    setAdviceLoading(true)
    try {
      const res = await askAi({ scope: 'funding', question, context: { required, own, support, loan, dsr, monthlyPayment: totalPayment } })
      setAdvice({ ...res, question })
    } catch (err) {
      setAdvice(null)
      setAdviceError(err instanceof ApiError ? err.message : 'AI 답변을 받지 못했어요.')
    } finally {
      setAdviceLoading(false)
    }
  }

  // 분석 결과가 없으면 계산할 기준이 없다
  if (!forecast) {
    return (
      <div className="min-h-screen flex bg-white">
        <Sidebar active="자금조달 설계" onNavigate={onNavigate} />
        <main className="flex-1 min-w-0 flex flex-col gap-5 px-5 sm:px-8 py-5">
          <TopBar
            userName={userName}
            onNavigate={onNavigate}
            onLogout={onLogout}
            title="자금조달 설계"
            subtitle="필요한 자금을 어떻게 마련할지 설계해요."
          />
          <section className={`${CARD} px-6 py-16 grid place-items-center`}>
            <div className="text-center max-w-[400px]">
              {/* ★ 아이콘 : 자금 설계 — public/assets/money_plan.png */}
              <img
                src="/assets/money_plan.png"
                alt=""
                className="h-[56px] w-auto object-contain mx-auto opacity-50"
              />
              <p className="mt-5 text-[17px] font-bold text-kb-brownDark">
                먼저 자취 목표를 정해주세요
              </p>
              <p className="mt-2 text-[14px] leading-[1.7] text-ink-500">
                희망 지역과 계약 방식을 고르면 필요한 자금이 계산돼요. 그 금액을 어떻게 마련할지
                여기서 설계할 수 있어요.
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.('자취 시뮬레이션')}
                className="mt-5 h-[48px] px-6 rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                  text-[15px] font-bold text-kb-brownDark transition-colors"
              >
                자취 시뮬레이션 하러 가기
              </button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-white">
      <Sidebar active="자금조달 설계" onNavigate={onNavigate} />

      <main className="flex-1 min-w-0 flex flex-col gap-5 px-5 sm:px-8 py-5 pb-14">
        <TopBar
          userName={userName}
          onNavigate={onNavigate}
          onLogout={onLogout}
          title="자금조달 설계"
          subtitle="필요한 자금을 자기자본·지원금·대출로 어떻게 나눌지 보여드려요."
        />

        {/* ① 내 목표 */}
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          <SectionTitle
            title="내 목표"
            right={`${forecast.region} · ${forecast.housingType === 'JEONSE' ? '전세' : '월세'} 기준`}
          />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[13px] text-ink-500">필요 초기자금</p>
              <p className="mt-1 text-[24px] font-extrabold text-kb-brownDark tabular-nums">
                {won(required)}
              </p>
            </div>
            <div>
              <p className="text-[13px] text-ink-500">예상 입주 시점</p>
              <p className="mt-1 text-[24px] font-extrabold text-kb-brownDark">
                {forecast.predictedStartDate ? yearMonth(forecast.predictedStartDate) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[13px] text-ink-500">지금 모은 금액 (순자산)</p>
              <p className="mt-1 text-[24px] font-extrabold text-kb-brownDark tabular-nums">
                {won(own)}
              </p>
            </div>
          </div>
        </section>

        {/* ② 추천 — 지금 무엇부터 해야 하는지 */}
        <AiPick
          {...(pickFunding({
            required,
            own,
            support,
            loan,
            dsr,
            monthsToGoal: forecast.estimatedMonths,
          }) ?? {})}
          advice={advice}
          loading={adviceLoading}
          error={adviceError}
          onAsk={ask}
          questions={['대출을 받는 게 나을까요, 더 모으는 게 나을까요?', '제 소득으로 얼마까지 빌릴 수 있나요?', '지원금부터 알아봐야 할까요?']}
        />

        {/* ③ 추천 금융상품 — 여기서 고른 상품이 아래 두 칸의 기준이 된다 */}
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          {/* 고른 상품이 있을 때만 오른쪽에 이름을 띄운다.
              고르기 전에 안내 문구를 넣으면, 아래 빈 상태 카드에 같은 말이 또 나온다 */}
          {/* AI 가 실제로 고른 경우에만 제목에 'AI' 를 붙인다.
              후보가 1개뿐이거나 호출이 실패하면 그냥 목록이므로 'AI 추천' 이라 부르면 거짓말이 된다 */}
          <SectionTitle
            title={productPick?.source === 'ai' ? 'AI 추천 금융상품' : '대출 상품'}
            right={product ? product.name : null}
          />

          {product ? (
            /* 고른 상품 요약 — 이 조건으로 아래 DSR 과 자금 구성이 계산된다 */
            <div className="mt-4 rounded-xl border border-kb-yellow bg-kb-yellowBg px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-[15px] font-bold text-kb-brownDark">{product.name}</span>
              <span className="text-[14px] text-ink-700 tabular-nums">{won(product.amount)}</span>
              <span className="text-[14px] text-ink-700">연 {product.rate}%</span>
              <span className="text-[14px] text-ink-700">{product.years}년</span>
              <span className="flex-1 min-w-[8px]" />
              <button
                type="button"
                onClick={() => chooseProduct(null)}
                className="h-[38px] px-4 rounded-xl border border-line bg-white hover:bg-gray-50
                  text-[13px] font-semibold text-ink-700 transition-colors"
              >
                선택 해제
              </button>
            </div>
          ) : loans.length > 0 ? (
            <>
              <p className="mt-2 text-[14px] leading-[1.7] text-ink-500">
                상품을 고르면 그 조건으로 아래 DSR 과 자금 구성이 계산돼요.
              </p>

              {/* 왜 이 상품을 권하는지. AI 가 골랐으면 AI 문장, 아니면 금리 기준 규칙 문장.
                  배지로 어느 쪽인지 밝힌다 — 규칙으로 고른 걸 AI 라고 부르지 않는다 */}
              {productPick && (
                <div className="mt-4 rounded-xl border border-kb-yellow bg-kb-yellowBg px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-[24px] px-2.5 rounded-full text-[12px] font-bold grid place-items-center ${
                        productPick.source === 'ai'
                          ? 'bg-kb-brownDark text-white'
                          : 'bg-white border border-kb-yellow text-kb-brownDark'
                      }`}
                    >
                      {productPick.source === 'ai' ? 'AI 분석' : '조건 기반'}
                    </span>
                    <p className="text-[15px] font-bold text-kb-brownDark">{productPick.headline}</p>
                  </div>

                  {productPick.reasons?.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {productPick.reasons.map((reason) => (
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

              <ul className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {loans.map((item) => {
                  /* 빌릴 금액 = 부족분과 상품 한도 중 작은 쪽.
                     한도를 넘겨 잡으면 실제로 받을 수 없는 계획이 된다 */
                  const amount = Math.min(Math.max(gap, 0), num(item.calc?.maxLimit))
                  const rate = num(item.calc?.minRate) // 최저 금리 기준 (심사에 따라 올라갈 수 있음)
                  const years = num(item.calc?.assumedYears)

                  const isPicked = productPick?.pickId === item.productId

                  return (
                    <li
                      key={item.productId}
                      className={`rounded-xl border bg-white px-5 py-5 flex flex-col ${
                        isPicked ? 'border-kb-yellow' : 'border-line'
                      }`}
                    >
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

                      {/* specs 는 서버가 준 표시용 문자열을 그대로 보여준다 */}
                      <ul className="mt-3 space-y-1.5">
                        {(item.specs ?? []).map((spec) => (
                          <li key={spec.label} className="flex items-center justify-between gap-3 text-[13px]">
                            <span className="text-ink-500">{spec.label}</span>
                            <span className="font-semibold text-ink-900">{spec.value}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex-1 min-h-[10px]" />

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => chooseProduct({ name: item.name, amount, rate, years })}
                          disabled={amount <= 0}
                          className="flex-1 h-[44px] rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                            disabled:opacity-50 disabled:cursor-not-allowed
                            text-[14px] font-bold text-kb-brownDark transition-colors"
                        >
                          {amount > 0 ? `${won(amount)} 넣어보기` : '더 필요한 금액이 없어요'}
                        </button>
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                            className="h-[44px] px-4 grid place-items-center rounded-xl border border-line
                              bg-white hover:bg-gray-50 text-[13px] font-semibold text-ink-700 transition-colors"
                          >
                            상세
                          </a>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>

              <p className="mt-3 text-[13px] leading-[1.6] text-ink-500">
                금액은 부족분과 상품 한도 중 작은 값, 금리는 최저 금리로 계산했어요. 실제 조건은
                심사 결과에 따라 달라져요.
                {/* 빌릴 금액이 gap 에서 나오므로, 지원금을 안 뺀 상태면 실제보다 크게 잡힌다.
                    '더 빌리라' 고 잘못 안내하는 방향이라 반드시 밝히고 간다 */}
                {!supportKnown && (
                  <>
                    {' '}
                    <span className="font-semibold text-ink-700">
                      지원금을 아직 빼기 전이라 실제로 필요한 금액은 이보다 적을 수 있어요.
                    </span>
                  </>
                )}
              </p>
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-line bg-gray-50 px-5 py-10 text-center">
              {/* ★ 아이콘 : 자금 설계 — public/assets/money_plan.png */}
              <img
                src="/assets/money_plan.png"
                alt=""
                className="h-[48px] w-auto object-contain mx-auto opacity-50"
              />
              <p className="mt-4 text-[15px] font-bold text-kb-brownDark">
                대출 상품 정보를 불러오지 못했어요
              </p>
              <p className="mt-2 text-[13px] leading-[1.7] text-ink-500">
                잠시 후 다시 시도하거나, 서버 상태를 확인해주세요.
              </p>
            </div>
          )}
        </section>

        {/* ③ DSR 점검 */}
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          <SectionTitle
            title="DSR 점검"
            right={dsr != null ? `${dsr}% · ${grade.label}` : '소득 입력 필요'}
          />
          <p className="mt-2 text-[14px] leading-[1.7] text-ink-500">
            DSR 은 <span className="font-bold">소득에서 대출 상환에 쓰는 비율</span>이에요. 은행은
            보통 40% 를 넘으면 대출을 내주지 않아요.
          </p>

          {dsr == null ? (
            <p className="mt-4 rounded-xl border border-line bg-gray-50 px-4 py-3 text-[14px] text-ink-500">
              월 소득을 입력하면 상환 부담을 계산해드려요.
            </p>
          ) : (
            <>
              {/* 막대 — 30%·40% 눈금 표시 */}
              <div className="mt-5">
                <div className="relative h-[12px] rounded-full bg-line overflow-hidden">
                  <span
                    className={`block h-full rounded-full ${tone.bar}`}
                    style={{ width: `${Math.min(dsr, 100)}%` }}
                  />
                </div>
                <div className="relative mt-1 h-[16px]">
                  <span className="absolute -translate-x-1/2 text-[11px] text-ink-500" style={{ left: '30%' }}>
                    30%
                  </span>
                  <span
                    className="absolute -translate-x-1/2 text-[11px] font-bold text-ink-700"
                    style={{ left: '40%' }}
                  >
                    40% 규제선
                  </span>
                </div>
              </div>

              <div className={`mt-4 rounded-xl border px-5 py-4 ${tone.bg} ${tone.border}`}>
                <p className={`text-[16px] font-bold ${tone.text}`}>
                  {grade.label} · DSR {dsr}%
                </p>
                <p className="mt-1 text-[14px] leading-[1.7] text-ink-700">
                  {product
                    ? grade.desc
                    : '아직 대출을 넣지 않은 상태예요. 기존 대출 상환액만 반영했어요.'}
                </p>
              </div>

              <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <li className="rounded-xl border border-line bg-gray-50 px-4 py-3">
                  <p className="text-[12px] text-ink-500">새 대출 월 상환액</p>
                  <p className="mt-1 text-[17px] font-bold tabular-nums">
                    {product ? won(newPayment) : <span className="text-ink-300">—</span>}
                  </p>
                </li>
                <li className="rounded-xl border border-line bg-gray-50 px-4 py-3">
                  {/* 원금+이자를 다 넣는 게 DSR 의 정의다. 이자만 쓸 수밖에 없는 경우는 이름을 다르게 적는다 */}
                  <p className="text-[12px] text-ink-500">
                    {usesInterestOnly ? '기존 대출이자' : '기존 대출 월 상환액'}
                  </p>
                  <p className="mt-1 text-[17px] font-bold tabular-nums">{won(existingPayment)}</p>
                </li>
                <li className="rounded-xl border border-line bg-gray-50 px-4 py-3">
                  <p className="text-[12px] text-ink-500">합계 (월)</p>
                  <p className="mt-1 text-[17px] font-bold tabular-nums">{won(totalPayment)}</p>
                </li>
              </ul>

              {/* 계산 근거를 밝힌다. 금리·기간을 우리가 정하지 않았다는 점이 중요 */}
              <p className="mt-3 text-[13px] leading-[1.6] text-ink-500">
                {product
                  ? `${product.name}의 조건(연 ${product.rate}% · ${product.years}년, 원리금균등)으로 계산했어요.`
                  : '대출 상품을 고르면 그 상품의 금리와 기간으로 다시 계산돼요.'}
                {usesInterestOnly && (
                  <>
                    {' '}
                    기존 대출은 매달 상환액을 알 수 없어 이자만 넣었어요. 실제 DSR 은 이보다 높습니다.
                  </>
                )}
              </p>
            </>
          )}
        </section>

        

        {/* ④ 자금조달 구성 */}
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          <SectionTitle title="자금조달 구성" />

          <div className="mt-5 flex flex-col lg:flex-row gap-8 items-start">
            {/* 달성률은 도넛 안이 아니라 아래에 문장으로 둔다.
                안에 넣으면 금액·부족액과 숫자가 세 줄로 겹쳐서 어느 게 뭔지 읽기 어려움 */}
            <div className="shrink-0 flex flex-col items-center">
              <Donut
                parts={parts}
                total={required} /* 한 바퀴 = 필요 초기자금 */
                center={
                  <>
                    <span className="text-[12px] text-ink-500">마련한 금액</span>
                    {/* 원 단위 그대로 쓰면 도넛 구멍을 넘는다. 정확한 금액은 오른쪽 목록에 다 있음 */}
                    <span className="mt-0.5 text-[20px] font-extrabold text-kb-brownDark tabular-nums whitespace-nowrap">
                      {wonShort(funded)}
                    </span>
                    <span
                      className={`mt-1 text-[12px] font-bold ${gap > 0 ? 'text-danger' : 'text-ok'}`}
                    >
                      {gap > 0
                        ? `${wonShort(gap)} 부족`
                        : gap < 0
                          ? `${wonShort(-gap)} 초과`
                          : '목표 달성'}
                    </span>
                  </>
                }
              />
              {/* 도넛의 노란 조각과 같은 색 계열로 묶어서, 이 문장이 도넛을 설명한다는 게 보이게 */}
              {required > 0 && (
                <p className="mt-3 px-3.5 py-1.5 rounded-full bg-kb-yellowBg border border-kb-yellowSoft text-[14px] font-semibold text-kb-brownDark">
                  목표 금액까지{' '}
                  <span className="text-[16px] font-extrabold text-kb-yellowDark tabular-nums">
                    {Math.min(Math.round((funded / required) * 100), 100)}%
                  </span>{' '}
                  달성
                </p>
              )}
              {/* 지원금을 안 알아본 상태면 이 % 는 '아직 최솟값' 이다. 그렇다고 말해준다 */}
              {required > 0 && !supportKnown && (
                <p className="mt-2 text-[12px] leading-[1.5] text-ink-500 text-center">
                  지원금은 아직 빼기 전이라
                  <br />
                  확인하면 더 올라갈 수 있어요
                </p>
              )}
            </div>

            <div className="flex-1 min-w-0 w-full">
              <ul>
                <PartRow
                  color="#FFBC00"
                  label="자기자본"
                  source="마이데이터 순자산"
                  amount={own}
                />
                <PartRow
                  color="#FFD466"
                  label="지원금"
                  /* 확인 전이면 금액을 0원으로 적지 않는다 — 0원은 '알아봤는데 없더라' 는 뜻이라
                     아직 안 알아본 상태와 섞이면 안 된다 */
                  source={
                    !supportKnown
                      ? '아직 확인 전이에요'
                      : support > 0
                        ? '맞춤 정책·지원금'
                        : '받을 수 있는 지원금이 없어요'
                  }
                  amount={supportKnown ? support : null}
                  muted={!supportKnown || support === 0}
                />
                <PartRow
                  color="#60584C"
                  label="대출"
                  source={product ? product.name : '상품 선택 전'}
                  amount={loan}
                  muted={loan === 0}
                />
              </ul>

              <div className="mt-4 pt-4 border-t border-line flex items-center gap-3">
                <span className="text-[14px] font-bold text-kb-brownDark">
                  {supportKnown ? '아직 모자란 금액' : '지원금 빼기 전 모자란 금액'}
                </span>
                <span className="flex-1 min-w-[8px]" />
                <span
                  className={`text-[17px] font-extrabold tabular-nums ${
                    gap > 0 ? 'text-danger' : 'text-ok'
                  }`}
                >
                  {gap > 0 ? `${supportKnown ? '' : '최대 '}${won(gap)}` : '없어요'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onNavigate?.('맞춤 정책·지원금')}
                className="mt-4 h-[42px] px-4 rounded-xl border border-line bg-white hover:bg-gray-50
                  text-[13px] font-semibold text-ink-700 transition-colors"
              >
                받을 수 있는 지원금 확인하기
              </button>
            </div>
          </div>
        </section>
        

      </main>
    </div>
  )
}
