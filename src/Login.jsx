/* ============================================================
   KB 청년 자취 도우미 — 로그인
   독립만세팀 / KB AI Challenge 2026

   홍보 페이지(Review.jsx)에서 [로그인하기] 를 누르면 오는 화면.
   로그인 성공 시 홈화면(Home.jsx)으로 바로 넘어감.
   (이미 가입·마이데이터 연동을 끝낸 사용자라고 보기 때문)

   ※ 로그인 식별자는 이메일이 아니라 loginId (백엔드 명세 기준).
   ※ 토큰은 응답 바디가 아니라 Authorization / Refresh-Token '헤더' 로 옴.
     읽는 처리는 api.js 의 login() 에 모아둠.
   ============================================================ */

import { useState } from 'react'
import { login, ApiError } from './api.js'


/* ---------- 입력값 검증 ---------- */

function validate(f) {
  const e = {}

  /* 로그인 화면에서는 형식을 깐깐하게 검사하지 않는다.
     기존 회원의 아이디 규칙이 나중에 바뀌었을 수도 있고,
     '아이디 또는 비밀번호가 틀렸다' 는 판단은 서버가 하는 게 맞음 */
  if (!f.loginId.trim()) e.loginId = '아이디를 입력해주세요.'
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
  const [form, setForm] = useState({ loginId: '', password: '', keepLogin: false })
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)

  // 서버가 내려주는 실패 문구 (AUTH_003 등)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const errors = validate(form)
  const errorOf = (key) => (submitted || touched[key] ? errors[key] : undefined)

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))
  const blur = (key) => () => setTouched((prev) => ({ ...prev, [key]: true }))

  async function handleSubmit(ev) {
    ev.preventDefault()
    setSubmitted(true)
    setServerError('')

    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      /* POST /api/auth/login
         성공하면 api.js 가 토큰을 저장해둠.
         keepLogin 이 켜져 있으면 localStorage(브라우저를 닫아도 유지),
         꺼져 있으면 sessionStorage(탭을 닫으면 사라짐) 에 들어감 */
      await login({
        loginId: form.loginId,
        password: form.password,
        keepLogin: form.keepLogin,
      })
      onSuccess()
    } catch (err) {
      setServerError(
        err instanceof ApiError
          ? err.message
          : '로그인 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.',
      )
    } finally {
      setSubmitting(false)
    }
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

            {/* 아이디 */}
            <label className="block mt-7">
              <span className="block mb-2 text-[14px] font-bold text-kb-brownDark">아이디</span>
              <input
                type="text"
                value={form.loginId}
                onChange={(ev) => set('loginId')(ev.target.value)}
                onBlur={blur('loginId')}
                placeholder="testUser"
                autoComplete="username"
                className={inputClass(Boolean(errorOf('loginId')))}
              />
              {errorOf('loginId') && (
                <span className="block mt-1.5 text-[13px] text-danger">{errorOf('loginId')}</span>
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

              {/* 비밀번호 찾기 화면·API 가 아직 없어서 안내만 띄움.
                  onClick 이 없으면 눌러도 무반응이라 고장난 것처럼 보임 */}
              <button
                type="button"
                onClick={() => setServerError('비밀번호 찾기는 준비 중이에요. 팀에 문의해주세요.')}
                className="text-[14px] text-ink-500 underline underline-offset-4 hover:text-kb-brownDark"
              >
                비밀번호 찾기
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-7 w-full h-[62px] rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                disabled:opacity-60 disabled:cursor-not-allowed
                text-[18px] font-bold text-kb-brownDark transition-colors"
            >
              {submitting ? '로그인 중…' : '로그인하기'}
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
