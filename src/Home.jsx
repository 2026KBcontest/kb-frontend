import { useState } from 'react'

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

function IconBox({ size = 20, src, round = 'rounded-md', tone = 'light', filter, className = '' }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{ width: size, height: size, filter }}
        className={`object-contain shrink-0 ${className}`}
      />
    )
  }
  const skin =
    tone === 'dark'
      ? 'bg-white/15 border-white/35'
      : 'bg-gray-100 border-gray-300'
  return (
    <span
      style={{ width: size, height: size }}
      className={`shrink-0 inline-block border border-dashed ${skin} ${round} ${className}`}
    />
  )
}

// 카드 껍데기 (제목 + 우측 더보기). 남는 세로 공간은 본문이 가져감
function Card({ title, more, children }) {
  return (
    <section className="h-full min-h-0 flex flex-col bg-white border border-line rounded-2xl overflow-hidden">
      <header className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[15px] font-bold">{title}</h2>
          {/* ★ 아이콘 : 도움말 물음표 — 모든 카드 제목 옆에 공통 적용
              (자금 현황 / 자취 가능 시점 예측 / AI 추천 인사이트 / 오늘의 체크리스트) */}
          <IconBox size={15} src="/assets/question.png" filter={GRAY_ICON} />
        </div>
        {more && <button type="button" className="text-[12px] text-ink-500 hover:text-ink-700">{more} &gt;</button>}
      </header>
      <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">{children}</div>
    </section>
  )
}

// 도넛 차트
function Donut({ value, size = 148, thickness = 20 }) {
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const filled = (value / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F3F6" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#FFBC00"
          strokeWidth={thickness}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[22px] font-extrabold">{value}%</span>
    </div>
  )
}

// 우상향 미니 꺾은선. 부모 높이를 그대로 채움
function Sparkline({ data, color = '#FFBC00' }) {
  const W = 150
  const H = 60
  // 점(r=3)이 좌표계 끝에 찍히면 반지름만큼 잘리므로 사방에 여백을 둠
  const PAD = 6
  const max = Math.max(...data)
  const min = Math.min(...data)
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
        <circle key={i} cx={x} cy={y} r="3" fill="#fff" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

// on/off 토글
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full shrink-0 ${checked ? 'bg-kb-yellow' : 'bg-gray-200'}`}
    >
      <span
        className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[21px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

// 노란 CTA / 흰색 보조 버튼
function PrimaryButton({ children, className = '' }) {
  return (
    <button type="button" className={`rounded-lg bg-kb-yellow hover:bg-kb-yellowDark text-[13px] font-bold ${className}`}>
      {children}
    </button>
  )
}

function GhostButton({ children, className = '' }) {
  return (
    <button
      type="button"
      className={`rounded-lg border border-line bg-white hover:bg-gray-50 text-[13px] font-semibold text-ink-700 ${className}`}
    >
      {children}
    </button>
  )
}


/* ---------- 사이드바 ---------- */

// 아이콘 파일은 public/assets/ 에 있음
const MENUS = [
  { label: '홈',              icon: '/assets/home.png' },
  { label: '자취 시뮬레이션',   icon: '/assets/simulator.png' },
  { label: '자금조달 설계',     icon: '/assets/money_plan.png' },
  { label: '저축 플랜 추천',    icon: '/assets/calendar.png' },
  { label: '맞춤 정책·지원금',  icon: '/assets/policy.png' },
  { label: '마이데이터 관리',   icon: '/assets/mydata.png' },
  { label: '마이페이지',        icon: '/assets/mypage.png' },
]

function Sidebar() {
  const [active, setActive] = useState('홈')

  return (
    // relative z-10 + 오른쪽 그림자 : 흰 로고 띠가 본문 헤더의 흰 배경과
    // 이어져 보이지 않도록, 사이드바 전체를 한 덩어리로 띄워서 경계를 만듦
    <aside
      className="w-[232px] shrink-0 h-screen sticky top-0 z-10 overflow-y-auto bg-kb-brown flex flex-col"
      style={{ boxShadow: '4px 0 20px -4px rgba(74, 68, 59, 0.22)' }}
    >
      {/* 로고 — 흰 띠로 분리해서 브랜드 락업이 또렷하게 보이도록 */}
      <div className="h-[68px] shrink-0 flex items-center gap-2.5 px-5 bg-white border-b border-line">
        {/* ★ 아이콘 : KB 로고 — public/assets/KB_logo.png (투명 배경) */}
        <IconBox size={26} src="/assets/KB_logo.png" />
        <span className="text-[16px] font-bold text-kb-brownDark">KB 청년 자취 도우미</span>
      </div>

      {/* 메뉴
          가독성 처리 4가지:
          1) 글자를 흰색 100%로 (반투명이면 브라운 위에서 묻힘)
          2) 굵기 medium → semibold, 크기 14 → 15px
          3) hover 시 흰 면(15%)이 깔려서 어느 줄인지 바로 보임
          4) 현재 메뉴는 KB 옐로우 알약 — 브라운 위에서 가장 멀리서도 읽힘 */}
      <nav className="px-4 pt-5 space-y-1.5 shrink-0">
        {MENUS.map(({ label, icon }) => {
          const isActive = label === active
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActive(label)}
              className={`w-full flex items-center gap-3 h-11 px-3 rounded-lg text-[15px] text-left ${
                isActive
                  ? 'bg-kb-yellow font-bold text-kb-brownDark'
                  : 'font-semibold text-white hover:bg-white/15'
              }`}
            >
              {/* ★ 아이콘 : 메뉴 7종 — MENUS 배열의 icon 값 사용
                  원본이 검정이라 브라운 배경에서는 안 보임 → invert 로 흰색 반전.
                  활성 메뉴는 노란 배경이라 검정 그대로 둠 */}
              <IconBox size={20} src={icon} className={isActive ? '' : 'invert'} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* AI 자취 코치 — 브라운 위에 얹는 웜화이트 카드 */}
      <div className="mx-5 mt-6 shrink-0 rounded-2xl bg-kb-brownTint text-ink-900 p-5">
        <p className="text-[13px] font-bold text-kb-brownDark">AI 자취 코치</p>
        <p className="mt-2 text-[11px] leading-[1.75] text-ink-500">
          데이터 기반 AI 분석으로
          <br />
          내게 딱 맞는 자취 계획을
          <br />
          설계해드려요!
        </p>
        {/* 캐릭터 자리 */}
        {/* ★ 아이콘 : AI 코치 캐릭터 — public/assets/ai_coach.png
            가로가 긴 그림(3:2)이라 높이 기준으로 맞춤. 카드 안쪽 폭(152px)을 넘지 않음 */}
        <div className="h-[96px] my-3 flex items-center justify-center">
          <img src="/assets/ai_coach.png" alt="" className="h-[96px] w-auto object-contain" />
        </div>
        {/* 하단 코치 배너의 버튼과 동일한 스타일 (흰 배경 + 테두리) */}
        <GhostButton className="w-full h-9">AI 상담하기</GhostButton>
      </div>

      {/* 남는 세로 공간 — 최근 접속 정보를 아래로 밀어줌 */}
      <div className="flex-1 min-h-[20px]" />

      {/* 최근 접속 정보 — 반투명 흰 면 */}
      <div className="mx-5 mb-6 shrink-0 rounded-2xl bg-white/10 p-5">
        <p className="text-[12px] font-bold text-white">최근 접속 정보</p>
        <div className="mt-3 space-y-3 text-[11px] leading-[1.6] text-white/70">
          <div>
            <p>마이데이터 업데이트</p>
            <p>2025.07.20</p>
          </div>
          <div>
            <p>AI 분석 리포트 확인</p>
            <p>2025.07.23</p>
          </div>
        </div>
      </div>
    </aside>
  )
}


/* ---------- 상단 헤더 ---------- */

function Header() {
  return (
    <header className="shrink-0 flex items-start justify-between">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight">안녕하세요, 도현님 👋</h1>
        <p className="mt-1.5 text-[14px] text-ink-500">꿈꾸던 자취 생활, KB가 함께 설계해드릴게요.</p>
      </div>

      <div className="flex items-center gap-3">
        {/* 알림 */}
        <button type="button" className="relative w-9 h-9 rounded-full hover:bg-gray-50 flex items-center justify-center">
          {/* ★ 아이콘 : 알림 벨 — public/assets/bell.png */}
          <IconBox size={22} src="/assets/bell.png" />
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            3
          </span>
        </button>

        {/* 문의 */}
        <button type="button" className="w-9 h-9 rounded-full hover:bg-gray-50 flex items-center justify-center">
          {/* ★ 아이콘 : 채팅 — public/assets/chat.png */}
          <IconBox size={22} src="/assets/chat.png" />
        </button>

        {/* 프로필 */}
        <button type="button" className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-full hover:bg-gray-50">
          {/* ★ 아이콘 : 프로필 사진 — public/assets/man.png
              원본이 배경 투명한 인물 그림이라, 회색 원 안에 넣어 아바타 형태로 만듦 */}
          <span className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-end justify-center">
            <img src="/assets/man.png" alt="" className="w-[34px] h-[34px] object-contain" />
          </span>
          <span className="text-[13px] font-semibold">도현님</span>
          {/* ★ 아이콘 : 드롭다운 화살표 — public/assets/down.png */}
          <IconBox size={13} src="/assets/down.png" />
        </button>
      </div>
    </header>
  )
}


/* ---------- 1행 : 요약 배너 + 다음 분석 예정일 ---------- */

function HeroBanner() {
  return (
    // 원본 실측 : 히어로 전체가 하나의 노란 배너(x266~1503)이고
    //            '다음 분석 예정일'은 그 안에 얹힌 흰 박스임
    <div className="shrink-0 rounded-2xl bg-kb-yellowBg border border-kb-yellowSoft px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-5">
      {/* 좌 : 요약 문구 */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-ink-700">현재 저축 속도라면</p>
        <p className="mt-1.5 text-[22px] lg:text-[26px] font-extrabold leading-tight">D+14개월 후 자취 가능!</p>
        <p className="mt-2 text-[14px] text-ink-500">목표 보증금 30,000,000원을 달성할 수 있어요.</p>
      </div>

      {/* 집·동전 일러스트 자리 */}
      {/* ★ 아이콘 : 집·동전 일러스트 — public/assets/banner_home.png
          배경이 투명이 아니라 크림색이라 rounded-xl 로 카드처럼 다듬음.
          높이 기준으로 잡아야 배너가 세로로 늘어나지 않음 */}
      <img
        src="/assets/banner_home.png"
        alt=""
        className="hidden xl:block shrink-0 h-[96px] w-auto rounded-xl object-cover"
      />

      {/* 우 : 배너 안에 들어가는 흰 박스 */}
      <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 bg-white rounded-xl px-5 py-4">
        <p className="text-[13px] font-bold">다음 분석 예정일</p>
        <div className="mt-2.5 flex items-end justify-between gap-3">
          <p className="text-[20px] font-extrabold whitespace-nowrap">
            2025.08.24
            <span className="ml-1 text-[12px] font-medium text-ink-500">(30일 후)</span>
          </p>
          <PrimaryButton className="shrink-0 h-9 px-4 whitespace-nowrap">다시 분석하기</PrimaryButton>
        </div>
      </div>
    </div>
  )
}


/* ---------- 2행 1열 : 자취 가능 시점 예측 (세로 확장) ---------- */

// 현재 저축 속도 vs 대출 활용 시
function PredictionBox({ label, months, date, trend, accent }) {
  return (
    <div
      className={`flex-1 min-w-0 h-full flex flex-col rounded-xl border px-4 py-3 ${
        accent ? 'bg-kb-yellowBg border-kb-yellowSoft' : 'bg-gray-50 border-line'
      }`}
    >
      <p className="text-[12px] text-ink-500">{label}</p>
      <p className="mt-1.5 text-[18px] font-extrabold leading-none whitespace-nowrap">D+{months}개월</p>
      <p className="mt-1 text-[12px] text-ink-500">({date})</p>
      {/* 남는 높이를 그래프가 채움 */}
      <div className="flex-1 min-h-[52px] mt-2 flex items-center">
        <Sparkline data={trend} color={accent ? '#EDAE00' : '#FFBC00'} />
      </div>
    </div>
  )
}

function TimelineCard() {
  const [useLoan, setUseLoan] = useState(true)

  return (
    <Card title="자취 가능 시점 예측">
      {/* 목표 보증금 */}
      <div className="shrink-0 flex items-start justify-between">
        <div>
          <p className="text-[12px] text-ink-500">목표 보증금</p>
          <p className="mt-1 text-[22px] font-extrabold leading-none whitespace-nowrap">30,000,000원</p>
        </div>
        <button
          type="button"
          className="h-7 px-3 rounded-md border border-line bg-white hover:bg-gray-50 text-[12px] font-semibold text-ink-700"
        >
          목표 변경
        </button>
      </div>

      {/* 재분석 시 이전 플랜과 비교되는 자리 */}
      <p className="shrink-0 mt-2 text-[12px] text-ink-500">
        이전 분석(2025.06.24) 대비 <span className="font-bold text-ok">2개월 단축</span>
      </p>

      {/* 현재 vs 대출 활용 — 남는 세로 공간 전부 차지 */}
      <div className="flex-1 min-h-0 mt-3 flex items-stretch gap-2.5">
        <PredictionBox label="현재 저축 속도" months={14} date="2026년 09월" trend={[10, 28, 44, 62, 80]} />
        <div className="shrink-0 flex items-center">
          <span className="w-8 h-8 rounded-full bg-ink-900 text-white text-[11px] font-bold flex items-center justify-center">
            VS
          </span>
        </div>
        <PredictionBox label="대출 활용 시" months={8} date="2026년 03월" trend={[14, 34, 52, 70, 92]} accent />
      </div>

      <div className="shrink-0 mt-3 flex items-center justify-between gap-2">
        <p className="text-[12px] text-ink-500 truncate">월 저축액 500,000원 기준</p>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink-500 hidden 2xl:inline">대출 활용 시뮬레이션</span>
          <Toggle checked={useLoan} onChange={setUseLoan} />
        </div>
      </div>

      <PrimaryButton className="shrink-0 w-full h-11 mt-3">자세히 보기</PrimaryButton>
    </Card>
  )
}


/* ---------- 2행 2열 : 자금 현황 (세로 확장) ---------- */

const FUND_LEGEND = [
  { label: '현재 모은 금액', amount: '12,400,000원', dot: 'bg-kb-yellow' },
  { label: '앞으로 모아야 할 금액', amount: '17,600,000원', dot: 'bg-gray-200' },
  { label: '대출 가능 금액', amount: '20,000,000원', dot: 'bg-gray-300' },
]

// '현재 모은 금액 12,400,000원' 이 어느 계좌에 들어있는지 분해한 것.
// 마이데이터 자산정보(계좌잔액/예금/적금/투자자산)에서 그대로 나오는 값이라
// API 붙일 때 계산 없이 매핑만 하면 됨. 합계는 반드시 12,400,000원 과 일치해야 함.
const FUND_BREAKDOWN = [
  { label: '계좌 잔액', amount: '2,400,000원', ratio: 19.4, color: '#FFBC00' },
  { label: '예금',      amount: '5,000,000원', ratio: 40.3, color: '#FFD466' },
  { label: '적금',      amount: '4,000,000원', ratio: 32.3, color: '#FFE9AD' },
  { label: '투자 자산', amount: '1,000,000원', ratio: 8.0,  color: '#E9E2D7' },
]

function FundStatusCard() {
  return (
    <Card title="자금 현황">
      {/* 도넛 + 범례 */}
      <div className="shrink-0 flex items-center gap-4">
        <Donut value={42} />
        <ul className="flex-1 min-w-0 space-y-4">
          {FUND_LEGEND.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[12px] text-ink-500 min-w-0">
                <i className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-[13px] font-bold shrink-0 whitespace-nowrap">{item.amount}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="shrink-0 mt-3 border-t border-line" />

      {/* 모은 돈이 어디에 있는지 — 도넛이 '진도'라면 여기는 '출처' */}
      <div className="flex-1 min-h-0 mt-3 flex flex-col justify-start">
        <p className="text-[12px] font-bold text-ink-700">모은 금액 구성</p>

        {/* 가로 누적 막대 — 비율을 한눈에 */}
        <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full">
          {FUND_BREAKDOWN.map((item) => (
            <span key={item.label} style={{ width: `${item.ratio}%`, backgroundColor: item.color }} />
          ))}
        </div>

        {/* 2열 배치 — 세로로 4줄 쌓으면 카드가 길어짐 */}
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {FUND_BREAKDOWN.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-1.5 min-w-0">
              <span className="flex items-center gap-1.5 text-[11px] text-ink-500 min-w-0">
                <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-[11px] font-bold shrink-0 whitespace-nowrap">{item.amount}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 월 저축 목표 */}
      <div className="shrink-0 mt-3 rounded-xl bg-kb-yellowBg border border-kb-yellowSoft p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] text-ink-500">월 저축 목표</p>
            <p className="mt-1 text-[16px] font-bold whitespace-nowrap">500,000원</p>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-ink-500">예상 월 저축 가능액</p>
            <p className="mt-1 text-[16px] font-bold whitespace-nowrap">520,000원</p>
          </div>
        </div>
        <PrimaryButton className="w-full h-11 mt-3">저축 플랜 추천 받기</PrimaryButton>
      </div>

      <GhostButton className="shrink-0 w-full h-11 mt-2.5">자금조달 설계 바로가기</GhostButton>
    </Card>
  )
}


/* ---------- 2행 3열 위 : AI 추천 인사이트 ---------- */

const SAVING_TIPS = [
  { label: '배달/외식 줄이기', amount: '-40,000원' },
  { label: '카페 지출 줄이기', amount: '-25,000원' },
  { label: '구독 서비스 점검', amount: '-15,000원' },
]

function AiInsightCard() {
  return (
    <Card title="AI 추천 인사이트" more="더보기">
      <div className="shrink-0 flex items-start justify-between gap-3">
        <p className="text-[15px] font-bold leading-[1.6]">
          식비를 월 80,000원 절약하면
          <br />
          자취 가능 시점이 2개월 앞당겨져요!
        </p>
        {/* ★ 아이콘 : 전구 — public/assets/light_bulb.png */}
        <IconBox size={46} src="/assets/light_bulb.png" />
      </div>

      {/* 구분선 — 헤드라인과 절약 팁 영역을 나눔 */}
      <div className="shrink-0 mt-3 border-t border-line" />

      {/* justify-center 였을 때는 팁 3줄이 남는 공간 한가운데로 떠서
          제목과 뚝 떨어져 보였음 → justify-start 로 제목 바로 아래에 붙임 */}
      <p className="shrink-0 mt-3 text-[12px] font-bold text-ink-700">절약 팁 TOP 3</p>
      <ul className="flex-1 min-h-0 mt-2.5 flex flex-col justify-start gap-2.5">
        {SAVING_TIPS.map((tip) => (
          <li key={tip.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2.5 text-[13px] text-ink-700 truncate">
              <IconBox size={20} />
              {tip.label}
            </span>
            <span className="text-[13px] font-bold text-ok shrink-0 whitespace-nowrap">{tip.amount}</span>
          </li>
        ))}
      </ul>

      {/* 구분선 — 목록과 버튼을 나눔 */}
      <div className="shrink-0 mt-3 border-t border-line" />

      <GhostButton className="shrink-0 w-full h-10 mt-3">소비 분석 자세히 보기</GhostButton>
    </Card>
  )
}


/* ---------- 2행 3열 아래 : 오늘의 체크리스트 ---------- */

const CHECKLIST = [
  { label: '마이데이터 연결 확인', state: '완료' },
  { label: '자취 시뮬레이션 실행', state: '완료' },
  { label: '자금조달 설계 확인', state: '진행중' },
  { label: '추천 금융상품 비교', state: '대기' },
  { label: '정책·지원금 신청 확인', state: '대기' },
]

const STATE_COLOR = { 완료: 'text-ok', 진행중: 'text-warn', 대기: 'text-ink-300' }

function ChecklistCard() {
  return (
    <Card title="오늘의 체크리스트" more="전체 보기">
      <ul className="flex-1 min-h-0 flex flex-col justify-start gap-3">
        {CHECKLIST.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5 min-w-0">
              {item.state === '완료' ? (
                <span className="w-[18px] h-[18px] rounded-full bg-ok text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  ✓
                </span>
              ) : (
                <span className="w-[18px] h-[18px] rounded border border-gray-300 shrink-0" />
              )}
              <span className="text-[13px] text-ink-700 truncate">{item.label}</span>
            </span>
            <span className={`text-[12px] font-semibold shrink-0 whitespace-nowrap ${STATE_COLOR[item.state]}`}>{item.state}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}


/* ---------- 3행 : AI 자취 코치 한 마디 ---------- */

// 아이콘 파일은 public/assets/ 에 있음
const COACH_CARDS = [
  { title: '저축 목표 달성 팁', line1: '월 50만원 저축 유지 시',   line2: '목표 달성 확률 87%!',   icon: '/assets/piggy_bank.png' },
  { title: 'DSR 안전 범위',    line1: '현재 DSR 21%로',          line2: '대출 여력 충분해요!',   icon: '/assets/shield.png' },
  { title: '추천 지역',        line1: '성북구 인근 저역 비교 시', line2: '월 8~15만원 절약 가능!', icon: '/assets/map.png' },
]

function CoachBanner() {
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
            현재 소비 패턴을 유지하면 14개월 후 자취가 가능해요.
            <br />
            식비 지출을 조금만 줄이면 12개월로 단축할 수 있어요!
          </p>
          {/* 원본 시안 기준 : 흰 버튼 + 우측 정렬.
              paddingRight 숫자를 키우면 버튼이 왼쪽으로 이동 (단위 px) */}
          <div className="mt-2 flex justify-end" style={{ paddingRight: 92 }}>
            <GhostButton className="h-9 px-4 whitespace-nowrap">AI 코치에게 질문하기</GhostButton>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {COACH_CARDS.map((card) => (
            <div key={card.title} className="rounded-xl bg-white border border-line px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold truncate">{card.title}</p>
                  <p className="mt-1.5 text-[11px] leading-[1.6] text-ink-500">
                    {card.line1}
                    <br />
                    {card.line2}
                  </p>
                </div>
                {/* ★ 아이콘 : 요약 카드 3종 — COACH_CARDS 배열의 icon 값 사용
                    (돼지저금통 / 방패 / 지도핀) */}
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

export default function Home() {
  return (
    // h-screen + overflow-hidden : 한 화면에 고정, 스크롤 없음
    <div className="min-h-screen xl:h-screen xl:overflow-hidden flex bg-white">
      <Sidebar />

      <main className="flex-1 min-w-0 xl:h-screen xl:overflow-y-auto flex flex-col gap-3 px-5 sm:px-8 py-5">
        <Header />

        <HeroBanner />

        {/* 3열 그리드 — 남는 세로 공간 전부 차지 */}
        <div className="flex-1 xl:min-h-[430px] grid grid-cols-12 gap-4">
          {/* 1열 : 자금 현황 (아래 칸까지 확장) */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4 min-h-0">
            <FundStatusCard />
          </div>

          {/* 2열 : 자취 가능 시점 예측 (아래 칸까지 확장) */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4 min-h-0">
            <TimelineCard />
          </div>

          {/* 3열 : AI 추천 인사이트 + 오늘의 체크리스트 */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4 min-h-0 flex flex-col gap-4">
            {/* 예전엔 3:2 로 높이를 나눴는데 인사이트 내용이 그 3할을 넘어서면 아래가 잘렸음.
                → 체크리스트는 내용 높이만 쓰고(shrink-0), 인사이트가 남는 공간을 전부 가져감 */}
            <div className="xl:flex-1 xl:min-h-0">
              <AiInsightCard />
            </div>
            <div className="xl:shrink-0">
              <ChecklistCard />
            </div>
          </div>
        </div>

        <CoachBanner />
      </main>
    </div>
  )
}
