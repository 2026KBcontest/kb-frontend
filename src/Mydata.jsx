/* ============================================================
   KB 청년 자취 도우미 — 마이데이터 연결 (시나리오 ②)
   독립만세팀 / KB AI Challenge 2026

   회원가입(Signup.jsx) 다음 화면.
   여기서 두 가지를 끝내야 다음 단계(자취 목표 설정)로 갈 수 있음.

   1. 월 평균 소득 입력  → PATCH /api/users/me/income
   2. 금융기관 연결      → POST  /api/mydata/sync

   ※ 왜 소득을 직접 입력받는가
     /api/mydata/sync 응답에는 소비·자산·부채만 있고 '소득' 이 없음.
     그리고 자취 시점 예측(POST /api/forecast/simulate)은 소득이 없으면
     SIMULATION_002 에러를 돌려줌. 그래서 이 화면에서 반드시 받아둬야 함.

   ※ 금융기관 카드는 2장이지만 서버 API 는 sync 하나뿐임.
     sync 는 같은 값을 upsert 하는 멱등 호출이라 각 카드에서 불러도 문제 없음.
   ============================================================ */

import { useState } from 'react'
import { updateIncome, syncMydata, ApiError } from './api.js'
// saveIncome 은 이 파일의 폼 제출 함수와 이름이 겹쳐서 별칭으로 가져옴
import { saveMydata, saveIncome as rememberIncome } from './store.js'


/* ---------- 진행 단계 (Signup.jsx 와 같은 배열) ---------- */

const STEPS = ['회원가입', '마이데이터 연결', '자취 목표 설정', 'AI 분석']


/* ---------- 연결할 금융기관 ---------- */

const INSTITUTIONS = [
  {
    id: 'kb-bank',
    name: 'KB국민은행',
    desc: '대표계좌',
    // ★ 아이콘 : KB 로고 — public/assets/KB_logo.png
    icon: '/assets/KB_logo.png',
    ready: true,
  },
  {
    id: 'kb-card',
    name: '국민카드',
    desc: '신용 / 체크카드',
    // ★ 아이콘 : 국민카드 로고 — 지금은 KB 로고를 같이 쓰는 중. 카드 로고 구하면 교체
    icon: '/assets/KB_logo.png',
    ready: true,
  },
  {
    id: 'others',
    name: '다른 금융기관',
    desc: '준비중',
    icon: null,
    ready: false,
  },
]


/* ---------- sync 응답 필드 → 화면 항목 ---------- */

/* 서버 응답 키를 그대로 쓰면 화면 코드에 영어 키가 흩어짐.
   여기 한 곳에만 두고, 항목이 늘거나 이름이 바뀌면 이 배열만 고치면 됨 */

const VARIABLE_COST = [
  { key: 'food', label: '식비' },
  { key: 'shopping', label: '쇼핑' },
  { key: 'culture', label: '문화·취미' },
  { key: 'etc', label: '기타 소비' },
]

const FIXED_COST = [
  { key: 'fixedCostHousing', label: '주거비' },
  { key: 'fixedCostTransport', label: '교통비' },
  { key: 'fixedCostTelecom', label: '통신비' },
  { key: 'fixedCostInsurance', label: '보험료' },
  { key: 'fixedCostLoanInterest', label: '대출이자' },
  { key: 'fixedCostSubscription', label: '구독료' },
]

const ASSETS = [
  { key: 'assetDeposit', label: '예금' },
  { key: 'assetSaving', label: '적금' },
  { key: 'assetInvestment', label: '투자 자산' },
]

const DEBTS = [
  { key: 'assetLoan', label: '대출 총액' },
  { key: 'assetRemainingRepayment', label: '남은 상환액' },
]

const won = (n) => `${Number(n ?? 0).toLocaleString('ko-KR')}원`
const sumOf = (fields, data) => fields.reduce((s, f) => s + Number(data[f.key] ?? 0), 0)

// 입력칸에 콤마를 넣어 보여주기 위한 변환 (숫자만 남김)
const digitsOnly = (v) => v.replace(/\D/g, '').slice(0, 12)
const withComma = (v) => (v ? Number(v).toLocaleString('ko-KR') : '')


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

// 데이터 묶음 제목. 왼쪽 옐로우 세로바로 구분
function GroupTitle({ title, total }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="flex items-center gap-2.5 text-[16px] font-bold text-kb-brownDark">
        <span className="w-[3px] h-[16px] rounded-full bg-kb-yellow" aria-hidden />
        {title}
      </h3>
      {total != null && (
        <span className="text-[15px] font-bold text-kb-brownDark tabular-nums">{won(total)}</span>
      )}
    </div>
  )
}

// 항목 한 줄. max 를 주면 비중 막대를 함께 그림
function Row({ label, amount, max }) {
  const ratio = max ? Math.round((Number(amount ?? 0) / max) * 100) : null

  return (
    <li className="flex items-center gap-3 py-[7px]">
      <span className="w-[78px] shrink-0 text-[14px] text-ink-700">{label}</span>

      {ratio != null && (
        <span className="flex-1 min-w-0 h-[6px] rounded-full bg-line overflow-hidden">
          <span className="block h-full rounded-full bg-kb-yellow" style={{ width: `${ratio}%` }} />
        </span>
      )}

      <span
        className={`shrink-0 text-[14px] tabular-nums ${
          Number(amount ?? 0) === 0 ? 'text-ink-300' : 'font-semibold text-ink-900'
        } ${ratio == null ? 'ml-auto' : ''}`}
      >
        {won(amount)}
      </span>
    </li>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <p className="mt-5 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-[14px] leading-[1.6] text-danger">
      {message}
    </p>
  )
}


/* ---------- 마이데이터 화면 ---------- */

export default function Mydata({ onNext, onBack }) {
  /* 소득 */
  const [incomeText, setIncomeText] = useState('')
  const [incomeSaved, setIncomeSaved] = useState(false)
  const [savingIncome, setSavingIncome] = useState(false)
  const [incomeError, setIncomeError] = useState('')

  /* 기관별 상태 : idle → loading → done */
  const [status, setStatus] = useState({ 'kb-bank': 'idle', 'kb-card': 'idle' })
  const [syncError, setSyncError] = useState('')

  /* sync 로 받아온 소비·자산·부채 값 */
  const [data, setData] = useState(null)

  const income = Number(incomeText || 0)

  async function saveIncome(ev) {
    ev.preventDefault()
    setIncomeError('')

    if (!incomeText) {
      setIncomeError('월 평균 소득을 입력해주세요.')
      return
    }

    setSavingIncome(true)
    try {
      // PATCH /api/users/me/income — 응답 바디 없음
      await updateIncome(income)
      rememberIncome(income) // 홈화면이 꺼내 쓸 수 있게 보관 (조회 API 가 없어서)
      setIncomeSaved(true)
    } catch (err) {
      setIncomeError(
        err instanceof ApiError ? err.message : '소득 저장에 실패했어요. 다시 시도해주세요.',
      )
    } finally {
      setSavingIncome(false)
    }
  }

  async function connect(id) {
    setSyncError('')
    setStatus((prev) => ({ ...prev, [id]: 'loading' }))

    try {
      // POST /api/mydata/sync — 요청 바디 없음. 같은 값을 다시 받는 멱등 호출
      const result = await syncMydata()
      setData(result)
      saveMydata(result) // 홈화면이 꺼내 쓸 수 있게 보관
      setStatus((prev) => ({ ...prev, [id]: 'done' }))
    } catch (err) {
      setStatus((prev) => ({ ...prev, [id]: 'idle' }))
      setSyncError(
        err instanceof ApiError ? err.message : '연결에 실패했어요. 다시 시도해주세요.',
      )
    }
  }

  const allConnected = status['kb-bank'] === 'done' && status['kb-card'] === 'done'
  const doneCount = Object.values(status).filter((s) => s === 'done').length

  // 소득까지 저장돼야 다음 단계(자취 목표 설정)에서 예측이 가능함
  const canGoNext = incomeSaved && allConnected && data != null

  const spendingTotal = data ? sumOf(VARIABLE_COST, data) + sumOf(FIXED_COST, data) : 0
  const monthlySaving = income - spendingTotal

  // 비중 막대의 기준 — 소비 항목 중 가장 큰 값
  const spendingMax = data
    ? Math.max(...[...VARIABLE_COST, ...FIXED_COST].map((f) => Number(data[f.key] ?? 0)), 1)
    : 1

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
          <Stepper current={1} />
        </div>

        {/* ① 월 평균 소득 */}
        <form
          onSubmit={saveIncome}
          className="rounded-2xl border border-line bg-white px-6 sm:px-10 py-8"
          style={{ boxShadow: '0 6px 24px -8px rgba(74, 68, 59, 0.28)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[28px] font-extrabold tracking-tight text-kb-brownDark">
                월 평균 소득
              </h1>
              <p className="mt-2 text-[15px] leading-[1.6] text-ink-500">
                마이데이터로는 소득이 조회되지 않아 직접 입력이 필요해요.
                <br />
                세후 실수령액을 기준으로 적어주세요.
              </p>
            </div>

            {/* ★ 아이콘 : 자금 계획 — public/assets/money_plan.png */}
            <img
              src="/assets/money_plan.png"
              alt=""
              className="hidden sm:block h-[52px] w-auto object-contain shrink-0"
            />
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                inputMode="numeric"
                value={withComma(incomeText)}
                onChange={(ev) => {
                  setIncomeText(digitsOnly(ev.target.value))
                  setIncomeSaved(false) // 값을 고치면 다시 저장해야 함
                }}
                placeholder="2,000,000"
                className={`w-full h-[54px] pl-4 pr-12 rounded-xl border bg-white text-[16px]
                  text-ink-900 tabular-nums placeholder:text-ink-300 outline-none transition-colors
                  focus:border-kb-yellow focus:ring-2 focus:ring-kb-yellow/30
                  ${incomeError ? 'border-danger' : 'border-line'}`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-ink-500">
                원
              </span>
            </div>

            <button
              type="submit"
              disabled={savingIncome}
              className={`shrink-0 h-[54px] px-8 rounded-xl text-[16px] font-bold transition-colors
                disabled:opacity-60 ${
                  incomeSaved
                    ? 'border border-kb-yellow bg-kb-yellowBg text-kb-brownDark'
                    : 'bg-kb-yellow hover:bg-kb-yellowDark text-kb-brownDark'
                }`}
            >
              {savingIncome ? '저장 중…' : incomeSaved ? '✓ 저장됨' : '저장하기'}
            </button>
          </div>

          <ErrorBanner message={incomeError} />
        </form>

        {/* ② 금융기관 연결 */}
        <section
          className="mt-5 rounded-2xl border border-line bg-white px-6 sm:px-10 py-8"
          style={{ boxShadow: '0 6px 24px -8px rgba(74, 68, 59, 0.28)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[24px] font-extrabold tracking-tight text-kb-brownDark">
                마이데이터 연결
              </h2>
              <p className="mt-2 text-[15px] leading-[1.6] text-ink-500">
                소비·자산 정보를 불러와 자취 가능 시점을 계산해요.
              </p>
            </div>

            {/* ★ 아이콘 : 마이데이터 — public/assets/mydata.png */}
            <img
              src="/assets/mydata.png"
              alt=""
              className="hidden sm:block h-[52px] w-auto object-contain shrink-0"
            />
          </div>

          {/* 진행 상황 */}
          <div className="mt-6 flex items-center gap-3">
            <span className="flex-1 h-[8px] rounded-full bg-line overflow-hidden">
              <span
                className="block h-full rounded-full bg-kb-yellow transition-all duration-500"
                style={{ width: `${(doneCount / 2) * 100}%` }}
              />
            </span>
            <span className="shrink-0 text-[14px] font-bold text-kb-brownDark tabular-nums">
              {doneCount} / 2
            </span>
          </div>

          <ul className="mt-6 space-y-3">
            {INSTITUTIONS.map((inst) => {
              const state = status[inst.id] ?? 'idle'
              const isDone = state === 'done'
              const isLoading = state === 'loading'

              return (
                <li
                  key={inst.id}
                  className={`flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors ${
                    isDone
                      ? 'border-kb-yellow bg-kb-yellowBg'
                      : inst.ready
                        ? 'border-line bg-white'
                        : 'border-line bg-gray-50'
                  }`}
                >
                  {inst.icon ? (
                    <img src={inst.icon} alt="" className="h-[34px] w-auto object-contain shrink-0" />
                  ) : (
                    <span
                      className="shrink-0 w-[34px] h-[34px] rounded-lg border border-dashed border-ink-300"
                      aria-hidden
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[16px] font-bold ${
                        inst.ready ? 'text-kb-brownDark' : 'text-ink-300'
                      }`}
                    >
                      {inst.name}
                    </p>
                    <p className="mt-0.5 text-[14px] text-ink-500">{inst.desc}</p>
                  </div>

                  {!inst.ready ? (
                    <span className="shrink-0 text-[14px] font-semibold text-ink-300">준비중</span>
                  ) : isDone ? (
                    <span className="shrink-0 flex items-center gap-1.5 text-[15px] font-bold text-kb-brownDark">
                      <span
                        className="grid place-items-center w-[22px] h-[22px] rounded-full bg-kb-yellow text-[13px]"
                        aria-hidden
                      >
                        ✓
                      </span>
                      연결 완료
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => connect(inst.id)}
                      disabled={isLoading}
                      className="shrink-0 h-[44px] px-6 rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                        disabled:opacity-60 text-[15px] font-bold text-kb-brownDark transition-colors"
                    >
                      {isLoading ? '불러오는 중…' : '연결하기'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          <ErrorBanner message={syncError} />

          <p className="mt-6 flex items-start gap-2.5 text-[13px] leading-[1.6] text-ink-500">
            {/* ★ 아이콘 : 방패 — public/assets/shield.png */}
            <img src="/assets/shield.png" alt="" className="h-[18px] w-auto object-contain shrink-0 mt-px" />
            불러온 정보는 자취 가능 시점 예측과 정책 추천에만 사용되고, 언제든 연결을 해제할 수 있어요.
          </p>
        </section>

        {/* ③ 불러온 정보 — sync 응답이 있을 때만 */}
        {data && (
          <section
            className="mt-5 rounded-2xl border border-line bg-white px-6 sm:px-10 py-8"
            style={{ boxShadow: '0 6px 24px -8px rgba(74, 68, 59, 0.28)' }}
          >
            <h2 className="text-[21px] font-extrabold tracking-tight text-kb-brownDark">
              불러온 정보
            </h2>
            <p className="mt-2 text-[15px] text-ink-500">최근 3개월 평균을 기준으로 정리했어요.</p>

            {/* 소득 / 소비 요약 */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-line bg-kb-yellowBg px-5 py-4">
                <p className="text-[14px] text-ink-500">월 평균 소득</p>
                <p className="mt-1.5 text-[24px] font-extrabold text-kb-brownDark tabular-nums">
                  {income > 0 ? won(income) : '미입력'}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-kb-yellowBg px-5 py-4">
                <p className="text-[14px] text-ink-500">월 평균 소비</p>
                <p className="mt-1.5 text-[24px] font-extrabold text-kb-brownDark tabular-nums">
                  {won(spendingTotal)}
                </p>
              </div>
            </div>

            {/* 변동비 / 고정비 */}
            <div className="mt-8">
              <GroupTitle title="변동 소비" total={sumOf(VARIABLE_COST, data)} />
              <ul className="mt-3">
                {VARIABLE_COST.map((f) => (
                  <Row key={f.key} label={f.label} amount={data[f.key]} max={spendingMax} />
                ))}
              </ul>
            </div>

            <div className="mt-7">
              <GroupTitle title="고정 지출" total={sumOf(FIXED_COST, data)} />
              <ul className="mt-3">
                {FIXED_COST.map((f) => (
                  <Row key={f.key} label={f.label} amount={data[f.key]} max={spendingMax} />
                ))}
              </ul>
            </div>

            {/* 자산 / 부채 */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <GroupTitle title="자산 정보" total={sumOf(ASSETS, data)} />
                <ul className="mt-3">
                  {ASSETS.map((f) => (
                    <Row key={f.key} label={f.label} amount={data[f.key]} />
                  ))}
                </ul>
              </div>

              <div>
                <GroupTitle title="부채 정보" />
                <ul className="mt-3">
                  {DEBTS.map((f) => (
                    <Row key={f.key} label={f.label} amount={data[f.key]} />
                  ))}
                </ul>
              </div>
            </div>

            {/* 자동 계산 — 소득을 저장한 뒤에만 계산이 됨

                여기는 '소득 − 지출' 뺄셈일 뿐이라 AI 가 아니다.
                예전 라벨이 'AI 자동 계산' 이었는데, 이렇게 아무 데나 AI 를 붙이면
                정작 진짜 AI 를 쓴 곳(정책·지역 추천, 코치 한마디)의 설득력이 같이 떨어진다. */}
            <div className="mt-8 rounded-xl border border-kb-yellowSoft bg-kb-yellowBg px-5 py-5">
              <div className="flex items-start gap-3">
                {/* ★ 아이콘 : 전구 — public/assets/light_bulb.png */}
                <img
                  src="/assets/light_bulb.png"
                  alt=""
                  className="h-[30px] w-auto object-contain shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-kb-brownDark">Tip!</p>

                  {income > 0 ? (
                    <>
                      <p className="mt-2 text-[14px] text-ink-700">
                        월 평균 저축액 = <span className="tabular-nums">{won(income)}</span> −{' '}
                        <span className="tabular-nums">{won(spendingTotal)}</span> ={' '}
                        <span
                          className={`font-bold tabular-nums ${
                            monthlySaving > 0 ? 'text-kb-brownDark' : 'text-danger'
                          }`}
                        >
                          {won(monthlySaving)}
                        </span>
                      </p>

                      {monthlySaving > 0 ? (
                        <p className="mt-2.5 text-[14px] leading-[1.65] text-ink-700">
                          이 저축 속도를 기준으로 다음 단계에서 자취 가능 시점을 예측해드려요.
                        </p>
                      ) : (
                        // 저축액이 0 이하면 서버가 예측 불가(estimatedMonths: null)로 응답함
                        <p className="mt-2.5 text-[14px] leading-[1.65] text-danger">
                          소비가 소득보다 많아 저축 여력이 없어요. 이 상태로는 자취 시점을 예측할 수
                          없으니 고정 지출을 먼저 점검해보세요.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-[14px] leading-[1.65] text-ink-700">
                      위에서 월 평균 소득을 저장하면 저축 여력을 계산해드려요.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 다음 단계로 */}
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="mt-6 w-full h-[62px] rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
            disabled:bg-line disabled:text-ink-300 disabled:cursor-not-allowed
            text-[18px] font-bold text-kb-brownDark transition-colors"
        >
          {canGoNext
            ? '다음 (자취 목표 설정)'
            : !incomeSaved
              ? '월 평균 소득을 저장해주세요'
              : '금융기관을 모두 연결해주세요'}
        </button>
      </main>
    </div>
  )
}
