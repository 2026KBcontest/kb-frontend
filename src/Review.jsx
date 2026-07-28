/* ============================================================
   KB 청년 자취 도우미 — 랜딩(소개) 화면
   독립만세팀 / KB AI Challenge 2026

   사이트에 처음 들어왔을 때 보이는 첫 화면.
   [회원가입하기] / [로그인하기] 를 누르면 홈화면(Home.jsx)으로 넘어감.

   [레이아웃]
   홈화면과 같은 방식 — 넓은 화면(xl, 1280px 이상)에서는 h-screen 으로 한 화면 고정.
   헤더·기능카드·하단띠는 내용 높이만 쓰고(shrink-0),
   남는 세로 공간은 전부 히어로가 가져감(flex-1).
   마스코트와 미리보기는 높이를 % 로 잡아서 화면 크기에 따라 같이 커지고 줄어듦.

   ※ 아이콘은 public/assets/ 에 review_ 접두사로 들어있음.
   ============================================================ */


/* ---------- 공통 조각 ---------- */

// 아이콘 자리. src 를 주면 이미지, 없으면 자리표시 박스
function Icon({ src, alt = '', size = 64, className = '' }) {
  if (!src) {
    return (
      <span
        style={{ width: size, height: size }}
        className={`shrink-0 inline-block rounded-xl border border-dashed border-gray-300 bg-gray-100 ${className}`}
      />
    )
  }
  return (
    <img src={src} alt={alt} style={{ height: size }} className={`w-auto object-contain shrink-0 ${className}`} />
  )
}


/* ---------- 상단 : 로고 ---------- */

function Header() {
  return (
    <header className="shrink-0 w-full max-w-[1720px] mx-auto flex items-center gap-3 px-8 lg:px-10 h-[78px]">
      {/* ★ 아이콘 : KB 로고 — public/assets/review_kblogo.png (투명 배경) */}
      <img src="/assets/review_kblogo.png" alt="" className="h-[34px] w-auto object-contain" />
      <span className="text-[23px] font-bold text-kb-brownDark tracking-tight">KB 청년 자취 도우미</span>
    </header>
  )
}


/* ---------- 히어로 : 헤드라인 + 미리보기 ---------- */

function Hero({ onEnter }) {
  return (
        // 12열 그리드로 나누면 오른쪽이 7/12(약 57%)로 묶여서 미리보기를 크게 못 키움.
    // flex + 왼쪽 38% 고정으로 바꿔서 오른쪽이 60% 이상을 가져가게 함
    <section className="flex-1 min-h-0 w-full max-w-[1720px] mx-auto px-8 lg:px-10 flex flex-col lg:flex-row gap-4 items-center">
      {/* 좌 : 헤드라인 */}
      <div className="w-full lg:w-[32%] shrink-0">
        <h1 className="text-[36px] xl:text-[44px] 2xl:text-[48px] font-extrabold leading-[1.25] tracking-tight text-kb-brownDark whitespace-nowrap">
          청년 자취의 시작,
          <br />
          <span className="text-kb-yellow">AI</span>가 함께 설계해드려요
        </h1>

        <p className="mt-7 text-[17px] xl:text-[18px] leading-[1.75] text-ink-500">
          지출과 저축, 자금 계획을 AI가 분석해
          <br />
          독립 시점과 맞춤 플랜을 알려드려요.
        </p>

        <div className="mt-9 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={onEnter}
            className="h-[62px] px-11 rounded-xl bg-kb-yellow hover:bg-kb-yellowDark text-[18px] font-bold text-kb-brownDark"
          >
            회원가입하기
          </button>
          <button
            type="button"
            onClick={onEnter}
            className="h-[62px] px-11 rounded-xl border border-line bg-white hover:bg-gray-50 text-[18px] font-bold text-kb-brownDark"
          >
            로그인하기
          </button>
        </div>
      </div>

      {/* 우 : 마스코트 + 대시보드 미리보기

          미리보기를 '높이 기준'으로 잡으면 가로가 900px 가까이 나와서
          마스코트와 합친 폭이 이 칸을 넘고, 넘친 만큼 왼쪽 제목을 덮어버림.
          → 미리보기는 flex-1 로 '남는 가로폭에 맞춰' 크기가 정해지게 하고
            (세로는 비율대로 따라옴), 마스코트만 높이 기준으로 둠.
            이러면 어떤 화면에서도 가로가 넘치지 않음. */}
      <div className="w-full lg:flex-1 min-w-0 h-full flex items-center justify-center lg:justify-end">
        {/* ★ 아이콘 : 마스코트 캐릭터 */}
        <img
          src="/assets/review_ai.png"
          alt=""
          className="hidden md:block h-[260px] xl:h-[88%] xl:max-h-[470px] w-auto object-contain shrink-0 relative z-10 -mr-16"
        />

        {/* ★ 이미지 : 홈화면 미리보기 — public/assets/review_testhome.png
            이미지 비율이 1.52(가로:세로)라 가로가 커지면 세로도 그만큼 늘어남.
            히어로에 배정된 높이(약 520px)를 넘지 않도록 max-h 로 한 번 더 막아둠 */}
        <div className="flex-1 min-w-0 max-w-[830px] lg:-mr-4 xl:max-h-[calc(100vh-400px)] rounded-2xl border border-line bg-white overflow-hidden shadow-[0_12px_40px_-12px_rgba(74,68,59,0.28)]">
          <img src="/assets/review_testhome.png" alt="홈화면 미리보기" className="w-full h-auto block" />
        </div>
      </div>
    </section>
  )
}


/* ---------- 기능 카드 3종 ---------- */

const FEATURES = [
  {
    icon: '/assets/review_calendar.png',
    title: '자취 가능 시점 예측',
    desc: '현재 저축·소득의 흐름을 AI로\n분석해 최적의 독립 시점을\n예측해드려요.',
  },
  {
    icon: '/assets/review_calculator.png',
    title: '맞춤 자금조달 설계',
    desc: '보증금, 월세 등 초기 비용, 대출,\n정부 지원금까지 최적의 자금조달\n플랜을 제안해드려요.',
  },
  {
    icon: '/assets/review_robot.png',
    title: 'AI 자취 코치',
    desc: '소비 습관 분석부터 절약 팁, 체크리스트\n까지 AI가 1:1 맞춤 코칭으로\n함께해요.',
  },
]

function Features() {
  return (
    <section className="shrink-0 w-full max-w-[1720px] mx-auto px-8 lg:px-10 pt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
      {FEATURES.map((item) => (
        <div key={item.title} className="rounded-2xl border border-line bg-white px-6 py-5 flex items-center gap-5">
          {/* ★ 아이콘 : 기능 3종 (달력 / 계산기 / 로봇) */}
          <Icon src={item.icon} size={104} />
          <div className="min-w-0">
            <h2 className="text-[21px] font-bold text-kb-brownDark">{item.title}</h2>
            <p className="mt-2 text-[15px] leading-[1.65] text-ink-500 whitespace-pre-line">{item.desc}</p>
          </div>
        </div>
      ))}
    </section>
  )
}


/* ---------- 하단 띠 : 서비스 특징 4종 ---------- */

const POINTS = [
  { icon: '/assets/review_clock.png',  title: '3분 만에 시작',  desc: '간단한 정보 입력으로\n바로 분석을 시작해요.' },
  { icon: '/assets/review_chain.png',  title: '마이데이터 연동', desc: '안전한 마이데이터 연동으로\n정확한 분석을 제공해요.' },
  { icon: '/assets/review_graph.png',  title: '개인 맞춤 분석',  desc: '당신의 상황에 딱 맞는\n맞춤형 인사이트를 드려요.' },
  { icon: '/assets/review_shield.png', title: '안심 보안',      desc: 'KB금융그룹의 강력한 보안으로\n소중한 정보를 보호해요.' },
]

function Points() {
  return (
    <section className="shrink-0 w-full max-w-[1720px] mx-auto px-8 lg:px-10 py-5">
      {/* 배경(#FAF6EF)과 이 띠(#FFFAEF)는 밝기가 거의 같아서 색만으로는 구분이 안 됨.
          → 그림자로 띄워서 경계를 만듦. 색 대비 대신 '높이 차이'로 구분시키는 방식 */}
      <div
        className="rounded-2xl bg-kb-yellowBg border border-kb-yellowSoft px-3 py-5"
        style={{ boxShadow: '0 6px 24px -8px rgba(74, 68, 59, 0.28)' }}
      >
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {POINTS.map((item, i) => (
            <li
              key={item.title}
              // 마지막 칸을 뺀 나머지에만 오른쪽 구분선 (xl 에서만)
              className={`flex items-center gap-5 px-7 ${
                i < POINTS.length - 1 ? 'xl:border-r xl:border-kb-yellowSoft' : ''
              }`}
            >
              {/* ★ 아이콘 : 특징 4종 (시계 / 사슬 / 그래프 / 방패) */}
              <Icon src={item.icon} size={66} />
              <div className="min-w-0">
                <h3 className="text-[17px] font-bold text-kb-brownDark">{item.title}</h3>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-ink-500 whitespace-pre-line">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}


/* ---------- 랜딩 화면 조립 ---------- */

export default function Review({ onEnter }) {
  return (
    // xl 이상에서만 한 화면 고정. 좁은 화면에서는 잘리지 않게 스크롤 허용
    <div className="min-h-screen xl:h-screen xl:overflow-hidden flex flex-col bg-[#FAF6EF]">
      <Header />
      <Hero onEnter={onEnter} />
      <Features />
      <Points />
    </div>
  )
}
