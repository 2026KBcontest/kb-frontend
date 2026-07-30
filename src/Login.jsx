/* ============================================================
   KB 청년 자취 도우미 — 로그인
   독립만세팀 / KB AI Challenge 2026

   홍보 페이지(Review.jsx)에서 [로그인하기] 를 누르면 오는 화면.
   로그인 성공 시 홈화면(Home.jsx)으로 바로 넘어감.
   (이미 가입·마이데이터 연동을 끝낸 사용자라고 보기 때문)

   ※ 백엔드 /api/auth/login 은 현재 목 데이터라 아무 값이나 200 을 반환함.
     실패 응답(401)이 정의되면 아래 handleSubmit 의 주석을 풀어 연결하면 됨.
   ============================================================ */

import { useState } from 'react'


/* ---------- 입력값 검증 ---------- */

function validate(f) {
  const e = {}

  if (!f.email.trim()) e.email = '이메일을 입력해주세요.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = '이메일 형식이 올바르지 않습니다.'

  if (!f.password) e.password = '비밀번호를 입력해주세요.'

  return e
}


/* ---------- 공통 조각 ---------- */

// Signup.jsx 와 같은 스타일. 에러일 때만 테두리를 빨갛게
function inputClass(hasError) {
  return `w-full h-[54px] px-4 rounded-xl border bg-white text-[15px] text-ink-900
    placeholder:text-ink-300 outline-none transition-colors
    focus:border-kb-yellow focus:ring-2 focus:ring-kb-yellow/30
    ${hasError ? 'border-danger' : 'border-line'}`
}


/* ---------- 로그인 화면 ---------- */

export default function Login({ onSuccess, onGoSignup, onBack }) {
  const [form, setForm] = useState({ email: '', password: '', keepLogin: false })
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)

  // 서버가 내려주는 실패 문구를 담을 자리 (예: 비밀번호가 일치하지 않습니다)
  const [serverError, setServerError] = useState('')

  const errors = validate(form)
  const errorOf = (key) => (submitted || touched[key] ? errors[key] : undefined)

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))
  const blur = (key) => () => setTouched((prev) => ({ ...prev, [key]: true }))

  function handleSubmit(ev) {
    ev.preventDefault()
    setSubmitted(true)
    setServerError('')

    if (Object.keys(errors).length > 0) return

    /* ★ API 연동 자리 — POST /api/auth/login
       백엔드 CORS 설정이 추가되면 아래 주석을 풀면 됨.
       실패 응답 형식은 BACKEND_REQUEST.md 3-3 / 3-4 로 요청해둔 상태.

       const res = await fetch('http://localhost:8080/api/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ email: form.email, password: form.password }),
       })

       if (!res.ok) {
         const err = await res.json()
         setServerError(err.message ?? '로그인에 실패했습니다.')
         return
       }

       const data = await res.json()
       // 토큰은 Authorization: Bearer <token> 으로 붙일 예정
       // keepLogin 이 켜져 있으면 브라우저에 저장, 아니면 메모리에만 보관
    */
    onSuccess()
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6EF]">
      {/* 상단 로고 — 누르면 홍보 페이지로 돌아감 */}
      <header className="shrink-0 w-full max-w-[1720px] mx-auto flex items-center gap-3 px-8 lg:px-10 h-[78px]">
        <button type="button" onClick={onBack} className="flex items-center gap-3">
          {/* ★ 아이콘 : KB 로고 — public/assets/review_kblogo.png */}
          <img src="/assets/review_kblogo.png" alt="" className="h-[34px] w-auto object-contain" />
          <span className="text-[23px] font-bold text-kb-brownDark tracking-tight">
            KB 청년 자취 도우미
          </span>
        </button>
      </header>

      {/* 카드를 화면 가운데에 둠. 헤더를 뺀 남은 높이를 다 쓰고 그 안에서 중앙 정렬 */}
      <main className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8">
        {/* 넓은 화면(lg 이상)에서는 마스코트를 카드 '옆'에 둠.
            위에 두면 캐릭터를 키운 만큼 전체 높이가 늘어나 스크롤이 생기는데,
            옆에 두면 행 높이가 '카드 높이'로 정해져서 캐릭터를 크게 키워도 높이가 안 늘어남 */}
        <div className="w-full max-w-[480px] lg:max-w-none lg:w-auto lg:flex lg:items-center lg:gap-12">
          {/* ★ 아이콘 : 마스코트 캐릭터 — public/assets/review_ai.png */}
          <img
            src="/assets/review_ai.png"
            alt=""
            className="hidden sm:block w-auto object-contain shrink-0
              h-[200px] mx-auto mb-6
              lg:h-[320px] xl:h-[380px] 2xl:h-[420px] lg:mx-0 lg:mb-0"
          />

          {/* 폼 너비는 그대로 고정. 캐릭터가 커져도 입력칸이 늘어나지 않게 */}
          <div className="w-full lg:w-[480px] shrink-0">

          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-2xl border border-line bg-white px-7 sm:px-9 py-9"
            style={{ boxShadow: '0 6px 24px -8px rgba(74, 68, 59, 0.28)' }}
          >
            <h1 className="text-[28px] font-extrabold tracking-tight text-kb-brownDark text-center">
              로그인
            </h1>
            <p className="mt-2 text-[15px] text-ink-500 text-center">
              자취 준비 현황을 이어서 확인해보세요.
            </p>

            {/* 서버가 내려준 실패 문구 (예: 401) */}
            {serverError && (
              <p className="mt-6 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-[14px] text-danger">
                {serverError}
              </p>
            )}

            {/* 이메일 */}
            <label className="block mt-7">
              <span className="block mb-2 text-[14px] font-bold text-kb-brownDark">이메일</span>
              <input
                type="email"
                value={form.email}
                onChange={(ev) => set('email')(ev.target.value)}
                onBlur={blur('email')}
                placeholder="example@kb.com"
                autoComplete="email"
                className={inputClass(Boolean(errorOf('email')))}
              />
              {errorOf('email') && (
                <span className="block mt-1.5 text-[13px] text-danger">{errorOf('email')}</span>
              )}
            </label>

            {/* 비밀번호 */}
            <label className="block mt-5">
              <span className="block mb-2 text-[14px] font-bold text-kb-brownDark">비밀번호</span>
              <input
                type="password"
                value={form.password}
                onChange={(ev) => set('password')(ev.target.value)}
                onBlur={blur('password')}
                placeholder="••••••••"
                autoComplete="current-password"
                className={inputClass(Boolean(errorOf('password')))}
              />
              {errorOf('password') && (
                <span className="block mt-1.5 text-[13px] text-danger">{errorOf('password')}</span>
              )}
            </label>

            {/* 로그인 상태 유지 / 비밀번호 찾기 */}
            <div className="mt-5 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.keepLogin}
                  onChange={(ev) => set('keepLogin')(ev.target.checked)}
                  className="sr-only peer"
                />
                <span
                  aria-hidden
                  className={`grid place-items-center w-[20px] h-[20px] rounded-md border text-[12px] font-bold transition-colors ${
                    form.keepLogin
                      ? 'border-kb-yellow bg-kb-yellow text-kb-brownDark'
                      : 'border-ink-300 bg-white text-transparent'
                  } peer-focus-visible:ring-2 peer-focus-visible:ring-kb-yellow/40`}
                >
                  ✓
                </span>
                <span className="text-[14px] text-ink-700">로그인 상태 유지</span>
              </label>

              {/* 비밀번호 찾기는 아직 화면이 없어서 자리만 둠 */}
              <button
                type="button"
                className="text-[14px] text-ink-500 underline underline-offset-4 hover:text-kb-brownDark"
              >
                비밀번호 찾기
              </button>
            </div>

            <button
              type="submit"
              className="mt-7 w-full h-[62px] rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                text-[18px] font-bold text-kb-brownDark transition-colors"
            >
              로그인하기
            </button>

            {/* 구분선 안에 글자를 넣음 */}
            <div className="mt-8 flex items-center gap-3">
              <span className="flex-1 h-px bg-line" />
              <span className="text-[13px] text-ink-500">아직 계정이 없으신가요?</span>
              <span className="flex-1 h-px bg-line" />
            </div>

            <button
              type="button"
              onClick={onGoSignup}
              className="mt-5 w-full h-[58px] rounded-xl border border-line bg-white hover:bg-gray-50
                text-[17px] font-bold text-kb-brownDark transition-colors"
            >
              회원가입하기
            </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
