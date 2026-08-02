/* ============================================================
   KB 청년 자취 도우미 — 로그인 후 공통 껍데기
   독립만세팀 / KB AI Challenge 2026

   왼쪽 사이드바와 상단 헤더는 로그인 이후 화면 7개가 전부 공유한다.
   화면마다 복사해두면 메뉴 하나 고칠 때 7군데를 고쳐야 해서 여기로 뺐음.

   ※ 화면 하나짜리 조각을 잘게 쪼개는 건 계속 피하고 있지만,
     이건 '여러 화면이 같이 쓰는 것' 이라 분리하는 게 맞다.
     Sidebar·Header·IconBox 는 Home.jsx 에 있던 코드를 그대로 옮긴 것이라
     화면 모양은 달라지지 않는다.
   ============================================================ */


import { Component, useEffect, useRef, useState } from 'react'
import { getAppData } from './store.js'


/* ---------- 준비 중 안내 (토스트) ---------- */

/* 아직 기능이 없는 버튼을 눌렀을 때 잠깐 떴다 사라지는 알림.

   [왜 alert 이 아닌가]
   alert 은 화면을 멈추고 확인을 눌러야 사라진다. '준비 중' 이라는 가벼운 정보에
   그만한 방해를 주면 안 된다. 토스트는 읽고 싶으면 읽고, 무시하면 알아서 사라진다.

   [왜 버튼을 그냥 지우지 않는가]
   시나리오에 있는 기능이라 자리를 남겨야 심사위원이 전체 그림을 볼 수 있다.
   다만 눌러도 아무 일이 없으면 고장으로 보이므로, 눌리면 상태를 알려준다. */

function Toast({ text }) {
  return (
    <div
      role="status"
      className="kb-fade-up fixed left-1/2 -translate-x-1/2 bottom-8 z-[100]
        rounded-full bg-kb-brownDark/95 text-white px-5 py-3 text-[14px] font-semibold
        shadow-[0_8px_28px_-8px_rgba(74,68,59,0.6)]"
    >
      {text}
    </div>
  )
}

/* 사용법
     const [toast, showToast] = useComingSoon()
     <button onClick={() => showToast('알림 기능은 준비 중이에요.')}>…</button>
     {toast}                                                                */
export function useComingSoon() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!message) return
    // 2.6초 — 한 문장을 읽기에 충분하고, 다음 동작을 가리지 않는 길이
    const timer = setTimeout(() => setMessage(''), 2600)
    return () => clearTimeout(timer)
  }, [message])

  return [message ? <Toast text={message} /> : null, setMessage]
}


/* ---------- 스크롤 등장 효과 ---------- */

/* 화면에 들어올 때 한 번만 나타나는 래퍼. 홍보 페이지처럼 세로로 긴 화면에 쓴다.

   [왜 IntersectionObserver 인가]
   스크롤 이벤트로 위치를 계산하면 스크롤할 때마다 코드가 돌아 화면이 버벅인다.
   IntersectionObserver 는 브라우저가 알아서 판단해 필요할 때만 알려준다.

   [한 번만 보여주는 이유]
   위아래로 스크롤할 때마다 다시 나타나면 정신없고, 읽던 위치를 잃는다.
   한 번 나타난 요소는 그대로 둔다. */

export function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // 지원하지 않는 브라우저에서는 그냥 바로 보여준다 (안 보이는 것보다 낫다)
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true)
          io.disconnect() // 한 번 나타나면 더 볼 필요가 없다
        }
      },
      // 화면 아래에서 12% 정도 올라왔을 때 시작 — 다 보이고 나서 뜨면 늦다
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`${shown ? 'kb-fade-up' : 'opacity-0'} ${className}`}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}


/* ---------- 에러 경계 ---------- */

/* React 는 렌더 중 예외가 나면 화면 전체를 버린다.
   카드 하나에서 값이 없어 터져도 흰 화면이 되어버려서, 시연 중에는 치명적이다.

   이 경계로 감싸두면 터진 부분만 안내 문구로 바뀌고 나머지는 그대로 보인다.
   클래스 컴포넌트인 이유는 componentDidCatch 가 훅으로는 안 되기 때문. */

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    // 사용자에겐 안 보이지만 개발자 도구에는 남겨서 원인을 찾을 수 있게
    console.error('[화면 오류]', this.props.label ?? '', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="h-full min-h-[120px] grid place-items-center rounded-2xl border border-line bg-gray-50 px-4 py-6 text-center">
        <div>
          <p className="text-[13px] font-bold text-ink-700">
            {this.props.label ?? '이 부분'}을 표시할 수 없어요
          </p>
          <p className="mt-1.5 text-[12px] leading-[1.6] text-ink-500">
            잠시 후 다시 시도해주세요.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="mt-3 h-8 px-4 rounded-lg border border-line bg-white hover:bg-gray-100 text-[12px] font-semibold text-ink-700"
          >
            다시 그리기
          </button>
        </div>
      </div>
    )
  }
}


/* ---------- 메뉴 목록 ---------- */

/* label 이 곧 화면 식별자 역할을 한다.
   App.jsx 의 MENU_TO_PAGE 가 이 값을 페이지 키로 바꿔줌 */

export const MENUS = [
  { label: '홈',              icon: '/assets/home.png' },
  { label: '자취 시뮬레이션',   icon: '/assets/simulator.png' },
  { label: '자금조달 설계',     icon: '/assets/money_plan.png' },
  { label: '저축 플랜 추천',    icon: '/assets/calendar.png' },
  { label: '맞춤 정책·지원금',  icon: '/assets/policy.png' },
  { label: '마이데이터 관리',   icon: '/assets/mydata.png' },
  { label: '마이페이지',        icon: '/assets/mypage.png' },
]


/* ---------- 아이콘 ---------- */

// src 가 없으면 점선 자리표시. filter 로 검정 아이콘을 흰색·회색으로 바꿀 수 있음
export function IconBox({ size = 20, src, round = 'rounded-md', tone = 'light', filter, className = '' }) {
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
  const skin = tone === 'dark' ? 'bg-white/15 border-white/35' : 'bg-gray-100 border-gray-300'
  return (
    <span
      style={{ width: size, height: size }}
      className={`shrink-0 inline-block border border-dashed ${skin} ${round} ${className}`}
    />
  )
}

/* ---------- 사이드바 ---------- */

/* 사이드바 아래쪽 '최근 접속 정보'.
   store 에 남은 실행 시각(syncedAt / analyzedAt)을 그대로 보여준다.
   서버에 조회 API 가 생기면 그 값으로 바꾸면 된다 */
function RecentInfo() {
  const { syncedAt, analyzedAt } = getAppData()

  const dot = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  const rows = [
    { label: '마이데이터 업데이트', value: dot(syncedAt) },
    { label: 'AI 분석 리포트 확인', value: dot(analyzedAt) },
  ]

  return (
    <div className="mx-5 mb-6 shrink-0 rounded-2xl bg-white/10 p-5">
      <p className="text-[12px] font-bold text-white">최근 접속 정보</p>
      <div className="mt-3 space-y-3 text-[11px] leading-[1.6] text-white/70">
        {rows.map((row) => (
          <div key={row.label}>
            <p>{row.label}</p>
            <p className={row.value ? '' : 'text-white/40'}>{row.value ?? '아직 없어요'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}


/* active     : 지금 보고 있는 메뉴 label
   onNavigate : 메뉴를 누르면 label 을 넘겨줌. App.jsx 가 화면을 바꿈 */

export function Sidebar({ active = '홈', onNavigate }) {
  const [toast, showToast] = useComingSoon()

  return (
    // relative z-10 + 오른쪽 그림자 : 흰 로고 띠가 본문 헤더의 흰 배경과
    // 이어져 보이지 않도록, 사이드바 전체를 한 덩어리로 띄워서 경계를 만듦
    <aside
      className="w-[232px] shrink-0 h-screen sticky top-0 z-10 overflow-y-auto bg-kb-brown flex flex-col"
      style={{ boxShadow: '4px 0 20px -4px rgba(74, 68, 59, 0.22)' }}
    >
      {/* 로고 — 흰 띠로 분리해서 브랜드 락업이 또렷하게 보이도록.
          누르면 홈으로. 어느 화면에서든 로고를 누르면 처음으로 돌아가는 건
          웹에서 거의 규칙에 가까워서, 안 되면 오히려 막힌 느낌을 준다 */}
      <button
        type="button"
        onClick={() => onNavigate?.('홈')}
        className="h-[68px] shrink-0 flex items-center gap-2.5 px-5 bg-white border-b border-line
          hover:bg-gray-50 transition-colors"
        aria-label="홈으로"
      >
        {/* ★ 아이콘 : KB 로고 — public/assets/KB_logo.png (투명 배경) */}
        <IconBox size={26} src="/assets/KB_logo.png" />
        <span className="text-[16px] font-bold text-kb-brownDark">KB 청년 자취 도우미</span>
      </button>

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
              onClick={() => onNavigate?.(label)}
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
        {/* ★ 아이콘 : AI 코치 캐릭터 — public/assets/ai_coach.png
            가로가 긴 그림(3:2)이라 높이 기준으로 맞춤. 카드 안쪽 폭(152px)을 넘지 않음 */}
        {/* 'AI 상담하기' 버튼을 뺐다.
            누르면 "준비 중이에요" 토스트만 뜨는 자리였다. AI 조언은 저축 플랜·자금조달·
            정책·지역 추천 네 화면에서 각자의 맥락을 가지고 이미 동작한다.
            맥락 없는 범용 상담 버튼을 남겨두면, 되지도 않으면서 그 네 곳의 성격까지
            '그냥 챗봇' 으로 흐려놓는다. 안 되는 걸 두는 것보다 없는 게 낫다. */}
        <div className="h-[96px] mt-3 flex items-center justify-center">
          <img src="/assets/ai_coach.png" alt="" className="h-[96px] w-auto object-contain" />
        </div>
      </div>

      {/* 남는 세로 공간 — 최근 접속 정보를 아래로 밀어줌 */}
      <div className="flex-1 min-h-[20px]" />

      {/* 최근 접속 정보 — 반투명 흰 면.
          디자인 시안에는 고정 날짜가 박혀 있었지만, 오늘 연동해도 작년 날짜가
          떠서 '멈춘 화면' 처럼 보였다. 실제로 실행한 시각을 보여준다.
          아직 안 했으면 '아직 없어요' — 없는 기록을 지어내지 않는다. */}
      <RecentInfo />
      {toast}
    </aside>
  )
}


/* ---------- 상단 헤더 ---------- */

/* title / subtitle 을 주면 그 문구로, 안 주면 홈화면 인사말로 표시.
   userName 은 로그인 응답의 name (api.js 의 getUser() 로 꺼냄) */

/* 프로필 아바타 — 회원가입에서 고른 성별에 맞춰 그린다.

   성별을 아직 모르면(로그인으로 들어왔거나 입력 안 함) man.png 를 쓴다.
   여기서 성별을 '추측' 하지는 않는다. 이름으로 성별을 짐작하는 건 자주 틀리고,
   틀렸을 때 기분이 상하는 종류의 오류다.

   ★ 회원 정보에 gender 가 저장되고 GET /api/users/me 로 내려오면(BACKEND_REQUEST_2D 12번)
     store 대신 그 값을 쓰면 된다. 판단 기준은 이 함수 한 곳뿐이라 바꾸기 쉽다. */
function profileIcon() {
  const gender = getAppData().profile?.gender
  return gender === '여성' ? '/assets/woman.png' : '/assets/man.png'
}

export function TopBar({ title, subtitle, userName = '고객', onLogout, onNavigate }) {
  const [openMenu, setOpenMenu] = useState(false)
  const [toast, showToast] = useComingSoon()
  const boxRef = useRef(null)

  // 바깥을 누르면 닫힘. 안 하면 메뉴가 계속 떠 있어서 답답함
  useEffect(() => {
    if (!openMenu) return
    const close = (ev) => {
      if (boxRef.current && !boxRef.current.contains(ev.target)) setOpenMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openMenu])

  return (
    <header className="shrink-0 flex items-start justify-between">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight">
          {title ?? `안녕하세요, ${userName}님 👋`}
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-500">
          {subtitle ?? '꿈꾸던 자취 생활, KB가 함께 설계해드릴게요.'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* 알림
            빨간 '3' 뱃지는 디자인 시안의 고정값이었다. 알림 기능이 없어서 눌러도
            아무 일이 없는데 숫자만 계속 3이라, 읽지 않은 알림이 있다고 오해하게 된다.
            알림 API 가 생기면 실제 개수로 다시 붙이면 된다 */}
        <button
          type="button"
          aria-label="알림"
          onClick={() => showToast('알림 기능은 준비 중이에요.')}
          className="w-9 h-9 rounded-full hover:bg-gray-50 flex items-center justify-center"
        >
          {/* ★ 아이콘 : 알림 벨 — public/assets/bell.png */}
          <IconBox size={22} src="/assets/bell.png" />
        </button>

        {/* 문의 */}
        <button
          type="button"
          aria-label="문의"
          onClick={() => showToast('1:1 문의는 준비 중이에요.')}
          className="w-9 h-9 rounded-full hover:bg-gray-50 flex items-center justify-center"
        >
          {/* ★ 아이콘 : 채팅 — public/assets/chat.png */}
          <IconBox size={22} src="/assets/chat.png" />
        </button>

        {/* 프로필 — 누르면 메뉴가 열림 */}
        <div className="relative" ref={boxRef}>
          <button
            type="button"
            onClick={() => setOpenMenu((v) => !v)}
            aria-expanded={openMenu}
            className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-full hover:bg-gray-50"
          >
            {/* ★ 아이콘 : 프로필 사진 — 성별에 따라 man.png / woman.png
                원본이 배경 투명한 인물 그림이라, 회색 원 안에 넣어 아바타 형태로 만듦 */}
            <span className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-end justify-center">
              <img src={profileIcon()} alt="" className="w-[34px] h-[34px] object-contain" />
            </span>
            <span className="text-[13px] font-semibold">{userName}님</span>
            {/* ★ 아이콘 : 드롭다운 화살표 — public/assets/down.png */}
            <IconBox
              size={13}
              src="/assets/down.png"
              className={openMenu ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </button>

          {openMenu && (
            <div
              className="absolute right-0 top-11 z-20 w-[168px] rounded-xl border border-line bg-white py-1.5"
              style={{ boxShadow: '0 8px 28px -8px rgba(74, 68, 59, 0.28)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(false)
                  onNavigate?.('마이페이지')
                }}
                className="w-full text-left px-4 py-2.5 text-[14px] text-ink-700 hover:bg-gray-50"
              >
                마이페이지
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(false)
                  onNavigate?.('마이데이터 관리')
                }}
                className="w-full text-left px-4 py-2.5 text-[14px] text-ink-700 hover:bg-gray-50"
              >
                마이데이터 관리
              </button>

              <div className="my-1.5 h-px bg-line" />

              <button
                type="button"
                onClick={() => {
                  setOpenMenu(false)
                  onLogout?.()
                }}
                className="w-full text-left px-4 py-2.5 text-[14px] font-semibold text-danger hover:bg-danger/5"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 알림·문의 버튼의 '준비 중' 안내 (화면 아래 가운데에 잠깐 뜸) */}
      {toast}
    </header>
  )
}


/* ---------- 아직 안 만든 화면 ---------- */

/* 사이드바 메뉴는 7개인데 화면은 아직 다 없다.
   눌렀을 때 아무 반응이 없으면 고장난 것처럼 보이니 이 화면을 대신 띄운다. */

export function ComingSoon({ title, onGoHome }) {
  return (
    <div className="flex-1 min-w-0 grid place-items-center px-8 py-16">
      <div className="max-w-[420px] text-center">
        {/* ★ 아이콘 : AI 코치 — public/assets/ai_coach.png */}
        <img
          src="/assets/ai_coach.png"
          alt=""
          className="h-[110px] w-auto object-contain mx-auto opacity-70"
        />

        <h1 className="mt-6 text-[24px] font-extrabold tracking-tight text-kb-brownDark">{title}</h1>
        <p className="mt-3 text-[15px] leading-[1.7] text-ink-500">
          이 화면은 준비 중이에요.
          <br />
          곧 만나보실 수 있어요.
        </p>

        <button
          type="button"
          onClick={onGoHome}
          className="mt-7 h-[50px] px-8 rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
            text-[16px] font-bold text-kb-brownDark transition-colors"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  )
}
