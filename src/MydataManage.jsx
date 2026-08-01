/* ============================================================
   KB 청년 자취 도우미 — 마이데이터 관리
   독립만세팀 / KB AI Challenge 2026

   사이드바의 [마이데이터 관리] 메뉴 화면.

   회원가입 직후의 Mydata.jsx 는 '처음 연결하는' 화면이고,
   이 화면은 '이미 연결한 뒤 관리하는' 화면이라 목적이 다르다.
     - 연결 상태를 보고 다시 불러오기
     - 불러온 소비·자산·부채를 항목별로 확인
     - 월 소득을 고치기
     - 연결 해제

   ※ 지금은 조회 API(GET /api/mydata, GET /api/users/me)가 없어서
     화면을 열자마자 값을 보여줄 수 없다. 그래서 '다시 불러오기' 를 눌러야
     POST /api/mydata/sync 로 값을 받아온다.
     조회 API 가 생기면 useEffect 로 처음에 한 번 불러오면 됨.
     (BACKEND_REQUEST_2D.md 6번)
   ============================================================ */

import { useEffect, useState } from 'react'
import { Sidebar, TopBar } from './Shell.jsx'
import { syncMydata, updateIncome, getUser, ApiError } from './api.js'
// saveIncome 은 이 파일의 폼 제출 함수와 이름이 겹쳐서 별칭으로 가져옴
import { saveMydata, saveIncome as rememberIncome, useAppData } from './store.js'


/* ---------- 연결 기관 ---------- */

const INSTITUTIONS = [
  { id: 'kb-bank', name: 'KB국민은행', desc: '대표계좌', icon: '/assets/KB_logo.png', ready: true },
  // ★ 아이콘 : 국민카드 로고 — 지금은 KB 로고를 같이 쓰는 중
  { id: 'kb-card', name: '국민카드', desc: '신용 / 체크카드', icon: '/assets/KB_logo.png', ready: true },
  { id: 'others', name: '다른 금융기관', desc: '준비중', icon: null, ready: false },
]


/* ---------- sync 응답 필드 → 화면 항목 ---------- */

const VARIABLE_COST = [
  { key: 'food', label: '식비', icon: '/assets/food.png' },
  { key: 'shopping', label: '쇼핑', icon: null },
  { key: 'culture', label: '문화·취미', icon: null },
  { key: 'etc', label: '기타 소비', icon: null },
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

/* 부채는 두 값을 더하면 안 된다.
   assetLoan(2,000만) 은 '처음 빌린 총액', assetRemainingRepayment(1,500만) 는
   '그중 아직 안 갚은 금액' 이라 같은 대출을 두 관점으로 본 값이다.
   더하면 이중 계산이 되고, 실제 갚아야 할 빚은 '남은 상환액' 1,500만원이다.

   ★ 백엔드 ForecastService.calculateCurrentAsset 도 두 값을 더하고 있어서
     순자산이 −1,700만원으로 나온다. 바로잡으면 +300만원.
     (BACKEND_REQUEST_2D.md 에 요청해둠) */

// 화면에 보여줄 항목 — 합계에는 남은 상환액만 쓴다
const DEBT_TOTAL_KEY = 'assetRemainingRepayment'
const DEBTS = [
  { key: 'assetRemainingRepayment', label: '남은 상환액', main: true },
  { key: 'assetLoan', label: '최초 대출액', main: false },
]

const won = (n) => `${Number(n ?? 0).toLocaleString('ko-KR')}원`
const sumOf = (fields, data) => fields.reduce((s, f) => s + Number(data[f.key] ?? 0), 0)

const digitsOnly = (v) => v.replace(/\D/g, '').slice(0, 12)
const withComma = (v) => (v ? Number(v).toLocaleString('ko-KR') : '')

const CARD = 'rounded-2xl border border-line bg-white'


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

/* 비중 숫자. 1% 미만이 '0%' 로 보이면 값이 없는 것처럼 읽혀서 소수 첫째 자리까지 쓴다 */
const percentText = (share) => (share >= 10 ? `${Math.round(share)}%` : `${share.toFixed(1)}%`)

/* 항목 한 줄. total(월 총지출)을 주면 비중 막대와 % 를 함께 그린다.

   ★ 기준을 '가장 큰 항목' 이 아니라 '전체 합계' 로 잡는다.
     최댓값 기준이면 제일 큰 항목이 항상 100% 로 꽉 차서,
     주거비가 전체의 30% 인데도 '전부 주거비' 처럼 보인다. 실제로 그렇게 보였다. */

function Row({ label, amount, total, muted }) {
  const value = Number(amount ?? 0)
  const share = total > 0 ? (value / total) * 100 : null

  return (
    <li className="flex items-center gap-2.5 py-[7px]">
      <span className={`w-[76px] shrink-0 text-[14px] ${muted ? 'text-ink-300' : 'text-ink-700'}`}>
        {label}
      </span>

      {share != null && (
        <>
          <span className="flex-1 min-w-[24px] h-[6px] rounded-full bg-line overflow-hidden">
            {/* 값이 있는데 막대가 안 보이면 0원으로 오해하므로 최소 폭을 준다 */}
            <span
              className="block h-full rounded-full bg-kb-yellow"
              style={{ width: `${value > 0 ? Math.max(share, 1.5) : 0}%` }}
            />
          </span>
          <span
            className={`w-[42px] shrink-0 text-right text-[13px] tabular-nums ${
              value === 0 ? 'text-ink-300' : 'text-ink-500'
            }`}
          >
            {percentText(share)}
          </span>
        </>
      )}

      <span
        className={`shrink-0 w-[104px] text-right text-[14px] tabular-nums ${
          value === 0 || muted ? 'text-ink-300' : 'font-semibold text-ink-900'
        } ${share == null ? 'ml-auto' : ''}`}
      >
        {won(amount)}
      </span>
    </li>
  )
}

function Banner({ tone = 'danger', children }) {
  if (!children) return null
  const skin =
    tone === 'ok'
      ? 'border-kb-yellow/45 bg-kb-yellowBg text-kb-brownDark'
      : 'border-danger/40 bg-danger/5 text-danger'
  return (
    <p className={`mt-4 rounded-xl border px-4 py-3 text-[14px] leading-[1.6] ${skin}`}>{children}</p>
  )
}


/* ---------- 마이데이터 관리 화면 ---------- */

export default function MydataManage({ onNavigate, onLogout }) {
  /* GET /api/mydata 로 마지막 연동 결과를 받아온다.
     연동한 적이 없으면 서버가 MYDATA_002 를 주고, 그때는 빈 상태로 그린다 */
  const [saved] = useAppData()
  const userName = saved.me?.name ?? getUser()?.name ?? '고객'

  /* 소비·자산·부채 (sync 응답) */
  const [data, setData] = useState(saved.mydata)
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState(saved.syncedAt ? new Date(saved.syncedAt) : null)
  const [syncError, setSyncError] = useState('')

  /* 월 소득 */
  const [incomeText, setIncomeText] = useState(
    saved.monthlyIncome ? String(saved.monthlyIncome) : '',
  )
  const [savingIncome, setSavingIncome] = useState(false)
  const [incomeMsg, setIncomeMsg] = useState('')
  const [incomeError, setIncomeError] = useState('')

  const income = Number(incomeText || 0)
  const connected = data != null

  const spendingTotal = data ? sumOf(VARIABLE_COST, data) + sumOf(FIXED_COST, data) : 0
  // 순자산 = 자산 − 남은 상환액 (최초 대출액은 참고용이라 빼지 않음)
  const debtTotal = data ? Number(data[DEBT_TOTAL_KEY] ?? 0) : 0
  const netAsset = data ? sumOf(ASSETS, data) - debtTotal : 0
  const monthlySaving = income - spendingTotal

  /* 비중 막대의 기준은 spendingTotal(월 총지출).
     예전에는 '가장 큰 항목' 을 기준으로 삼아서, 주거비가 전체의 30% 인데도
     막대가 100% 로 꽉 찼다. 항목끼리 상대 비교는 되지만 '전체에서 얼마인지' 를 알 수 없었다. */

  /* 상환 진행률 — 최초 대출액 대비 얼마나 갚았는지.
     남은 상환액이 대출액보다 크면(데이터가 이상하거나 이자가 붙은 경우) 계산이 성립하지 않아
     아예 표시하지 않는다. 105% 같은 숫자를 보여주느니 안 보여주는 게 낫다. */
  const loanTotal = data ? Number(data.assetLoan ?? 0) : 0
  const repayment =
    loanTotal > 0 && debtTotal <= loanTotal
      ? {
          repaid: loanTotal - debtTotal,
          remaining: debtTotal,
          percent: ((loanTotal - debtTotal) / loanTotal) * 100,
        }
      : null

  /* 서버 응답은 첫 렌더 뒤에 도착한다. useState 초기값은 그때 이미 정해져 있어서
     응답이 와도 화면이 안 바뀐다. 도착하면 한 번 맞춰준다.
     (사용자가 입력 중인 소득은 덮어쓰지 않는다) */
  useEffect(() => {
    if (saved.mydata) {
      setData(saved.mydata)
      /* 시각을 모르면 비워둔다. 전에는 new Date() 로 채워서, 며칠 전에 연동해둔 계정도
         다시 로그인하면 "방금 업데이트" 로 보였다. 이제 서버가 updatedAt 을 준다 */
      setSyncedAt(saved.syncedAt ? new Date(saved.syncedAt) : null)
    }
    if (saved.monthlyIncome && !incomeText) setIncomeText(String(saved.monthlyIncome))
  }, [saved.mydata, saved.monthlyIncome])

  async function runSync() {
    setSyncError('')
    setSyncing(true)
    try {
      const result = await syncMydata()
      setData(result)
      saveMydata(result)
      setSyncedAt(new Date())
    } catch (err) {
      setSyncError(
        err instanceof ApiError ? err.message : '불러오기에 실패했어요. 잠시 후 다시 시도해주세요.',
      )
    } finally {
      setSyncing(false)
    }
  }

  async function saveIncome(ev) {
    ev.preventDefault()
    setIncomeError('')
    setIncomeMsg('')

    if (!incomeText) {
      setIncomeError('월 평균 소득을 입력해주세요.')
      return
    }

    setSavingIncome(true)
    try {
      await updateIncome(income)
      rememberIncome(income)
      setIncomeMsg('저장했어요. 다음 분석부터 반영돼요.')
    } catch (err) {
      setIncomeError(
        err instanceof ApiError ? err.message : '저장에 실패했어요. 다시 시도해주세요.',
      )
    } finally {
      setSavingIncome(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      <Sidebar active="마이데이터 관리" onNavigate={onNavigate} />

      <main className="flex-1 min-w-0 flex flex-col gap-5 px-5 sm:px-8 py-5 pb-14">
        <TopBar
          userName={userName}
          onNavigate={onNavigate}
          onLogout={onLogout}
          title="마이데이터 관리"
          subtitle="연결된 금융기관과 불러온 정보를 확인하고 관리할 수 있어요."
        />

        {/* ① 연결 상태 */}
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          <SectionTitle
            title="연결된 금융기관"
            right={
              <button
                type="button"
                onClick={runSync}
                disabled={syncing}
                className="h-[40px] px-5 rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                  disabled:opacity-60 text-[14px] font-bold text-kb-brownDark transition-colors"
              >
                {syncing ? '불러오는 중…' : connected ? '다시 불러오기' : '지금 불러오기'}
              </button>
            }
          />

          <p className="mt-2 text-[14px] text-ink-500">
            {syncedAt
              ? `마지막 업데이트 ${syncedAt.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}`
              : connected
                ? '마지막으로 불러온 시각을 알 수 없어요. 다시 불러오면 기록돼요.'
                : '아직 불러온 적이 없어요. 버튼을 눌러 최신 정보를 가져오세요.'}
          </p>

          <ul className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            {INSTITUTIONS.map((inst) => (
              <li
                key={inst.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-4 ${
                  !inst.ready
                    ? 'border-line bg-gray-50'
                    : connected
                      ? 'border-kb-yellow bg-kb-yellowBg'
                      : 'border-line bg-white'
                }`}
              >
                {inst.icon ? (
                  <img src={inst.icon} alt="" className="h-[30px] w-auto object-contain shrink-0" />
                ) : (
                  <span
                    className="shrink-0 w-[30px] h-[30px] rounded-lg border border-dashed border-ink-300"
                    aria-hidden
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[15px] font-bold ${
                      inst.ready ? 'text-kb-brownDark' : 'text-ink-300'
                    }`}
                  >
                    {inst.name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-500">{inst.desc}</p>
                </div>

                {!inst.ready ? (
                  <span className="shrink-0 text-[13px] font-semibold text-ink-300">준비중</span>
                ) : connected ? (
                  <span className="shrink-0 flex items-center gap-1 text-[13px] font-bold text-kb-brownDark">
                    <span
                      className="grid place-items-center w-[20px] h-[20px] rounded-full bg-kb-yellow text-[12px]"
                      aria-hidden
                    >
                      ✓
                    </span>
                    연결됨
                  </span>
                ) : (
                  <span className="shrink-0 text-[13px] font-semibold text-ink-500">대기</span>
                )}
              </li>
            ))}
          </ul>

          <Banner>{syncError}</Banner>

          <p className="mt-5 flex items-start gap-2.5 text-[13px] leading-[1.6] text-ink-500">
            {/* ★ 아이콘 : 방패 — public/assets/shield.png */}
            <img src="/assets/shield.png" alt="" className="h-[17px] w-auto object-contain shrink-0 mt-px" />
            불러온 정보는 자취 가능 시점 예측과 정책 추천에만 사용돼요.
          </p>
        </section>

        {/* ② 월 소득 */}
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          <SectionTitle title="월 평균 소득" />
          <p className="mt-2 text-[14px] leading-[1.6] text-ink-500">
            카드 내역만으로는 급여와 일반 입금을 구분하기 어려워 직접 입력받고 있어요.
            세후 실수령액 기준으로 적어주세요.
          </p>

          <form onSubmit={saveIncome} className="mt-5 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0 max-w-[420px]">
              <input
                type="text"
                inputMode="numeric"
                value={withComma(incomeText)}
                onChange={(ev) => {
                  setIncomeText(digitsOnly(ev.target.value))
                  setIncomeMsg('')
                }}
                placeholder="2,000,000"
                className={`w-full h-[50px] pl-4 pr-11 rounded-xl border bg-white text-[16px]
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
              className="shrink-0 h-[50px] px-7 rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                disabled:opacity-60 text-[15px] font-bold text-kb-brownDark transition-colors"
            >
              {savingIncome ? '저장 중…' : '저장하기'}
            </button>
          </form>

          <Banner>{incomeError}</Banner>
          <Banner tone="ok">{incomeMsg}</Banner>

          {/* 서버 조회 API 가 없어서 이번 접속에서 입력한 값만 기억함 */}
          <p className="mt-4 text-[13px] leading-[1.6] text-ink-500">
            이번 접속에서 입력한 금액을 기억하고 있어요. 브라우저를 완전히 닫으면 다시 입력해야 해요.
          </p>
        </section>

        {/* ③ 불러온 정보 */}
        {connected ? (
          <>
            {/* 요약 3장 */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`${CARD} px-6 py-5`}>
                <p className="text-[14px] text-ink-500">월 평균 소비</p>
                <p className="mt-1.5 text-[24px] font-extrabold text-kb-brownDark tabular-nums">
                  {won(spendingTotal)}
                </p>
              </div>

              <div className={`${CARD} px-6 py-5`}>
                <p className="text-[14px] text-ink-500">순자산</p>
                <p
                  className={`mt-1.5 text-[24px] font-extrabold tabular-nums ${
                    netAsset < 0 ? 'text-danger' : 'text-kb-brownDark'
                  }`}
                >
                  {won(netAsset)}
                </p>
                <p className="mt-1 text-[12px] text-ink-500">자산 − 부채</p>
              </div>

              <div className={`${CARD} px-6 py-5`}>
                <p className="text-[14px] text-ink-500">월 저축 여력</p>
                {income > 0 ? (
                  <p
                    className={`mt-1.5 text-[24px] font-extrabold tabular-nums ${
                      monthlySaving < 0 ? 'text-danger' : 'text-kb-brownDark'
                    }`}
                  >
                    {won(monthlySaving)}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[16px] font-semibold text-ink-300">소득 입력 필요</p>
                )}
                <p className="mt-1 text-[12px] text-ink-500">소득 − 소비</p>
              </div>
            </section>

            {/* 소비 */}
            <section className={`${CARD} px-6 sm:px-8 py-6`}>
              <SectionTitle title="소비 정보" />

              {/* 두 묶음의 비중도 같이 보여준다. 변동 45% / 고정 55% 처럼
                  '줄일 수 있는 돈이 얼마나 되는지' 가 한눈에 들어와야 해서 */}
              <p className="mt-2 text-[14px] text-ink-500">
                월 총지출 <span className="tabular-nums font-semibold text-ink-700">{won(spendingTotal)}</span> 기준
                비중이에요.
              </p>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6">
                <div>
                  <p className="flex items-baseline gap-2 text-[14px] font-bold text-ink-700">
                    변동 소비
                    <span className="font-semibold text-kb-brownDark tabular-nums">
                      {won(sumOf(VARIABLE_COST, data))}
                    </span>
                    {spendingTotal > 0 && (
                      <span className="text-[13px] font-semibold text-ink-500 tabular-nums">
                        {percentText((sumOf(VARIABLE_COST, data) / spendingTotal) * 100)}
                      </span>
                    )}
                  </p>
                  <ul className="mt-2">
                    {VARIABLE_COST.map((f) => (
                      <Row key={f.key} label={f.label} amount={data[f.key]} total={spendingTotal} />
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="flex items-baseline gap-2 text-[14px] font-bold text-ink-700">
                    고정 지출
                    <span className="font-semibold text-kb-brownDark tabular-nums">
                      {won(sumOf(FIXED_COST, data))}
                    </span>
                    {spendingTotal > 0 && (
                      <span className="text-[13px] font-semibold text-ink-500 tabular-nums">
                        {percentText((sumOf(FIXED_COST, data) / spendingTotal) * 100)}
                      </span>
                    )}
                  </p>
                  <ul className="mt-2">
                    {FIXED_COST.map((f) => (
                      <Row key={f.key} label={f.label} amount={data[f.key]} total={spendingTotal} />
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* 자산 · 부채 */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={`${CARD} px-6 sm:px-8 py-6`}>
                <SectionTitle
                  title="자산"
                  right={
                    <span className="text-[15px] font-bold text-kb-brownDark tabular-nums">
                      {won(sumOf(ASSETS, data))}
                    </span>
                  }
                />
                {/* 소비와 같은 기준(전체 대비 비중). 어디에 몰려 있는지 보여준다 —
                    투자 자산 비중이 높으면 '당장 쓸 수 있는 돈' 은 그만큼 적다는 뜻이라
                    보증금 마련 계획을 세울 때 의미 있는 정보다 */}
                <ul className="mt-3">
                  {ASSETS.map((f) => (
                    <Row
                      key={f.key}
                      label={f.label}
                      amount={data[f.key]}
                      total={sumOf(ASSETS, data)}
                    />
                  ))}
                </ul>
              </div>

              <div className={`${CARD} px-6 sm:px-8 py-6`}>
                <SectionTitle
                  title="부채"
                  right={
                    <span className="text-[15px] font-bold text-danger tabular-nums">
                      {won(debtTotal)}
                    </span>
                  }
                />
                <ul className="mt-3">
                  {DEBTS.map((f) => (
                    <Row key={f.key} label={f.label} amount={data[f.key]} muted={!f.main} />
                  ))}
                </ul>

                {/* 부채는 '비중' 막대를 그릴 수 없다.
                    항목이 남은 상환액 하나뿐이라 무조건 100% 가 되고,
                    최초 대출액까지 넣으면 합이 100% 를 넘어 숫자가 이상해진다.

                    대신 두 값의 관계로 의미 있는 걸 하나 만들 수 있다 — 얼마나 갚았는지.
                    2,000만원 빌려서 1,500만원 남았으면 500만원(25%)을 갚은 것이다. */}
                {repayment && (
                  <div className="mt-4 pt-4 border-t border-line">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] font-bold text-kb-brownDark">상환 진행률</span>
                      <span className="text-[14px] font-bold text-ok tabular-nums">
                        {percentText(repayment.percent)}
                      </span>
                    </div>
                    <span className="mt-2 block h-[8px] rounded-full bg-line overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-ok"
                        style={{ width: `${Math.min(repayment.percent, 100)}%` }}
                      />
                    </span>
                    <p className="mt-2 text-[13px] text-ink-500 tabular-nums">
                      {won(repayment.repaid)} 갚았고 {won(repayment.remaining)} 남았어요.
                    </p>
                  </div>
                )}

                {/* 왜 두 값을 안 더하는지 화면에도 적어둔다.
                    안 적으면 '2천만 + 1천5백만인데 왜 1천5백만이지?' 하고 또 헷갈림 */}
                <p className="mt-3 pt-3 border-t border-line text-[13px] leading-[1.6] text-ink-500">
                  최초 대출액은 처음 빌린 금액이라 합계에 넣지 않아요.
                  실제 갚아야 할 금액은 <span className="font-bold">남은 상환액</span>이에요.
                </p>
              </div>
            </section>
          </>
        ) : (
          /* 아직 안 불러온 상태 */
          <section className={`${CARD} px-6 py-16 grid place-items-center`}>
            <div className="text-center max-w-[380px]">
              {/* ★ 아이콘 : 마이데이터 — public/assets/mydata.png */}
              <img
                src="/assets/mydata.png"
                alt=""
                className="h-[64px] w-auto object-contain mx-auto opacity-60"
              />
              <p className="mt-5 text-[17px] font-bold text-kb-brownDark">
                아직 불러온 정보가 없어요
              </p>
              <p className="mt-2 text-[14px] leading-[1.7] text-ink-500">
                위의 <span className="font-bold">지금 불러오기</span> 를 누르면
                소비·자산·부채 정보를 가져와요.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
