import { useEffect, useState } from 'react'
import { Sidebar, TopBar, IconBox, ErrorBoundary } from './Shell.jsx'
import { getUser, getRegionOptions } from './api.js'
import { useAppData, saveRegionOptions } from './store.js'
import {
  buildFundStatus, buildInsight, buildChecklist, applyGoalToForecast,
  buildTrend, savingCapacity, totalSpending,
  won, monthsText, yearMonth, dotDate,
} from './analysis.js'

// ============================================================
//  아이콘 자리
//  - 파일은 public/assets/ 에 넣고 src="/assets/파일명" 으로 지정
//    (public 폴더 기준이라 경로 앞에 /assets 부터 쓰면 됨)
//  - src 를 안 주면 회색 점선 박스가 나옴 (= 아직 아이콘 없음)
//  - tone="dark" : 브라운 배경(사이드바) 위에 올릴 때
//  - filter : 아이콘 원본 색을 CSS 로 바꿀 때 (아래 GRAY_ICON 참고)
//
//  예)  <IconBox size={20} src="/assets/bell.png" />
// ============================================================

// 아이콘 원본이 검정(#000000)이라, 색을 바꿔야 할 때 쓰는 필터.
// invert(72%) → 검정이 #B8B8B8 정도의 회색이 됨 (원본 시안의 물음표 색)
const GRAY_ICON = 'invert(72%)'

/* 카드 설명 문구.

   [무엇을 적는가]
   '이 칸이 무엇을 보여주는 곳인지' 를 적는다. 계산 과정이나 결론을 적지 않는다.
   결론은 카드 안에 이미 숫자로 나와 있고, 물음표를 누르는 사람이 궁금한 건
   "여긴 뭘 보는 칸이지?" 이기 때문이다.

   같은 카드가 '값이 있을 때 / 없을 때' 두 번 그려져서 문구가 어긋나지 않게 상수로 뺐다. */

const FUND_HINT =
  '마이데이터로 연동한 자산과 부채를 모아, 자취에 필요한 자금을 지금까지 얼마나 준비했는지 보여주는 칸이에요. 모은 금액이 예금·적금·투자 중 어디에 있는지도 함께 볼 수 있어요.'

const TIMELINE_HINT =
  '설정한 자취 목표(희망 지역·계약 방식)를 기준으로 언제쯤 자취를 시작할 수 있을지 예상 시점을 보여주는 칸이에요. 대출을 함께 쓸 경우와 나란히 비교해볼 수도 있어요.'

const INSIGHT_HINT =
  '연동된 소비 내역을 살펴보고, 조정해볼 만한 항목을 골라 알려주는 칸이에요. 계약이 걸려 있어 당장 바꾸기 어려운 지출은 제외하고 보여줘요.'

const CHECKLIST_HINT =
  '자취를 준비하며 거쳐야 할 단계를 모아둔 칸이에요. 어디까지 했고 무엇이 남았는지 확인할 수 있고, 각 줄을 누르면 해당 화면으로 이동해요.'

/* 카드 제목 옆 물음표 — 마우스를 올리면 설명이 뜬다.

   [왜 페이지가 아니라 말풍선인가]
   "이 숫자 뭐지?" 는 그 카드를 보는 순간 생기는 궁금증이라, 다른 화면으로 보내면
   보던 맥락을 잃는다. 홈 위에 겹쳐 띄우면 카드를 보면서 바로 읽고 닫을 수 있다.

   마우스가 없는 환경(터치·키보드)도 되도록 클릭과 포커스에도 열리게 했다. */

function HelpTip({ text }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="이 카드 설명"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)} // 터치 화면에서는 눌러서 열고 닫음
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-kb-yellow/50"
      >
        {/* ★ 아이콘 : 도움말 물음표 — public/assets/question.png */}
        <IconBox size={15} src="/assets/question.png" filter={GRAY_ICON} />
      </button>

      {open && (
        <span
          role="tooltip"
          /* z-50 : 옆 카드 위로 떠야 함. 카드 안에 갇히면 잘려서 안 보임
             (그래서 Card 의 overflow-hidden 을 본문 쪽으로 옮겼다) */
          className="absolute left-0 top-[22px] z-50 w-[250px] rounded-xl border border-line bg-white
            px-3.5 py-3 text-[12px] font-normal leading-[1.7] text-ink-700 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  )
}

/* 카드 껍데기 (제목 + 도움말 + 우측 더보기). 남는 세로 공간은 본문이 가져감.
   more 는 onMore 가 있을 때만 그린다 — 눌러도 아무 일 없는 링크를 두지 않기 위해 */
function Card({ title, hint, more, onMore, children }) {
  return (
    <section className="h-full min-h-0 flex flex-col bg-white border border-line rounded-2xl">
      <header className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[15px] font-bold">{title}</h2>
          {hint && <HelpTip text={hint} />}
        </div>
        {more && onMore && (
          <button
            type="button"
            onClick={onMore}
            className="text-[12px] text-ink-500 hover:text-ink-700"
          >
            {more} &gt;
          </button>
        )}
      </header>
      {/* 본문만 넘침을 자른다. 위 말풍선은 카드 밖으로 나가야 하므로 여기서만 처리 */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pb-4 overflow-hidden rounded-b-2xl">
        {children}
      </div>
    </section>
  )
}

// 도넛 차트
/* 세 조각을 이어 붙인다 (전부 0~100).
     value        내 돈
     supportValue 지원금
     loanValue    대출

   한 조각으로 합쳐 그리면 100% 가 됐을 때 전부 내 돈으로 모은 것처럼 보여서 색을 나눈다.
   자금조달 설계 화면의 도넛과 같은 색 규칙 (노랑 = 내 돈, 연노랑 = 지원금, 브라운 = 빌린 돈)

   ★ 조각을 하나라도 빠뜨리면 그 몫이 '앞으로 모아야 할 금액' 자리인 회색으로 남는다.
     실제로 지원금 조각이 없던 동안, 다 채운 상태인데도 회색이 남고 가운데 숫자가
     84% 로 보였다. 새 자금원을 추가하면 여기에도 조각을 더해야 한다. */
function Donut({ value, supportValue = 0, loanValue = 0, size = 148, thickness = 20 }) {
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const arc = (percent) => (percent / 100) * circumference

  const filled = arc(value)
  const supportFilled = arc(supportValue)
  const loanFilled = arc(loanValue)

  // 뒤 조각은 앞 조각들이 차지한 만큼 밀어서 시작한다
  const segments = [
    { length: supportFilled, offset: filled, color: '#EDAE00' },
    { length: loanFilled, offset: filled + supportFilled, color: '#60584C' },
  ]
  const hasMore = supportFilled > 0 || loanFilled > 0

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F3F6" strokeWidth={thickness} />
        {segments.map(
          (seg) =>
            seg.length > 0 && (
              <circle
                key={seg.color}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${seg.length} ${circumference - seg.length}`}
                strokeDashoffset={-seg.offset}
              />
            ),
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#FFBC00"
          strokeWidth={thickness}
          strokeDasharray={`${filled} ${circumference - filled}`}
          // 뒤에 이어질 조각이 있으면 끝을 둥글게 하지 않는다 (다음 조각을 덮는다)
          strokeLinecap={hasMore ? 'butt' : 'round'}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[22px] font-extrabold">
        {Math.min(value + supportValue + loanValue, 100)}%
      </span>
    </div>
  )
}

// 우상향 미니 꺾은선. 부모 높이를 그대로 채움
/* ---------- 작은 공통 조각 ----------
   (Shell.jsx 로 뺄 만큼 다른 화면에서 쓰이지 않아 여기 둔다) */

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full shrink-0 ${
        checked ? 'bg-kb-yellow' : 'bg-gray-200'
      }`}
    >
      <span
        className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[21px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

function PrimaryButton({ children, className = '', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg bg-kb-yellow hover:bg-kb-yellowDark text-[13px] font-bold ${className}`}
    >
      {children}
    </button>
  )
}

function GhostButton({ children, className = '', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border border-line bg-white hover:bg-gray-50
        text-[13px] font-semibold text-ink-700 ${className}`}
    >
      {children}
    </button>
  )
}

/* 값이 없을 때 0 이나 '-' 를 그냥 찍으면 '0원' 인지 '모른다' 인지 구분이 안 된다.
   title 에 이유를 담아 마우스를 올리면 알 수 있게 한다 */
function Empty({ reason = '아직 계산할 수 없어요', className = '' }) {
  return (
    <span className={`text-ink-300 ${className}`} title={reason}>
      —
    </span>
  )
}

/* 카드 본문이 통째로 비었을 때. 다음에 뭘 해야 하는지 버튼까지 같이 준다 */
function EmptyBody({ text, actionLabel, onAction }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4 py-6">
      <p className="text-[13px] leading-[1.7] text-ink-500 whitespace-pre-line">{text}</p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 h-9 px-4 rounded-lg bg-kb-yellow hover:bg-kb-yellowDark
            text-[13px] font-bold text-kb-brownDark"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}


/* ---------- 상단 히어로 배너 ---------- */

function HeroBanner({ forecast, analyzedAt, onGoForecast }) {
  const months = forecast?.estimatedMonths
  const canPredict = months != null

  return (
    /* 원본 실측 : 히어로 전체가 하나의 노란 배너이고
                  오른쪽 흰 박스는 그 안에 얹힌 것 */
    <div className="shrink-0 rounded-2xl bg-kb-yellowBg border border-kb-yellowSoft px-6 py-4
      flex flex-col lg:flex-row lg:items-center gap-5">
      <div className="min-w-0">
        {!forecast ? (
          <>
            <p className="text-[14px] font-semibold text-ink-700">아직 분석 결과가 없어요</p>
            <p className="mt-1.5 text-[22px] lg:text-[26px] font-extrabold leading-tight">
              자취 목표를 설정해볼까요?
            </p>
            <p className="mt-2 text-[14px] text-ink-500">
              희망 지역과 계약 방식만 고르면 바로 예측해드려요.
            </p>
          </>
        ) : canPredict ? (
          <>
            <p className="text-[14px] font-semibold text-ink-700">
              {forecast.basis === 'goal' ? '월 저축 목표대로라면' : '저축 여력을 다 모으면'}
            </p>
            <p className="mt-1.5 text-[22px] lg:text-[26px] font-extrabold leading-tight">
              D+{months}개월 후 자취 가능!
            </p>
            <p className="mt-2 text-[14px] text-ink-500">
              {forecast.region} {forecast.housingType === 'JEONSE' ? '전세' : '월세'} 기준 · 월{' '}
              {won(forecast.basisAmount)} · 필요 자금 {won(forecast.requiredAmount)}
            </p>
          </>
        ) : (
          /* 서버가 estimatedMonths: null 을 준 경우 = 저축 여력이 0 */
          <>
            <p className="text-[14px] font-semibold text-ink-700">지금은 예측할 수 없어요</p>
            <p className="mt-1.5 text-[22px] lg:text-[26px] font-extrabold leading-tight">
              저축 여력을 먼저 만들어요
            </p>
            <p className="mt-2 text-[14px] text-ink-500">고정 지출을 점검하면 예측이 가능해져요.</p>
          </>
        )}
      </div>

      <img
        src="/assets/banner_home.png"
        alt=""
        className="hidden xl:block shrink-0 h-[124px] w-auto object-contain -my-4 ml-auto xl:mr-14"
      />

      <div className="w-full lg:w-[380px] xl:w-[34.5%] shrink-0 bg-white rounded-xl px-5 py-4">
        <p className="text-[13px] font-bold">마지막 분석일</p>
        <div className="mt-2.5 flex items-end justify-between gap-3">
          <p className="text-[20px] font-extrabold whitespace-nowrap">
            {dotDate(analyzedAt) ?? <Empty reason="아직 분석한 적이 없어요" />}
          </p>
          <PrimaryButton onClick={onGoForecast} className="shrink-0 h-9 px-4 whitespace-nowrap">
            {forecast ? '다시 분석하기' : '분석하러 가기'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}


/* 저축 누적률이 100% 로 차오르는 모양을 우상향 꺾은선으로 그린다.

   scaleMin/scaleMax 를 받는 이유 — 이걸 안 주고 데이터 자기 min~max 로 늘려 그리면
   [0..100] 이든 [73..100] 이든 똑같이 화면을 꽉 채우는 직선이 돼서 두 칸이 구분되지
   않는다. 양쪽 다 0~100 고정 눈금을 쓰면 대출 쪽 선이 이미 높은 데서 시작한다. */
function Sparkline({ data, color = '#FFBC00', scaleMin, scaleMax }) {
  const W = 150
  const H = 60
  // 점(r=3)이 좌표계 끝에 찍히면 반지름만큼 잘리므로 사방에 여백을 둠
  const PAD = 6
  const max = scaleMax ?? Math.max(...data)
  const min = scaleMin ?? Math.min(...data)
  const span = max - min || 1
  const stepX = (W - PAD * 2) / (data.length - 1)
  const points = data.map((v, i) => [
    PAD + i * stepX,
    H - PAD - ((v - min) / span) * (H - PAD * 2),
  ])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block">
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="3"
          fill="#fff"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

// 현재 저축 속도 vs 대출 활용 시
function PredictionBox({ label, months, date, trend, accent }) {
  return (
    <div
      className={`flex-1 min-w-0 h-full flex flex-col rounded-xl border px-4 py-3 ${
        accent ? 'bg-kb-yellowBg border-kb-yellowSoft' : 'bg-gray-50 border-line'
      }`}
    >
      <p className="text-[12px] text-ink-500 truncate">{label}</p>
      <p className="mt-1.5 text-[18px] font-extrabold leading-none whitespace-nowrap">
        {months === 0 ? '지금 바로' : `D+${months}개월`}
      </p>
      {date && <p className="mt-1 text-[12px] text-ink-500">({date})</p>}
      {/* 남는 높이를 그래프가 채움 */}
      <div className="flex-1 min-h-[52px] mt-2 flex items-center">
        <Sparkline
          data={trend}
          color={accent ? '#EDAE00' : '#FFBC00'}
          scaleMin={0}
          scaleMax={100}
        />
      </div>
    </div>
  )
}

function TimelineCard({ forecast, income, mydata, fundingPlan, onGoForecast, onGoFunding }) {
  const [useLoan, setUseLoan] = useState(true)

  const months = forecast?.estimatedMonths
  const capacity = forecast?.monthlySavingCapacity ?? savingCapacity(mydata, income)

  /* '대출 활용 시' 칸 — 자금조달 설계에서 고른 상품이 있어야 채울 수 있다.

     서버의 estimatedMonths 와 같은 식을 쓴다 (ForecastService).
         남은 금액 = 필요 초기자금 − 지금 모은 돈 − 대출금
         개월 수   = ceil(남은 금액 ÷ 월 저축액)
     대출금만큼 모아야 할 돈이 줄어드니 시점이 앞당겨진다.

     대출을 받으면 매달 갚느라 저축 여력이 줄지만, 여기서는 빼지 않았다.
     남은 금액이 0이 되는 순간 바로 들어가는 계산이라 그 뒤로는 모을 일이 없기 때문.
     상환 부담은 자금조달 화면의 DSR 이 따로 보여준다. */
  const loanAmount = Number(fundingPlan?.amount ?? 0)
  const base = Number(forecast?.basisAmount ?? capacity)
  const required = Number(forecast?.requiredAmount ?? 0)
  const savedAsset = Math.max(Number(forecast?.currentAsset ?? 0), 0)

  let loanMonths = null
  if (loanAmount > 0 && required > 0) {
    const remaining = Math.max(required - savedAsset - loanAmount, 0)
    if (remaining === 0) loanMonths = 0
    else if (base > 0) loanMonths = Math.ceil(remaining / base)
  }
  /* 'YYYY-MM' 만 있으면 되는데 Date 로 돌리면 두 군데서 틀어진다.
       · toISOString() 은 UTC 로 바꿔서 한국 시간 새벽이면 전달로 밀린다
       · setMonth 는 1월 31일 + 1개월을 3월 3일로 넘긴다 (서버 LocalDate 는 말일로 맞춤)
     연·월만 더하면 둘 다 생기지 않는다 */
  // 대출을 끼면 몇 달 빨라지는지 — 이게 이 카드를 보는 이유다
  const saved = months != null && loanMonths != null ? months - loanMonths : null

  /* 'YYYY-MM' 만 있으면 되는데 Date 로 돌리면 두 군데서 틀어진다.
       · toISOString() 은 UTC 로 바꿔서 한국 시간 새벽이면 전달로 밀린다
       · setMonth 는 1월 31일 + 1개월을 3월 3일로 넘긴다 (서버 LocalDate 는 말일로 맞춤)
     연·월만 더하면 둘 다 생기지 않는다 */
  const afterMonths = (n) => {
    const now = new Date()
    const total = now.getFullYear() * 12 + now.getMonth() + n
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
  }
  const loanDate = loanMonths != null ? afterMonths(loanMonths) : null

  /* 꺾은선의 시작 높이 = 지금 이미 채워둔 비율. 저축만 하면 내 돈만큼에서,
     대출을 끼면 대출금까지 더한 높이에서 출발해 둘 다 100% 로 올라간다.
     대출금은 첫날 한꺼번에 들어오니 시작점이 그만큼 높은 게 맞다. */
  const pct = (v) => (required > 0 ? Math.min(Math.round((v / required) * 100), 100) : 0)
  const baseTrend = buildTrend(pct(savedAsset), 100)
  const loanTrend = buildTrend(pct(savedAsset + loanAmount), 100)

  return (
    <Card title="자취 가능 시점 예측" hint={TIMELINE_HINT}>
      {!forecast ? (
        <EmptyBody
          text={'자취 목표를 설정하면\n예상 시점을 계산해드려요.'}
          actionLabel="목표 설정하러 가기"
          onAction={onGoForecast}
        />
      ) : (
        <>
          {/* 필요 자금 — 서버가 주는 requiredAmount 는 보증금+중개보수(+월세 2개월)라
              '목표 보증금' 이 아니라 '필요 초기자금' 이 정확한 이름 */}
          <div className="shrink-0 flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[12px] text-ink-500">필요 초기자금</p>
              <p className="mt-1 text-[22px] font-extrabold leading-none whitespace-nowrap">
                {won(forecast.requiredAmount)}
              </p>
            </div>
            <button
              type="button"
              onClick={onGoForecast}
              className="shrink-0 h-7 px-3 rounded-md border border-line bg-white hover:bg-gray-50 text-[12px] font-semibold text-ink-700"
            >
              목표 변경
            </button>
          </div>

          {/* 이전 분석과 비교하려면 분석 이력이 필요한데 서버가 1건만 저장한다.
              (BACKEND_REQUEST_2D.md 7번 GET /api/forecast 요청에 포함) */}
          <p className="shrink-0 mt-2 text-[12px] text-ink-500">
            {forecast.region} · {forecast.housingType === 'JEONSE' ? '전세' : '월세'} 기준
          </p>

          {/* 현재 vs 대출 활용 — 남는 세로 공간 전부 차지 */}
          <div className="flex-1 min-h-0 mt-3 flex items-stretch gap-2.5">
            {months == null ? (
              <div className="flex-1 min-w-0 h-full flex items-center rounded-xl border border-line bg-gray-50 px-4">
                <p className="text-[12px] text-ink-300">저축 여력이 없어 예측할 수 없어요</p>
              </div>
            ) : (
              <PredictionBox
                label={forecast.basis === 'goal' ? '목표대로 저축' : '현재 저축 속도'}
                months={months}
                date={yearMonth(afterMonths(months))}
                trend={baseTrend}
              />
            )}

            {useLoan &&
              (loanMonths != null ? (
                <PredictionBox
                  label="대출 활용 시"
                  accent
                  months={loanMonths}
                  date={yearMonth(loanDate)}
                  trend={loanTrend}
                />
              ) : (
                /* 서버 simulate 에는 '대출 의향' 파라미터가 없어서, 고른 상품이
                   있을 때만 프론트가 같은 식으로 다시 계산한다. 없으면 지어내지 않는다 */
                <button
                  type="button"
                  onClick={onGoFunding}
                  className="flex-1 min-w-0 h-full flex flex-col justify-center rounded-xl border border-dashed border-line px-4 py-3 text-left hover:bg-gray-50"
                >
                  <p className="text-[12px] text-ink-300">대출 활용 시</p>
                  <p className="mt-1.5 text-[13px] text-ink-300 underline underline-offset-2">
                    대출 상품을 고르면 계산돼요
                  </p>
                </button>
              ))}
          </div>

          {/* 카드의 결론. 선 모양을 눈으로 재지 않아도 되게 숫자로 한 번 더 적는다 */}
          {useLoan && saved != null && saved > 0 && (
            <p className="shrink-0 mt-1 text-[13px] font-bold text-kb-brownDark">
              대출을 활용하면 <span className="text-kb-yellowDark">{saved}개월</span> 빨라져요
            </p>
          )}

          <div className="shrink-0 mt-3 flex items-center justify-between gap-2">
            <p className="text-[12px] text-ink-500 truncate">
              월 저축 {won(forecast.basisAmount ?? capacity)} 기준
              {forecast.basis === 'goal' && ' (내 목표)'}
              {forecast.isFallbackApplied && ' (추정치)'}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-ink-500 whitespace-nowrap">대출 비교</span>
              <Toggle checked={useLoan} onChange={setUseLoan} />
            </div>
          </div>

          <PrimaryButton onClick={onGoForecast} className="shrink-0 w-full h-11 mt-3">
            자세히 보기
          </PrimaryButton>
        </>
      )}
    </Card>
  )
}


/* ---------- 2행 2열 : 자금 현황 (세로 확장) ---------- */

function FundStatusCard({ mydata, forecast, income, savingGoal, fundingPlan, policySupport, onGoMydata, onGoForecast, onGoSavingPlan, onGoFunding }) {
  /* 지원금까지 넘긴다 — 자금조달 설계가 '필요 금액 − 자기자본 − 지원금' 으로 대출을
     잡기 때문에, 여기서 지원금을 빼놓으면 두 화면이 정확히 지원금만큼 어긋난다 */
  const fund = buildFundStatus(mydata, forecast, fundingPlan?.amount, policySupport)
  const capacity = forecast?.monthlySavingCapacity ?? savingCapacity(mydata, income)

  if (!fund) {
    return (
      <Card title="자금 현황">
        <EmptyBody
          text={
            !mydata
              ? '마이데이터를 연결하면\n모은 금액을 보여드려요.'
              : '자취 목표를 설정하면\n목표까지 얼마나 왔는지 보여드려요.'
          }
          actionLabel={!mydata ? '마이데이터 연결하기' : '목표 설정하러 가기'}
          onAction={!mydata ? onGoMydata : onGoForecast}
        />
      </Card>
    )
  }

  /* 범례는 도넛 조각과 1:1 로 맞춘다.

     전에는 '현재 모은 금액' 에 총자산(1,800만원)을 적어놓고 노란 조각은 순자산(300만원)을
     그리고 있었다. 점 색은 같은데 숫자가 6배 차이나서, 어느 쪽이 27% 인지 알 수 없었다.
     '남은 상환액' 과 '앞으로 모아야 할 금액' 도 gray-300 / gray-200 이라 색이 구분되지 않았다.

     그래서 도넛에 실제로 그려지는 세 조각만 남기고, 총자산·기존 대출 잔액은
     아래 '마련한 금액 구성' 으로 내렸다. 옆에 %도 같이 적어 조각 크기와 바로 맞춰본다. */
  const legend = [
    { label: '내가 모은 돈', amount: fund.net, percent: fund.progress, dot: 'bg-kb-yellow' },
    // 받을 수 있는 지원금이 있을 때만 줄이 생긴다
    ...(fund.support > 0
      ? [
          {
            label: '지원금으로 마련',
            amount: fund.support,
            percent: fund.supportShare,
            dot: 'bg-kb-yellowDark',
          },
        ]
      : []),
    // 대출을 골랐을 때만 줄이 생긴다. 늘 0원으로 띄우면 '받으라' 는 권유처럼 읽힌다
    ...(fund.loan > 0
      ? [{ label: '대출로 마련', amount: fund.loan, percent: fund.loanShare, dot: 'bg-kb-brown' }]
      : []),
    {
      /* 지원금을 아직 확인하지 않았으면 그 사실을 이름에 적는다.
         '앞으로 모아야 할 금액' 이라고만 하면 지원금이 없다고 확정한 값처럼 읽힌다 */
      label: fund.supportKnown ? '앞으로 모아야 할 금액' : '지원금 빼기 전 모아야 할 금액',
      amount: fund.remaining,
      percent: Math.max(100 - fund.progressWithLoan, 0),
      // 도넛의 빈 자리와 같은 색(#F1F3F6). 너무 옅어서 테두리를 둘러야 점이 보인다
      dot: 'bg-line border border-ink-300/40',
    },
  ]

  return (
    <Card title="자금 현황" hint={FUND_HINT}>
      {/* 도넛 + 범례

          도넛을 148 → 128 로 줄인 이유 — 지원금이 생기면서 범례가 한 줄,
          아래 '마련한 금액 구성' 이 한 줄 늘었다. 카드 높이는 그대로라
          맨 아래 합계 블록이 통째로 잘려 나갔다(카드가 overflow-hidden 이라 조용히 사라진다).
          범례 4줄은 108px 라 도넛을 줄여도 이 줄이 높이를 정하지 않는다. */}
      <div className="shrink-0 flex items-center gap-4">
        <Donut
          value={fund.progress}
          supportValue={fund.supportShare}
          loanValue={fund.loanShare}
          size={128}
          thickness={18}
        />
        <ul className="flex-1 min-w-0 space-y-3">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[12px] text-ink-500 min-w-0">
                <i className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-right">
                <span className="text-[13px] font-bold">{won(item.amount)}</span>
                <span className="ml-1.5 text-[11px] text-ink-500 tabular-nums">
                  {item.percent}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="shrink-0 mt-3 border-t border-line" />

      {/* 도넛이 '진도' 라면 여기는 '출처'. 예금·적금·투자에 이번에 고른 대출까지 더한다.
          대출을 빼놓으면 도넛의 브라운 조각이 어디서 왔는지 화면에 설명이 없다 */}
      <div className="flex-1 min-h-0 mt-3 flex flex-col justify-start">
        <p className="text-[12px] font-bold text-ink-700">마련한 금액 구성</p>

        {/* 가로 누적 막대 — 비율을 한눈에.
            shrink-0 이 없으면 카드 높이가 모자랄 때 flex 가 이 줄부터 0px 로 눌러버려서
            막대가 통째로 안 보인다 (아래 요약 줄을 추가한 뒤 실제로 그렇게 됐다) */}
        <div className="shrink-0 mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-line">
          {fund.breakdown.map((item) => (
            <span key={item.label} style={{ width: `${item.ratio}%`, backgroundColor: item.color }} />
          ))}
        </div>

        {/* 2열 배치 — 세로로 쌓으면 카드가 길어짐 */}
        <ul className="shrink-0 mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
          {fund.breakdown.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-1.5 min-w-0">
              <span className="flex items-center gap-1.5 text-[11px] text-ink-500 min-w-0">
                <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-[11px] font-bold shrink-0 whitespace-nowrap">
                {won(item.amount)}
              </span>
            </li>
          ))}
        </ul>

        {/* 막대는 음수를 그릴 수 없어서 빼는 줄은 글로 적는다.
            이게 없으면 위 합계(2,427만원)와 도넛 기준 금액(927만원)이 왜 다른지 알 수 없다 */}
        <ul className="shrink-0 mt-2.5 pt-2 border-t border-line space-y-1">
          <li className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-ink-500 truncate">합계</span>
            <span className="font-bold shrink-0 whitespace-nowrap">{won(fund.sourceTotal)}</span>
          </li>
          <li className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-ink-500 truncate">− 기존 대출 남은 상환액</span>
            <span className="font-bold shrink-0 whitespace-nowrap text-danger">
              −{won(fund.debt)}
            </span>
          </li>
          <li className="flex items-center justify-between gap-2 text-[12px]">
            <span className="font-bold text-ink-700 truncate">= 실제로 쓸 수 있는 돈</span>
            <span className="font-extrabold shrink-0 whitespace-nowrap text-kb-brownDark">
              {won(fund.funded)}
            </span>
          </li>
        </ul>
      </div>

      {/* 월 저축 */}
      <div className="shrink-0 mt-2.5 rounded-xl bg-kb-yellowBg border border-kb-yellowSoft p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] text-ink-500">월 저축 목표</p>
            {/* 저축 플랜 추천 화면에서 정한 값. 아직 안 정했으면 그리로 안내 */}
            <p className="mt-1 text-[16px] font-bold whitespace-nowrap">
              {savingGoal > 0 ? (
                won(savingGoal)
              ) : (
                <button
                  type="button"
                  onClick={onGoSavingPlan}
                  className="text-[14px] font-semibold text-ink-300 hover:text-ink-500 underline underline-offset-2"
                >
                  목표 정하기
                </button>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-ink-500">예상 월 저축 가능액</p>
            <p className="mt-1 text-[16px] font-bold whitespace-nowrap">{won(capacity)}</p>
          </div>
        </div>
        {/* 두 화면 모두 아직 준비 중이라 ComingSoon 이 뜬다.
            그래도 눌리게 두는 게 낫다 — 아무 반응이 없으면 고장으로 보인다 */}
        <PrimaryButton onClick={onGoSavingPlan} className="w-full h-11 mt-3">
          저축 플랜 추천 받기
        </PrimaryButton>
      </div>

      <GhostButton onClick={onGoFunding} className="shrink-0 w-full h-11 mt-2.5">
        자금조달 설계 바로가기
      </GhostButton>
    </Card>
  )
}


/* ---------- 2행 3열 위 : 절약 인사이트 ----------

   AI 가 아니라 buildInsight() 가 계산한 결과다.
   줄일 수 있는 항목을 금액순으로 세우고, 각각 20% 줄였을 때 몇 개월이 앞당겨지는지
   나눗셈으로 구한다. 예전 제목이 'AI 추천 인사이트' 였는데, 계산 결과에 AI 를 붙이면
   정작 진짜 AI 를 쓴 곳(정책·상품 추천, 코치 한마디)의 설득력이 같이 떨어진다.  */

/* [계산 근거]  analysis.js 의 buildInsight()
   1) 바로 줄일 수 있는 항목(식비·쇼핑·문화취미·기타·구독료)만 후보로 둠
      주거·교통·통신·보험·대출이자는 계약이 걸려 있어 이번 달에 못 줄임
   2) 각 항목의 20% 를 절감 가능액으로 봄 (배달 5회 → 4회 수준)
   3) 1만원 미만은 버리고 큰 순으로 3개
   4) 절감액을 저축에 더해 몇 개월 빨라지는지 서버와 같은 식(올림)으로 계산 */

function SavingInsightCard({ mydata, income, forecast, onGoMydata }) {
  const insight = buildInsight(mydata, income, forecast)

  if (!insight) {
    return (
      <Card title="절약 인사이트" hint={INSIGHT_HINT}>
        <EmptyBody
          text={'마이데이터를 연결하면\n소비 패턴을 분석해드려요.'}
          actionLabel="마이데이터 연결하기"
          onAction={onGoMydata}
        />
      </Card>
    )
  }

  return (
    <Card title="절약 인사이트" hint={INSIGHT_HINT} more="소비 분석" onMore={onGoMydata}>
      <div className="shrink-0 flex items-start justify-between gap-3">
        {/* 문장이 말하는 금액(1등 항목)과 개월 수의 기준을 맞춘다.
            3개 합계로 계산하면 "식비 7만원 아끼면 7개월 단축" 처럼 과장돼 보임 */}
        <p className="text-[15px] font-bold leading-[1.6]">
          {insight.top.category}를 월 {won(insight.top.amount)} 절약하면
          <br />
          {insight.topShortenMonths > 0
            ? `자취 시점이 ${insight.topShortenMonths}개월 앞당겨져요!`
            : '목표에 더 빨리 다가갈 수 있어요!'}
        </p>
        {/* ★ 아이콘 : 전구 — public/assets/light_bulb.png */}
        <IconBox size={46} src="/assets/light_bulb.png" />
      </div>

      <div className="shrink-0 mt-3 border-t border-line" />

      {/* justify-start 로 제목 바로 아래에 붙임 (center 면 아래로 떠서 제목과 떨어져 보임) */}
      {/* 3개를 다 실천했을 때의 효과는 여기(합계 줄)에 적는다 */}
      <p className="shrink-0 mt-3 text-[12px] font-bold text-ink-700">
        절약 팁 TOP {insight.tips.length}
        <span className="ml-1.5 font-normal text-ink-500">
          합계 {won(insight.totalSave)}
          {insight.shortenMonths > 0 && ` · ${insight.shortenMonths}개월 단축`}
        </span>
      </p>
      {/* shrink-0 : 공간이 모자랄 때 목록이 눌려서 마지막 줄이 잘리면 안 된다.
          남는 공간은 아래 spacer 가 가져가고, 모자라면 카드가 아니라 페이지가 스크롤된다 */}
      <ul className="shrink-0 mt-2.5 flex flex-col justify-start gap-2">
        {insight.tips.map((tip) => (
          <li key={tip.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2.5 text-[13px] text-ink-700 truncate">
              {/* ★ 아이콘 : 카테고리별 아이콘 — analysis.js 의 CATEGORY_ICON 표에서 정해진다.
                  아이콘이 없는 카테고리는 노란 점으로 대신 그린다.
                  아이콘 자리 폭(22px)을 점일 때도 똑같이 잡아서 글자 시작선이 어긋나지 않게 함 */}
              {tip.icon ? (
                <IconBox size={22} src={tip.icon} />
              ) : (
                <span className="w-[22px] shrink-0 grid place-items-center" aria-hidden>
                  <i className="w-2 h-2 rounded-full bg-kb-yellow" />
                </span>
              )}
              {tip.label}
            </span>
            <span className="text-[13px] font-bold text-ok shrink-0 whitespace-nowrap">
              -{won(tip.amount)}
            </span>
          </li>
        ))}
      </ul>

      {/* 남는 세로 공간을 흡수해서 버튼을 카드 아래에 붙인다 */}
      <div className="flex-1 min-h-[10px]" />

      <div className="shrink-0 border-t border-line" />

      <GhostButton onClick={onGoMydata} className="shrink-0 w-full h-10 mt-3">
        소비 분석 자세히 보기
      </GhostButton>
    </Card>
  )
}


/* ---------- 2행 3열 아래 : 오늘의 체크리스트 ---------- */

const STATE_COLOR = {
  완료: 'text-ok',
  진행중: 'text-warn',
  대기: 'text-ink-300',
  '준비 중': 'text-ink-300',
}

/* 각 줄을 눌러 그 일을 하러 갈 수 있게 했다.
   "정책·지원금 확인 · 대기" 를 보고도 어디서 하는지 몰라 사이드바를 뒤지게 되면
   체크리스트가 할 일 목록이 아니라 잔소리 목록이 된다. */

function ChecklistCard({ appData, onNavigate }) {
  // 하드코딩이 아니라 실제 진행 상태에서 만들어냄
  const items = buildChecklist(appData)

  return (
    <Card title="오늘의 체크리스트" hint={CHECKLIST_HINT}>
      <ul className="flex-1 min-h-0 flex flex-col justify-start gap-1">
        {items.map((item) => {
          const done = item.state === '완료'
          return (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => onNavigate?.(item.target)}
                className="w-full flex items-center justify-between gap-3 -mx-2 px-2 py-1 rounded-lg
                  text-left hover:bg-kb-yellowBg transition-colors"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {done ? (
                    <span className="w-[18px] h-[18px] rounded-full bg-ok text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      ✓
                    </span>
                  ) : (
                    <span className="w-[18px] h-[18px] rounded border border-gray-300 shrink-0" />
                  )}
                  <span
                    className={`text-[13px] truncate ${done ? 'text-ink-500 line-through decoration-ink-300' : 'text-ink-700'}`}
                  >
                    {item.label}
                  </span>
                </span>
                <span
                  className={`text-[12px] font-semibold shrink-0 whitespace-nowrap ${STATE_COLOR[item.state]}`}
                >
                  {item.state}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}


/* ---------- 3행 : AI 자취 코치 한 마디 ---------- */

/* 원본 시안의 3개 카드 중 실제로 계산 가능한 건 하나뿐이다.
     저축 목표 달성 확률 87%  → 근거 없음. 확률 모델이 없음
     DSR 21%                → 2026-08-02 마이데이터에 월 상환액(원금+이자)이 생겨서
                              이제 진짜로 계산된다. 다만 여기 값은 '기존 대출만' 이다.
                              새로 받을 대출까지 합친 DSR 은 자금조달 설계 화면에 있다.
     추천 지역 절약액        → 지역 비교 API(GET /api/forecast/region-options)로 채워짐
   못 구하는 값은 지어내지 않고 '준비 중' 으로 둔다. */

function CoachBanner({ mydata, income, forecast, regionOptions }) {
  /* 지역 추천 요약 — 자취 시뮬레이션에서 받아 store 에 담아둔 값.

     금액은 candidates 에서 '추천된 그 지역' 을 찾아 쓴다. 전에는 candidates[0](=최저가)을
     그냥 썼는데, 서버가 최저가가 아닌 곳을 권하면 지역 이름과 금액이 서로 다른 곳의 값이 됐다. */
  const regionPick = regionOptions?.recommendation ?? null
  const regionTop =
    regionOptions?.candidates?.find((c) => c.region === regionPick?.pickRegion) ??
    regionOptions?.candidates?.[0] ??
    null

  const spending = totalSpending(mydata)
  const capacity = forecast?.monthlySavingCapacity ?? savingCapacity(mydata, income)
  const months = forecast?.estimatedMonths

  /* 기존 대출의 상환 부담.
     원금+이자(assetMonthlyRepayment)가 있으면 그걸 쓴다 — 이게 DSR 의 정의다.
     옛 데이터라 없으면 이자만 쓰고, 그때는 카드 제목도 '대출이자' 로 낮춰 적는다.
     여기 숫자는 기존 대출만이라 자금조달 화면의 DSR(새 대출 포함)보다 낮다 */
  const repayment = Number(mydata?.assetMonthlyRepayment ?? 0)
  const interest = Number(mydata?.fixedCostLoanInterest ?? 0)
  const debtPayment = repayment > 0 ? repayment : interest
  const debtIsFull = repayment > 0
  const interestRate = income > 0 ? Math.round((debtPayment / income) * 1000) / 10 : null

  const cards = [
    {
      title: '월 저축 여력',
      body: capacity > 0 ? (
        <>
          매달 {won(capacity)} 을
          <br />
          모을 수 있어요
        </>
      ) : (
        <>
          소득보다 지출이 많아요
          <br />
          고정비를 점검해보세요
        </>
      ),
      icon: '/assets/piggy_bank.png',
    },
    {
      title: debtIsFull ? '기존 대출 상환 부담' : '소득 대비 대출이자',
      body: interestRate != null ? (
        <>
          월 소득의 {interestRate}%를
          <br />
          {debtIsFull ? '대출 갚는 데 써요' : '대출이자로 내고 있어요'}
        </>
      ) : (
        <>
          소득을 입력하면
          <br />
          비중을 알려드려요
        </>
      ),
      icon: '/assets/shield.png',
    },
    {
      /* 자취 시뮬레이션 화면에서 받아둔 지역 추천을 그대로 읽는다.
         여기서 또 부르면 같은 답을 받으려고 AI 호출이 한 번 더 나간다.
         자리가 한 줄뿐이라 1등만 요약하고, 자세한 건 시뮬레이션 화면에 있다. */
      title: regionPick?.source === 'ai' ? 'AI 추천 지역' : '추천 지역',
      /* 숫자만 −105,500원 처럼 던지면 무엇이 줄어드는 건지 읽히지 않는다.
         전세면 초기 자금이, 월세면 매달 월세가 줄어드는 것이라 문장을 나눠 쓴다 */
      body: regionPick ? (
        <>
          <b className="font-bold">{regionPick.pickRegion}</b>는 어떠세요?
          {regionTop?.monthlyRentSaved > 0 ? (
            <>
              <br />
              월세가 매달 {won(regionTop.monthlyRentSaved)} 적어요
            </>
          ) : regionTop?.savedAmount > 0 ? (
            <>
              <br />
              초기 자금이 {won(regionTop.savedAmount)} 적어요
            </>
          ) : (
            <>
              <br />
              지금이 주변에서 가장 저렴해요
            </>
          )}
        </>
      ) : (
        <>
          자취 분석을 하면
          <br />
          더 저렴한 지역을 찾아드려요
        </>
      ),
      icon: '/assets/map.png',
    },
  ]

  return (
    <div className="shrink-0 rounded-2xl bg-kb-yellowBg border border-kb-yellowSoft px-4 py-3.5">
      <div className="grid grid-cols-12 gap-5 items-center">
        <div className="col-span-12 lg:col-span-5">
          <div className="flex items-center gap-1.5">
            <p className="text-[14px] font-bold">AI 자취 코치 한 마디</p>
            {/* ★ 아이콘 : 도움말 물음표 */}
            <IconBox size={15} src="/assets/question.png" filter={GRAY_ICON} />
          </div>

          <p className="mt-2 text-[13px] leading-[1.6] text-ink-700">
            {!mydata ? (
              '마이데이터를 연결하면 소비 패턴에 맞는 조언을 드릴게요.'
            ) : months != null ? (
              <>
                {forecast?.basis === 'goal'
                  ? `월 저축 목표(${won(forecast.basisAmount)})대로 모으면 ${monthsText(months)} 후 자취가 가능해요.`
                  : `현재 소비 패턴을 유지하면 ${monthsText(months)} 후 자취가 가능해요.`}
                <br />
                월 지출 {won(spending)} 중 줄일 수 있는 부분을 찾아봤어요!
              </>
            ) : (
              <>
                월 지출이 {won(spending)} 으로 소득에 가까워요.
                <br />
                고정 지출부터 점검하면 저축 여력이 생겨요.
              </>
            )}
          </p>

          {/* 'AI 코치에게 질문하기' 버튼을 뺐다 — 누르면 "준비 중이에요" 토스트만 떴다.
              이 카드는 계산 결과를 요약해 보여주는 자리고, 실제 AI 조언은
              저축 플랜·자금조달·정책 화면에서 각 맥락에 맞게 받을 수 있다. */}
        </div>

        <div className="col-span-12 lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cards.map((card) => (
            <div key={card.title} className="rounded-xl bg-white border border-line px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold truncate">{card.title}</p>
                  <p className="mt-1.5 text-[11px] leading-[1.6] text-ink-500">{card.body}</p>
                </div>
                {/* ★ 아이콘 : 요약 카드 3종 (돼지저금통 / 방패 / 지도핀) */}
                <IconBox size={48} src={card.icon} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


/* ---------- 홈화면 조립 ---------- */

export default function Home({ onNavigate, onLogout }) {
  /* 서버에서 받아온다 (GET /api/users/me · /api/mydata · /api/forecast).
     처음 한 프레임은 브라우저 사본으로 그려서 흰 화면이 보이지 않게 함 */
  const [appData] = useAppData()

  // 서버 응답(me)이 오면 그 이름, 아직이면 로그인 응답의 이름
  const userName = appData.me?.name ?? getUser()?.name ?? '고객'
  const { mydata, forecast: rawForecast, monthlyIncome, analyzedAt, savingGoal, policySupport } =
    appData

  /* 월 저축 목표를 정했으면 그 금액 기준으로 시점을 다시 계산한다.
     서버 값은 '저축 여력 전부' 기준이라, 목표를 정해도 홈이 안 바뀌면
     목표를 정한 의미가 없다. basis 로 어느 기준인지 구분해 문구를 바꾼다 */
  const forecast = applyGoalToForecast(rawForecast, savingGoal)

  /* 지역 추천은 자취 시뮬레이션 화면에서 받아 store 에 담아둔다. 그런데 그 값은
     브라우저에만 있어서(서버에 저장할 자리가 없다) 다시 로그인하면 사라진다.
     그러면 분석 결과는 멀쩡히 있는데 이 카드만 "자취 분석을 하면…" 으로 되돌아가서,
     같은 화면 안에서 두 카드가 서로 다른 말을 하게 된다.

     그래서 분석 결과는 있는데 추천만 없을 때 여기서 한 번 불러온다.
     백엔드가 AI 응답을 6시간 캐시하므로(AiCache) 대개 크레딧을 쓰지 않는다. */
  const [regionOptions, setRegionOptions] = useState(appData.regionOptions)

  useEffect(() => {
    if (appData.regionOptions) {
      setRegionOptions(appData.regionOptions)
      return
    }
    if (!rawForecast) return

    let alive = true
    getRegionOptions()
      .then((res) => {
        if (!alive) return
        setRegionOptions(res)
        saveRegionOptions(res)
      })
      .catch(() => {
        /* 실패하면 이 카드만 안내 문구로 남는다. 홈 전체를 막을 이유는 없다 */
      })

    return () => {
      alive = false
    }
  }, [appData.regionOptions, rawForecast])

  const goForecast = () => onNavigate?.('자취 시뮬레이션')
  const goMydata = () => onNavigate?.('마이데이터 관리')
  const goSavingPlan = () => onNavigate?.('저축 플랜 추천')
  // 자금조달 설계는 아직 화면이 없어서 App 이 '준비 중' 안내로 받아준다
  const goFunding = () => onNavigate?.('자금조달 설계')

  return (
    // h-screen + overflow-hidden : 한 화면에 고정, 스크롤 없음
    <div className="min-h-screen xl:h-screen xl:overflow-hidden flex bg-white">
      <Sidebar active="홈" onNavigate={onNavigate} />

      <main className="flex-1 min-w-0 xl:h-screen xl:overflow-y-auto flex flex-col gap-3 px-5 sm:px-8 py-5">
        <TopBar userName={userName} onNavigate={onNavigate} onLogout={onLogout} />

        {/* 홈은 로그인 직후 처음 보는 화면이라 위에서부터 차례로 나타나게 했다.
            배너 → 카드 3열 → 코치 띠. 0.4초 안에 다 끝나서 기다린다는 느낌은 없다 */}
        <div className="kb-fade-up shrink-0">
          <HeroBanner forecast={forecast} analyzedAt={analyzedAt} onGoForecast={goForecast} />
        </div>

        {/* 3열 그리드 — 남는 세로 공간 전부 차지 */}
        {/* 카드 3열이 같은 높이를 쓰는데, 오른쪽 열만 위아래 두 장(인사이트 + 체크리스트)이라
            여기가 제일 빡빡하다. 최소 높이가 모자라면 인사이트의 절약 팁 3번째 줄이 잘렸다.
            main 이 xl:overflow-y-auto 라서 넘치면 페이지가 스크롤된다 — 높이를 키워도 안전함

            510 → 600 으로 올림. 자금 현황 카드에 지원금 줄이 생기면서 필요한 높이가
            565~590px 가 됐는데, 510 에서는 안쪽 블록이 눌리면서 '= 실제로 쓸 수 있는 돈'
            줄 위로 월 저축 박스가 겹쳐 보였다. 카드 본문은 overflow-hidden 이라 카드 밖으로는
            안 나가지만, 카드 안에서는 형제 요소를 덮는다. 높이가 근본 원인이다. */}
        <div className="flex-1 xl:min-h-[600px] grid grid-cols-12 gap-4">
          {/* 1열 : 자금 현황 (아래 칸까지 확장) */}
          <div
            className="kb-fade-up col-span-12 md:col-span-6 xl:col-span-4 min-h-0"
            style={{ animationDelay: '150ms' }}
          >
            <ErrorBoundary label="자금 현황">
              <FundStatusCard
                fundingPlan={appData.fundingPlan}
                mydata={mydata}
                forecast={forecast}
                income={monthlyIncome}
                savingGoal={savingGoal}
                policySupport={policySupport}
                onGoMydata={goMydata}
                onGoForecast={goForecast}
                onGoSavingPlan={goSavingPlan}
                onGoFunding={goFunding}
              />
            </ErrorBoundary>
          </div>

          {/* 2열 : 자취 가능 시점 예측 (아래 칸까지 확장) */}
          <div
            className="kb-fade-up col-span-12 md:col-span-6 xl:col-span-4 min-h-0"
            style={{ animationDelay: '300ms' }}
          >
            <ErrorBoundary label="자취 가능 시점 예측">
              <TimelineCard
                forecast={forecast}
                income={monthlyIncome}
                mydata={mydata}
                fundingPlan={appData.fundingPlan}
                onGoForecast={goForecast}
                onGoFunding={goFunding}
              />
            </ErrorBoundary>
          </div>

          {/* 3열 : 절약 인사이트 + 오늘의 체크리스트 */}
          <div
            className="kb-fade-up col-span-12 md:col-span-6 xl:col-span-4 min-h-0 flex flex-col gap-4"
            style={{ animationDelay: '450ms' }}
          >
            {/* 체크리스트는 내용 높이만 쓰고(shrink-0), 인사이트가 남는 공간을 전부 가져감 */}
            <div className="xl:flex-1 xl:min-h-0">
              <ErrorBoundary label="절약 인사이트">
                <SavingInsightCard
                  mydata={mydata}
                  income={monthlyIncome}
                  forecast={forecast}
                  onGoMydata={goMydata}
                />
              </ErrorBoundary>
            </div>
            <div className="xl:shrink-0">
              <ErrorBoundary label="오늘의 체크리스트">
                <ChecklistCard appData={appData} onNavigate={onNavigate} />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        <div className="kb-fade-up shrink-0" style={{ animationDelay: '600ms' }}>
          <CoachBanner mydata={mydata} income={monthlyIncome} forecast={forecast} regionOptions={regionOptions} />
        </div>
      </main>
    </div>
  )
}
