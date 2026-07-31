/* ============================================================
   KB 청년 자취 도우미 — 회원가입 (시나리오 ①)
   독립만세팀 / KB AI Challenge 2026

   홍보 페이지(Review.jsx)에서 [회원가입하기] 를 누르면 오는 화면.
   [다음(마이데이터 연결)] 을 누르면 마이데이터 화면(Mydata.jsx)으로 넘어감.

   [입력 항목] 시나리오 ① 기준 10개
   이름 / 이메일 / 비밀번호 / 비밀번호 확인 / 생년월일 /
   성별 / 직업 / 현재 거주지역 / 휴대폰 번호 / 동의 체크박스

   ※ 백엔드 POST /api/auth/signup 은 loginId·password·email·name 4개만 받음.
     생년월일·성별·직업·거주지역·휴대폰 5개는 화면에서 받아두지만 아직 전송하지 않음.
     (시나리오 ① 요구 항목이라 화면은 유지. 백엔드에 필드 추가 요청 후 연결 예정)
   ============================================================ */

import { useState } from 'react'
import { signup, ApiError } from './api.js'


/* ---------- 선택 항목 값 ---------- */

// 진행 단계 — 마이데이터 화면과 같은 배열을 씀 (수정 시 양쪽 같이)
const STEPS = ['회원가입', '마이데이터 연결', '자취 목표 설정', 'AI 분석']

const GENDERS = ['남성', '여성']
const JOBS = ['학생', '취업준비생', '직장인']

// 백엔드 정책 추천 API 의 region 파라미터로 그대로 넘어갈 값
const REGIONS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
  '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도',
  '제주특별자치도',
]


/* ---------- 입력값 검증 ---------- */

// 만 나이 계산. 생일이 아직 안 지났으면 한 살 빼줌
function calcAge(iso) {
  const birth = new Date(iso)
  if (Number.isNaN(birth.getTime())) return -1

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

// 숫자만 남기고 010-1234-5678 모양으로 하이픈을 끼워넣음
function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length < 4) return digits
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

// 필드명 → 에러 문구. 통과한 필드는 키가 아예 없음
function validate(f) {
  const e = {}

  /* 백엔드 규칙 : 영문 대소문자 4~20자 (숫자·기호 불가)

     ★ 숫자 허용을 백엔드에 요청해둔 상태 (BACKEND_REQUEST_2D.md 2번).
       서버가 바뀌면 아래 두 줄을 이렇게 교체하면 됨.

       else if (!/^[A-Za-z][A-Za-z0-9]{3,19}$/.test(f.loginId))
         e.loginId = '영문으로 시작하는 영문·숫자 4~20자로 입력해주세요.'

     지금 프론트만 먼저 풀면 사용자는 숫자를 입력할 수 있는데
     서버가 COMMON_001 로 거부해서 '왜 안 되는지 모르겠는' 상태가 된다.
     그래서 서버 규칙과 똑같이 맞춰둠 */
  if (!f.loginId.trim()) e.loginId = '아이디를 입력해주세요.'
  else if (!/^[A-Za-z]{4,20}$/.test(f.loginId)) e.loginId = '영문 4~20자로 입력해주세요.'

  if (!f.name.trim()) e.name = '이름을 입력해주세요.'
  else if (f.name.trim().length < 2) e.name = '이름은 2자 이상 입력해주세요.'

  if (!f.email.trim()) e.email = '이메일을 입력해주세요.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = '이메일 형식이 올바르지 않습니다.'

  /* 백엔드 규칙 : 10~22자 + 특수문자 1개 이상.
     서버보다 엄격하게 잡으면 서버는 통과하는 값을 프론트가 막아버리니 규칙을 그대로 맞춤 */
  if (!f.password) e.password = '비밀번호를 입력해주세요.'
  else if (f.password.length < 10 || f.password.length > 22) {
    e.password = '10~22자로 입력해주세요.'
  } else if (!/[^A-Za-z0-9]/.test(f.password)) {
    e.password = '특수문자를 1개 이상 포함해주세요.'
  }

  if (!f.passwordConfirm) e.passwordConfirm = '비밀번호를 한 번 더 입력해주세요.'
  else if (f.password !== f.passwordConfirm) e.passwordConfirm = '비밀번호가 일치하지 않습니다.'

  if (!f.birthDate) {
    e.birthDate = '생년월일을 선택해주세요.'
  } else {
    // 청년 대상 서비스라 만 19~39세로 제한 (정책 지원 대상 연령 기준)
    const age = calcAge(f.birthDate)
    if (age < 0) e.birthDate = '생년월일을 다시 확인해주세요.'
    else if (age < 19) e.birthDate = '만 19세 이상부터 가입할 수 있어요.'
    else if (age > 39) e.birthDate = '청년 대상 서비스로 만 19~39세까지 이용할 수 있어요.'
  }

  if (!f.gender) e.gender = '성별을 선택해주세요.'
  if (!f.job) e.job = '직업을 선택해주세요.'
  if (!f.region) e.region = '거주지역을 선택해주세요.'

  if (!f.phone) e.phone = '휴대폰 번호를 입력해주세요.'
  else if (!/^01[016789]-\d{3,4}-\d{4}$/.test(f.phone)) {
    e.phone = '010-1234-5678 형식으로 입력해주세요.'
  }

  if (!f.agreePrivacy) e.agreePrivacy = '개인정보 수집·이용 동의가 필요합니다.'
  if (!f.agreeMydata) e.agreeMydata = '마이데이터 수집·이용 동의가 필요합니다.'

  return e
}


/* ---------- 공통 조각 ---------- */

// 상단 진행 표시. 지난 단계는 옐로우, 현재 단계는 브라운, 이후는 회색
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

            {/* 마지막 단계 뒤에는 연결선을 그리지 않음 */}
            {i < STEPS.length - 1 && (
              <span className="hidden sm:block w-6 h-px bg-line shrink-0" aria-hidden />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// 라벨 + 입력칸 + 에러문구를 한 덩어리로 묶음
function Field({ label, required, error, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="block mb-2 text-[14px] font-bold text-kb-brownDark">
        {label}
        {required && <span className="ml-1 text-kb-yellowDark">*</span>}
      </span>

      {children}

      {/* 에러가 있으면 에러를, 없으면 안내문구를 같은 자리에 보여줌 */}
      {error ? (
        <span className="block mt-1.5 text-[13px] text-danger">{error}</span>
      ) : hint ? (
        <span className="block mt-1.5 text-[13px] text-ink-500">{hint}</span>
      ) : null}
    </label>
  )
}

// 입력칸 공통 스타일. 에러일 때만 테두리를 빨갛게
function inputClass(hasError) {
  return `w-full h-[52px] px-4 rounded-xl border bg-white text-[15px] text-ink-900
    placeholder:text-ink-300 outline-none transition-colors
    focus:border-kb-yellow focus:ring-2 focus:ring-kb-yellow/30
    ${hasError ? 'border-danger' : 'border-line'}`
}

// 성별·직업처럼 선택지가 2~3개일 때. 드롭다운보다 한눈에 보임
function Segmented({ options, value, onChange, hasError }) {
  return (
    <div
      className={`grid gap-2 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
      role="radiogroup"
    >
      {options.map((opt) => {
        const isOn = value === opt
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={isOn}
            onClick={() => onChange(opt)}
            className={`h-[52px] rounded-xl border text-[15px] font-semibold transition-colors ${
              isOn
                ? 'border-kb-yellow bg-kb-yellowBg text-kb-brownDark'
                : hasError
                  ? 'border-danger bg-white text-ink-500 hover:bg-gray-50'
                  : 'border-line bg-white text-ink-500 hover:bg-gray-50'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// 체크박스. input 은 숨기고 span 을 직접 그림 (브라우저마다 모양이 달라서)
function Check({ checked, onChange, strong, children }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(ev) => onChange(ev.target.checked)}
        className="sr-only peer"
      />
      <span
        aria-hidden
        className={`shrink-0 mt-0.5 grid place-items-center w-[20px] h-[20px] rounded-md border text-[12px] font-bold transition-colors ${
          checked
            ? 'border-kb-yellow bg-kb-yellow text-kb-brownDark'
            : 'border-ink-300 bg-white text-transparent'
        } peer-focus-visible:ring-2 peer-focus-visible:ring-kb-yellow/40`}
      >
        ✓
      </span>
      <span
        className={`text-[14px] leading-[1.5] ${
          strong ? 'font-bold text-kb-brownDark' : 'text-ink-700'
        }`}
      >
        {children}
      </span>
    </label>
  )
}


/* ---------- 회원가입 화면 ---------- */

const EMPTY_FORM = {
  loginId: '',
  name: '',
  email: '',
  password: '',
  passwordConfirm: '',
  birthDate: '',
  gender: '',
  job: '',
  region: '',
  phone: '',
  agreePrivacy: false,
  agreeMydata: false,
  agreeMarketing: false, // 선택 항목이라 검증하지 않음
}

export default function Signup({ onNext, onGoLogin, onBack }) {
  const [form, setForm] = useState(EMPTY_FORM)

  // 건드린 필드만 에러를 보여줌. 처음부터 빨간 문구가 깔려 있으면 보기 나쁨
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)

  // 서버가 돌려준 에러. errorCode 가 특정 필드용이면 fieldError 로, 아니면 배너로 띄움
  const [serverError, setServerError] = useState('')
  const [fieldError, setFieldError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const errors = validate(form)

  // 제출을 한 번 눌렀으면 전부 보여주고, 그 전에는 blur 된 것만
  const errorOf = (key) => fieldError[key] ?? (submitted || touched[key] ? errors[key] : undefined)

  // 값을 고치면 그 필드의 서버 에러는 지움 (아이디 바꿨는데 '중복' 문구가 남아있으면 이상함)
  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldError((prev) => (key in prev ? { ...prev, [key]: undefined } : prev))
  }
  const blur = (key) => () => setTouched((prev) => ({ ...prev, [key]: true }))

  // 필수 동의 2개를 한 번에 켜고 끄는 전체 동의
  const allAgreed = form.agreePrivacy && form.agreeMydata && form.agreeMarketing
  const toggleAll = (on) =>
    setForm((prev) => ({ ...prev, agreePrivacy: on, agreeMydata: on, agreeMarketing: on }))

  async function handleSubmit(ev) {
    ev.preventDefault()
    setSubmitted(true)
    setServerError('')

    if (Object.keys(errors).length > 0) {
      // 첫 번째 에러 필드로 스크롤을 올려줌
      const first = document.querySelector('[data-error="true"]')
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSubmitting(true)
    try {
      /* POST /api/auth/signup
         지금 서버가 받는 건 이 4개뿐. 생년월일·성별·직업·거주지역·휴대폰은
         화면에만 남아있고 전송되지 않음 (백엔드에 필드 추가 요청 중) */
      await signup({
        loginId: form.loginId,
        password: form.password,
        email: form.email,
        name: form.name,
      })
      onNext()
    } catch (err) {
      if (err instanceof ApiError) {
        // 중복 에러는 해당 입력칸 아래에 붙여주는 게 훨씬 알아보기 쉬움
        // 백엔드 에러 코드 체계가 두 벌이라 양쪽 값을 모두 본다
        if (err.errorCode === 'AUTH_001') setFieldError({ loginId: err.message })
        else if (err.errorCode === 'AUTH_002' || err.errorCode === 'DUPLICATE_EMAIL') {
          setFieldError({ email: err.message })
        }
        else setServerError(err.message)
      } else {
        setServerError('회원가입 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* 상단 로고 — 누르면 홍보 페이지로 돌아감 */}
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
        {/* 진행 단계 */}
        <div className="pt-2 pb-6 overflow-x-auto">
          <Stepper current={0} />
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-2xl border border-line bg-white px-6 sm:px-10 py-9"
          style={{ boxShadow: '0 6px 24px -8px rgba(74, 68, 59, 0.28)' }}
        >
          <h1 className="text-[28px] font-extrabold tracking-tight text-kb-brownDark">회원가입</h1>
          <p className="mt-2 text-[15px] leading-[1.6] text-ink-500">
            입력하신 정보는 자취 가능 시점 예측과 맞춤 정책 추천에만 사용돼요.
          </p>

          {/* 특정 필드에 붙일 수 없는 서버 에러 (통신 실패, COMMON_001 등) */}
          {serverError && (
            <p className="mt-6 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-[14px] leading-[1.6] text-danger">
              {serverError}
            </p>
          )}

          {/* 아이디 / 이름 */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div data-error={Boolean(errorOf('loginId'))}>
              <Field label="아이디" required error={errorOf('loginId')} hint="영문 4~20자">
                <input
                  type="text"
                  value={form.loginId}
                  onChange={(ev) => set('loginId')(ev.target.value)}
                  onBlur={blur('loginId')}
                  placeholder="testUser"
                  autoComplete="username"
                  className={inputClass(Boolean(errorOf('loginId')))}
                />
              </Field>
            </div>

            <div data-error={Boolean(errorOf('name'))}>
              <Field label="이름" required error={errorOf('name')}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(ev) => set('name')(ev.target.value)}
                  onBlur={blur('name')}
                  placeholder="홍길동"
                  autoComplete="name"
                  className={inputClass(Boolean(errorOf('name')))}
                />
              </Field>
            </div>

          </div>

          {/* 이메일 / 생년월일 */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div data-error={Boolean(errorOf('email'))}>
              <Field label="이메일" required error={errorOf('email')}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(ev) => set('email')(ev.target.value)}
                  onBlur={blur('email')}
                  placeholder="example@kb.com"
                  autoComplete="email"
                  className={inputClass(Boolean(errorOf('email')))}
                />
              </Field>
            </div>

            <div data-error={Boolean(errorOf('birthDate'))}>
              <Field label="생년월일" required error={errorOf('birthDate')}>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(ev) => set('birthDate')(ev.target.value)}
                  onBlur={blur('birthDate')}
                  max={new Date().toISOString().slice(0, 10)}
                  className={inputClass(Boolean(errorOf('birthDate')))}
                />
              </Field>
            </div>
          </div>

          {/* 비밀번호 / 비밀번호 확인 */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div data-error={Boolean(errorOf('password'))}>
              <Field
                label="비밀번호"
                required
                error={errorOf('password')}
                hint="10~22자, 특수문자 1개 이상"
              >
                <input
                  type="password"
                  value={form.password}
                  onChange={(ev) => set('password')(ev.target.value)}
                  onBlur={blur('password')}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={inputClass(Boolean(errorOf('password')))}
                />
              </Field>
            </div>

            <div data-error={Boolean(errorOf('passwordConfirm'))}>
              <Field label="비밀번호 확인" required error={errorOf('passwordConfirm')}>
                <input
                  type="password"
                  value={form.passwordConfirm}
                  onChange={(ev) => set('passwordConfirm')(ev.target.value)}
                  onBlur={blur('passwordConfirm')}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={inputClass(Boolean(errorOf('passwordConfirm')))}
                />
              </Field>
            </div>
          </div>

          {/* 성별 / 직업 */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div data-error={Boolean(errorOf('gender'))}>
              <Field label="성별" required error={errorOf('gender')}>
                <Segmented
                  options={GENDERS}
                  value={form.gender}
                  onChange={(v) => {
                    set('gender')(v)
                    setTouched((prev) => ({ ...prev, gender: true }))
                  }}
                  hasError={Boolean(errorOf('gender'))}
                />
              </Field>
            </div>

            <div data-error={Boolean(errorOf('job'))}>
              <Field label="직업" required error={errorOf('job')}>
                <Segmented
                  options={JOBS}
                  value={form.job}
                  onChange={(v) => {
                    set('job')(v)
                    setTouched((prev) => ({ ...prev, job: true }))
                  }}
                  hasError={Boolean(errorOf('job'))}
                />
              </Field>
            </div>
          </div>

          {/* 거주지역 / 휴대폰 */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div data-error={Boolean(errorOf('region'))}>
              <Field
                label="현재 거주지역"
                required
                error={errorOf('region')}
                hint="지역별 정책·지원금을 찾는 데 사용돼요."
              >
                <select
                  value={form.region}
                  onChange={(ev) => set('region')(ev.target.value)}
                  onBlur={blur('region')}
                  className={`${inputClass(Boolean(errorOf('region')))} ${
                    form.region ? 'text-ink-900' : 'text-ink-300'
                  }`}
                >
                  <option value="">시·도를 선택해주세요</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r} className="text-ink-900">
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div data-error={Boolean(errorOf('phone'))}>
              <Field label="휴대폰 번호" required error={errorOf('phone')}>
                <input
                  type="tel"
                  value={form.phone}
                  // 입력할 때마다 하이픈을 자동으로 넣어줌
                  onChange={(ev) => set('phone')(formatPhone(ev.target.value))}
                  onBlur={blur('phone')}
                  placeholder="010-1234-5678"
                  inputMode="numeric"
                  autoComplete="tel"
                  className={inputClass(Boolean(errorOf('phone')))}
                />
              </Field>
            </div>
          </div>

          {/* 동의 */}
          <div
            className="mt-8 rounded-xl border border-line bg-kb-yellowBg px-5 py-5"
            data-error={Boolean(errorOf('agreePrivacy') || errorOf('agreeMydata'))}
          >
            <Check checked={allAgreed} onChange={toggleAll} strong>
              약관에 모두 동의합니다
            </Check>

            <div className="my-4 h-px bg-kb-yellowSoft" />

            <div className="space-y-3.5">
              <Check checked={form.agreePrivacy} onChange={set('agreePrivacy')}>
                <span className="font-semibold text-kb-brownDark">[필수]</span> 개인정보 수집·이용 동의
              </Check>

              <Check checked={form.agreeMydata} onChange={set('agreeMydata')}>
                <span className="font-semibold text-kb-brownDark">[필수]</span> 마이데이터 수집·이용 동의
                <span className="block mt-1 text-[13px] text-ink-500">
                  소득·소비·자산 정보를 불러와 자취 가능 시점을 계산해요.
                </span>
              </Check>

              <Check checked={form.agreeMarketing} onChange={set('agreeMarketing')}>
                <span className="font-semibold text-ink-500">[선택]</span> 마케팅 정보 수신 동의
              </Check>
            </div>

            {(errorOf('agreePrivacy') || errorOf('agreeMydata')) && (
              <p className="mt-4 text-[13px] text-danger">
                {errorOf('agreePrivacy') || errorOf('agreeMydata')}
              </p>
            )}
          </div>

          {/* 다음 버튼 — 시나리오 ① 의 'KB Yellow 다음(마이데이터 연결)' */}
          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full h-[62px] rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
              disabled:opacity-60 disabled:cursor-not-allowed
              text-[18px] font-bold text-kb-brownDark transition-colors"
          >
            {submitting ? '가입 중…' : '다음 (마이데이터 연결)'}
          </button>

          <p className="mt-6 text-center text-[15px] text-ink-500">
            이미 계정이 있으신가요?{' '}
            <button
              type="button"
              onClick={onGoLogin}
              className="font-bold text-kb-brownDark underline underline-offset-4 hover:text-kb-yellowDark"
            >
              로그인하기
            </button>
          </p>
        </form>
      </main>
    </div>
  )
}
