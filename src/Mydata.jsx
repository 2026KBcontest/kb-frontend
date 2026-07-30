/* ============================================================
   KB 청년 자취 도우미 — 마이데이터 연결 (시나리오 ②)
   독립만세팀 / KB AI Challenge 2026

   회원가입(Signup.jsx) 다음 화면.
   [연결하기] 를 누르면 로딩을 거쳐 '연결 완료' 로 바뀌고,
   두 곳이 모두 연결되면 아래에 수집된 데이터 요약이 나타남.

   ※ 여기 숫자는 전부 더미 데이터임. 실제로는 백엔드가 마이데이터에서
     받아온 값을 내려줘야 함 (BACKEND_REQUEST.md 5-1 참고).
   ※ 금액은 항상 '원 단위 숫자' 로 다루고, 콤마는 화면에서만 붙임.
   ============================================================ */

import { useState } from 'react'


/* ---------- 진행 단계 (Signup.jsx 와 같은 배열) ---------- */

const STEPS = ['회원가입', '마이데이터 연결', '자취 목표 설정', 'AI 분석']


/* ---------- 더미 데이터 ---------- */

// 연결할 금융기관 목록
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

// 월 평균 소득 · 소비. 저축액은 이 둘의 차이로 계산됨
const MONTHLY_INCOME = 2000000
const SPENDING = [
  { label: '식비', amount: 500000 },
  { label: '교통비', amount: 130000 },
  { label: '쇼핑', amount: 270000 },
  { label: '카페', amount: 95000 },
  { label: '문화·취미', amount: 155000 },
  { label: '기타 소비', amount: 330000 },
]

// 합계는 직접 적지 않고 항목에서 더함. 항목을 고쳐도 총액이 어긋나지 않음
const MONTHLY_SPENDING = SPENDING.reduce((sum, item) => sum + item.amount, 0)
const MONTHLY_SAVING = MONTHLY_INCOME - MONTHLY_SPENDING

// 홈화면 '자금 현황' 의 모은 금액 구성과 같은 값 (합계 12,400,000원)
const ASSETS = [
  { label: '계좌 잔액', amount: 2400000 },
  { label: '예금', amount: 5000000 },
  { label: '적금', amount: 4000000 },
  { label: '투자 자산', amount: 1000000 },
]

const DEBTS = [
  { label: '학자금 대출', amount: 3000000 },
  { label: '신용대출', amount: 0 },
  { label: '카드 할부', amount: 450000 },
]

const won = (n) => `${n.toLocaleString('ko-KR')}원`
const sumOf = (list) => list.reduce((s, i) => s + i.amount, 0)


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

// 데이터 묶음 제목. 왼쪽에 옐로우 세로바를 둬서 아이콘 없이도 구분되게 함
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

// 항목 한 줄. ratio 를 주면 오른쪽에 비중 막대를 함께 그림
function Row({ label, amount, ratio }) {
  return (
    <li className="flex items-center gap-3 py-[7px]">
      <span className="w-[72px] shrink-0 text-[14px] text-ink-700">{label}</span>

      {ratio != null && (
        <span className="flex-1 min-w-0 h-[6px] rounded-full bg-line overflow-hidden">
          <span
            className="block h-full rounded-full bg-kb-yellow"
            style={{ width: `${ratio}%` }}
          />
        </span>
      )}

      <span
        className={`shrink-0 text-[14px] tabular-nums ${
          amount === 0 ? 'text-ink-300' : 'font-semibold text-ink-900'
        } ${ratio == null ? 'ml-auto' : ''}`}
      >
        {won(amount)}
      </span>
    </li>
  )
}


/* ---------- 마이데이터 화면 ---------- */

export default function Mydata({ onNext, onBack }) {
  // 기관별 상태 : idle(연결 전) → loading(불러오는 중) → done(연결 완료)
  const [status, setStatus] = useState({ 'kb-bank': 'idle', 'kb-card': 'idle' })

  const connect = (id) => {
    setStatus((prev) => ({ ...prev, [id]: 'loading' }))
    // 실제로는 마이데이터 인증 창이 뜨는 구간. 더미라 잠깐 기다리는 연출만 함
    setTimeout(() => {
      setStatus((prev) => ({ ...prev, [id]: 'done' }))
    }, 1200)
  }

  // 두 곳이 다 연결돼야 수집 데이터가 나오고 다음으로 넘어갈 수 있음
  const allConnected = status['kb-bank'] === 'done' && status['kb-card'] === 'done'
  const doneCount = Object.values(status).filter((s) => s === 'done').length

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* 상단 로고 — 누르면 이전 화면(회원가입)으로 */}
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

        {/* 연결할 기관 목록 */}
        <section
          className="rounded-2xl border border-line bg-white px-6 sm:px-10 py-9"
          style={{ boxShadow: '0 6px 24px -8px rgba(74, 68, 59, 0.28)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[28px] font-extrabold tracking-tight text-kb-brownDark">
                마이데이터 연결
              </h1>
              <p className="mt-2 text-[15px] leading-[1.6] text-ink-500">
                소득·소비·자산 정보를 불러와 자취 가능 시점을 계산해요.
              </p>
            </div>

            {/* ★ 아이콘 : 마이데이터 — public/assets/mydata.png */}
            <img
              src="/assets/mydata.png"
              alt=""
              className="hidden sm:block h-[56px] w-auto object-contain shrink-0"
            />
          </div>

          {/* 진행 상황 (2곳 중 N곳) */}
          <div className="mt-7 flex items-center gap-3">
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
                  {/* 기관 로고 자리 */}
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

                  {/* 연결 버튼 — 상태에 따라 3가지 모양 */}
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

          {/* 보안 안내 */}
          <p className="mt-6 flex items-start gap-2.5 text-[13px] leading-[1.6] text-ink-500">
            {/* ★ 아이콘 : 방패 — public/assets/shield.png */}
            <img src="/assets/shield.png" alt="" className="h-[18px] w-auto object-contain shrink-0 mt-px" />
            불러온 정보는 자취 가능 시점 예측과 정책 추천에만 사용되고, 언제든 연결을 해제할 수 있어요.
          </p>
        </section>

        {/* 수집된 데이터 — 두 곳 다 연결한 뒤에만 나타남 */}
        {allConnected && (
          <section
            className="mt-5 rounded-2xl border border-line bg-white px-6 sm:px-10 py-9"
            style={{ boxShadow: '0 6px 24px -8px rgba(74, 68, 59, 0.28)' }}
          >
            <h2 className="text-[21px] font-extrabold tracking-tight text-kb-brownDark">
              불러온 정보
            </h2>
            <p className="mt-2 text-[15px] text-ink-500">최근 3개월 평균을 기준으로 정리했어요.</p>

            {/* 소득 / 소비 */}
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-line bg-kb-yellowBg px-5 py-4">
                <p className="text-[14px] text-ink-500">월 평균 소득</p>
                <p className="mt-1.5 text-[24px] font-extrabold text-kb-brownDark tabular-nums">
                  {won(MONTHLY_INCOME)}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-kb-yellowBg px-5 py-4">
                <p className="text-[14px] text-ink-500">월 평균 소비</p>
                <p className="mt-1.5 text-[24px] font-extrabold text-kb-brownDark tabular-nums">
                  {won(MONTHLY_SPENDING)}
                </p>
              </div>
            </div>

            {/* 소비 카테고리 */}
            <div className="mt-8">
              <GroupTitle title="소비 정보" total={MONTHLY_SPENDING} />
              <ul className="mt-3">
                {SPENDING.map((item) => (
                  <Row
                    key={item.label}
                    label={item.label}
                    amount={item.amount}
                    // 가장 큰 항목을 100% 로 잡아 상대 비중을 보여줌
                    ratio={Math.round((item.amount / 500000) * 100)}
                  />
                ))}
              </ul>
            </div>

            {/* 자산 / 부채 */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <GroupTitle title="자산 정보" total={sumOf(ASSETS)} />
                <ul className="mt-3">
                  {ASSETS.map((item) => (
                    <Row key={item.label} label={item.label} amount={item.amount} />
                  ))}
                </ul>
              </div>

              <div>
                <GroupTitle title="부채 정보" total={sumOf(DEBTS)} />
                <ul className="mt-3">
                  {DEBTS.map((item) => (
                    <Row key={item.label} label={item.label} amount={item.amount} />
                  ))}
                </ul>
              </div>
            </div>

            {/* AI 자동 계산 — 시나리오 ② 의 마지막 항목 */}
            <div className="mt-8 rounded-xl border border-kb-yellowSoft bg-kb-yellowBg px-5 py-5">
              <div className="flex items-start gap-3">
                {/* ★ 아이콘 : 전구 — public/assets/light_bulb.png */}
                <img
                  src="/assets/light_bulb.png"
                  alt=""
                  className="h-[30px] w-auto object-contain shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-kb-brownDark">AI 자동 계산</p>

                  <p className="mt-2 text-[14px] text-ink-700">
                    월 평균 저축액 ={' '}
                    <span className="tabular-nums">{won(MONTHLY_INCOME)}</span> −{' '}
                    <span className="tabular-nums">{won(MONTHLY_SPENDING)}</span> ={' '}
                    <span className="font-bold text-kb-brownDark tabular-nums">
                      {won(MONTHLY_SAVING)}
                    </span>
                  </p>

                  <p className="mt-2.5 text-[14px] leading-[1.65] text-ink-700">
                    소비 패턴을 보면 <span className="font-bold">식비</span>가 또래 평균보다 높은 편이에요.
                    월 8만원 정도 절약하면 목표 시점을 <span className="font-bold">2개월</span> 앞당길 수 있어요.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 다음 단계로 */}
        <button
          type="button"
          onClick={onNext}
          disabled={!allConnected}
          className="mt-6 w-full h-[62px] rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
            disabled:bg-line disabled:text-ink-300 disabled:cursor-not-allowed
            text-[18px] font-bold text-kb-brownDark transition-colors"
        >
          {allConnected ? '다음 (자취 목표 설정)' : '두 곳을 모두 연결해주세요'}
        </button>

        {/* 자취 목표 설정(시나리오 ③) 화면이 아직 없어서 지금은 홈으로 바로 보냄.
            해당 화면이 만들어지면 App.jsx 의 이 버튼 목적지만 바꾸면 됨 */}
      </main>
    </div>
  )
}
