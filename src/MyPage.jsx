/* ============================================================
   KB 청년 자취 도우미 — 마이페이지
   독립만세팀 / KB AI Challenge 2026

   회원가입 때 입력한 정보를 다시 확인하고 고치는 화면.

   [데이터 흐름] 2026-08-01 백엔드 개편 이후

     읽기   GET /api/users/me      이름·이메일·소득·생년월일·지역·성별·직업
     쓰기   PATCH /api/users/me    추가 정보 수정 (보낸 필드만 갱신)

   전에는 저장할 API 가 없어서 브라우저에만 남겼는데, 이제 서버에 저장된다.
   다른 기기에서 로그인해도 값이 그대로 보인다.

   [아직 화면에 없는 것]
   비밀번호 변경(PATCH /me/password) — API 는 있으나 현재 비밀번호 확인 절차가 필요해
   별도 작업으로 남겨둠. 회원 탈퇴(DELETE /me)는 아래 '계정 관리' 에 붙였다.
   ============================================================ */

import { useEffect, useState } from 'react'
import { Sidebar, TopBar } from './Shell.jsx'
import { getUser, updateProfile, deleteAccount, ApiError } from './api.js'
import { useAppData, saveProfile } from './store.js'


/* ---------- 선택 항목 (회원가입 화면과 같은 목록) ---------- */

const GENDERS = ['남성', '여성']
// 서버 enum(Job.java) 과 같아야 한다 — 학생 / 무직 / 직장인
const JOBS = ['학생', '무직', '직장인']

const REGIONS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
  '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도',
  '제주특별자치도',
]

const CARD = 'rounded-2xl border border-line bg-white'

// 만 나이. 생일이 아직 안 지났으면 한 살 빼줌
function calcAge(iso) {
  if (!iso) return null
  const birth = new Date(iso)
  if (Number.isNaN(birth.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
}

// 숫자만 남기고 010-1234-5678 모양으로 하이픈을 끼워넣음
function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length < 4) return digits
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}


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

function Field({ label, error, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="block mb-2 text-[14px] font-bold text-kb-brownDark">{label}</span>
      {children}
      {error ? (
        <span className="block mt-1.5 text-[13px] text-danger">{error}</span>
      ) : hint ? (
        <span className="block mt-1.5 text-[13px] text-ink-500">{hint}</span>
      ) : null}
    </label>
  )
}

function inputClass(hasError) {
  return `w-full h-[52px] px-4 rounded-xl border bg-white text-[15px] text-ink-900
    placeholder:text-ink-300 outline-none transition-colors
    focus:border-kb-yellow focus:ring-2 focus:ring-kb-yellow/30
    ${hasError ? 'border-danger' : 'border-line'}`
}

// 고칠 수 없는 값 (아이디처럼 계정을 가리키는 값)
function ReadOnlyField({ label, value, note }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[14px] font-bold text-kb-brownDark">{label}</p>
      <p className="h-[52px] px-4 rounded-xl border border-line bg-gray-50 flex items-center text-[15px] text-ink-500 truncate">
        {value || '—'}
      </p>
      {note && <p className="mt-1.5 text-[13px] text-ink-500">{note}</p>}
    </div>
  )
}

// 성별·직업처럼 선택지가 2~3개일 때
function Segmented({ options, value, onChange }) {
  return (
    <div className={`grid gap-2 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`} role="radiogroup">
      {options.map((opt) => {
        const isOn = value === opt
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={isOn}
            onClick={() => onChange(isOn ? '' : opt)} // 한 번 더 누르면 선택 해제
            className={`h-[52px] rounded-xl border text-[15px] font-semibold transition-colors ${
              isOn
                ? 'border-kb-yellow bg-kb-yellowBg text-kb-brownDark'
                : 'border-line bg-white text-ink-700 hover:bg-gray-50'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function Banner({ tone = 'info', children }) {
  if (!children) return null
  const skin = {
    info: 'border-line bg-gray-50 text-ink-700',
    warn: 'border-kb-yellow/45 bg-kb-yellowBg text-kb-brownDark',
    ok: 'border-ok/40 bg-ok/5 text-ok',
    danger: 'border-danger/40 bg-danger/5 text-danger',
  }[tone]
  return <p className={`rounded-xl border px-4 py-3 text-[14px] leading-[1.6] ${skin}`}>{children}</p>
}


/* ---------- 마이페이지 ---------- */

export default function MyPage({ onNavigate, onLogout }) {
  const [saved] = useAppData()
  // 서버 응답(me)이 오면 그걸 쓰고, 아직이면 로그인 응답으로 그린다
  const user = saved.me ?? getUser()

  /* 추가 정보 — 이 브라우저에만 보관 */
  const [form, setForm] = useState({
    birthDate: saved.profile?.birthDate ?? '',
    gender: saved.profile?.gender ?? '',
    job: saved.profile?.job ?? '',
    residenceRegion: saved.profile?.residenceRegion ?? '',
    phone: saved.profile?.phone ?? '',
  })
  const [profileDone, setProfileDone] = useState(false)
  const [profileError, setProfileError] = useState('')

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setProfileDone(false) // 값을 고치면 '저장됨' 표시를 내린다
  }

  /* 서버에서 프로필이 도착하면 폼에 채운다.
     사용자가 이미 고치고 있던 칸은 건드리지 않는다 (빈 칸만 채움) */
  useEffect(() => {
    if (!saved.profile) return
    setForm((prev) => ({
      birthDate: prev.birthDate || (saved.profile.birthDate ?? ''),
      gender: prev.gender || (saved.profile.gender ?? ''),
      job: prev.job || (saved.profile.job ?? ''),
      residenceRegion: prev.residenceRegion || (saved.profile.residenceRegion ?? ''),
      phone: prev.phone || (saved.profile.phone ?? ''),
    }))
  }, [saved.profile])

  const age = calcAge(form.birthDate)

  const [saving, setSaving] = useState(false)

  /* 회원 탈퇴 — 되돌릴 수 없어서 두 단계로 나눈다.
     confirmingLeave 가 켜지면 버튼이 '정말 탈퇴할게요' 로 바뀐다 */
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')

  async function leave() {
    setLeaveError('')
    setLeaving(true)
    try {
      await deleteAccount()
      /* onLogout 이 토큰과 브라우저 사본을 함께 지우고 첫 화면으로 보낸다(App.jsx).
         탈퇴 후에 남은 데이터로 화면을 그리면 이미 없는 계정 정보가 보인다 */
      onLogout?.()
    } catch (err) {
      setLeaving(false)
      setLeaveError(
        err instanceof ApiError ? err.message : '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.',
      )
    }
  }

  async function submitProfile() {
    // 생년월일은 정책 추천의 나이 조건에 쓰이므로 앞뒤가 맞는지만 확인한다
    if (form.birthDate) {
      if (age == null || age < 0) {
        setProfileError('생년월일을 다시 확인해주세요.')
        return
      }
      if (age < 19 || age > 39) {
        setProfileError('청년 대상 서비스라 만 19~39세 기준으로 정책을 찾아드려요.')
        return
      }
    }
    if (form.phone && !/^010-\d{4}-\d{4}$/.test(form.phone)) {
      setProfileError('휴대폰 번호를 010-1234-5678 형식으로 입력해주세요.')
      return
    }

    setProfileError('')
    setSaving(true)
    try {
      /* PATCH /api/users/me — 보낸 필드만 갱신된다.
         2026-08-01 이전에는 저장할 API 가 없어서 브라우저에만 남겼다 */
      await updateProfile(form)
      saveProfile(form) // 화면이 바로 반영되도록 사본도 갱신
      setProfileDone(true)
    } catch (err) {
      setProfileError(
        err instanceof ApiError ? err.message : '저장에 실패했어요. 잠시 후 다시 시도해주세요.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      <Sidebar active="마이페이지" onNavigate={onNavigate} />

      <main className="flex-1 min-w-0 flex flex-col gap-5 px-5 sm:px-8 py-5 pb-14">
        <TopBar
          userName={user?.name ?? '고객'}
          onNavigate={onNavigate}
          onLogout={onLogout}
          title="마이페이지"
          subtitle="가입할 때 입력한 정보를 확인하고 수정할 수 있어요."
        />

        {/* ① 계정 정보 — 서버가 가진 값 */}
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          <SectionTitle title="계정 정보" />

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ReadOnlyField label="아이디" value={user?.loginId} note="아이디는 바꿀 수 없어요." />
            <ReadOnlyField label="이름" value={user?.name} />
            {/* GET /api/users/me 응답에서 온다. 서버 응답 전 한 프레임은 비어 있을 수 있음 */}
            <ReadOnlyField label="이메일" value={user?.email} />
          </div>

          {/* 이름·이메일도 PATCH /api/users/me 로 고칠 수 있지만 화면을 아직 안 만들었다.
              비밀번호는 현재 비밀번호 확인 절차가 필요해서 별도 작업 */}
          <div className="mt-4">
            <Banner>
              이름·이메일·비밀번호 변경 화면은 준비 중이에요. 추가 정보는 아래에서 바로 수정할 수
              있어요.
            </Banner>
          </div>
        </section>

        {/* ② 추가 정보 — PATCH /api/users/me 로 서버에 저장
            (월 평균 소득은 마이데이터 관리 화면에서 입력하므로 여기서는 다루지 않는다.
             같은 값을 두 화면에서 고칠 수 있으면 어느 쪽이 최신인지 헷갈린다) */}
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          <SectionTitle
            title="추가 정보"
            right={age != null && <span className="text-[13px] text-ink-500">만 {age}세</span>}
          />

          <p className="mt-2 text-[14px] leading-[1.7] text-ink-500">
            정책·지원금을 찾을 때 나이와 지역 조건으로 쓰여요.
          </p>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <Field label="생년월일" hint="정책의 나이 조건(만 19~34세 등)에 쓰여요.">
              <input
                type="date"
                value={form.birthDate}
                onChange={(ev) => set('birthDate')(ev.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className={inputClass(false)}
              />
            </Field>

            <Field label="현재 거주지역" hint="지역별 정책을 찾는 데 쓰여요.">
              <select
                value={form.residenceRegion}
                onChange={(ev) => set('residenceRegion')(ev.target.value)}
                className={`${inputClass(false)} ${form.residenceRegion ? 'text-ink-900' : 'text-ink-300'}`}
              >
                <option value="">시·도 선택</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r} className="text-ink-900">
                    {r}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="성별">
              <Segmented options={GENDERS} value={form.gender} onChange={set('gender')} />
            </Field>

            <Field label="직업">
              <Segmented options={JOBS} value={form.job} onChange={set('job')} />
            </Field>

            <Field label="휴대폰 번호" hint="숫자만 입력하면 하이픈이 자동으로 붙어요.">
              <input
                type="tel"
                value={form.phone}
                onChange={(ev) => set('phone')(formatPhone(ev.target.value))}
                placeholder="010-1234-5678"
                inputMode="numeric"
                className={inputClass(false)}
              />
            </Field>
          </div>

          {profileError && (
            <div className="mt-4">
              <Banner tone="danger">{profileError}</Banner>
            </div>
          )}

          <div className="mt-5">
            <button
              type="button"
              onClick={submitProfile}
              disabled={saving}
              className={`h-[52px] px-7 rounded-xl text-[15px] font-bold transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed ${
                  profileDone
                    ? 'bg-ok/10 text-ok border border-ok/40'
                    : 'bg-kb-yellow hover:bg-kb-yellowDark text-kb-brownDark'
                }`}
            >
              {saving ? '저장 중…' : profileDone ? '✓ 저장됨' : '추가 정보 저장'}
            </button>
          </div>
        </section>

        {/* ④ 계정 관리 */}
        <section className={`${CARD} px-6 sm:px-8 py-6`}>
          <SectionTitle title="계정 관리" />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onLogout}
              className="h-[48px] px-5 rounded-xl border border-line bg-white hover:bg-gray-50
                text-[14px] font-semibold text-ink-700 transition-colors"
            >
              로그아웃
            </button>

            {/* 되돌릴 수 없는 동작이라 한 번 더 물어본다.
                모달 대신 같은 자리에서 버튼이 바뀌는 방식 — 실수로 확인을 누를 확률이 낮다 */}
            {!confirmingLeave ? (
              <button
                type="button"
                onClick={() => {
                  setLeaveError('')
                  setConfirmingLeave(true)
                }}
                className="h-[48px] px-5 rounded-xl border border-line bg-white hover:bg-gray-50
                  text-[14px] font-semibold text-ink-500 transition-colors"
              >
                회원 탈퇴
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={leave}
                  disabled={leaving}
                  className="h-[48px] px-5 rounded-xl bg-danger hover:opacity-90 disabled:opacity-60
                    text-[14px] font-bold text-white transition-opacity"
                >
                  {leaving ? '처리 중…' : '정말 탈퇴할게요'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingLeave(false)}
                  disabled={leaving}
                  className="h-[48px] px-5 rounded-xl border border-line bg-white hover:bg-gray-50
                    text-[14px] font-semibold text-ink-700 transition-colors"
                >
                  그만두기
                </button>
              </div>
            )}
          </div>

          {confirmingLeave && (
            /* 무엇이 사라지는지 적는다. '정말 탈퇴하시겠습니까?' 만으로는
               마이데이터와 분석 결과까지 지워진다는 걸 알 수 없다 */
            <p className="mt-3 text-[13px] leading-[1.7] text-ink-700">
              탈퇴하면 <span className="font-bold">연동한 마이데이터·자취 분석 결과·약관 동의</span>
              가 모두 지워져요. 되돌릴 수 없어요.
            </p>
          )}
          {leaveError && <p className="mt-3 text-[13px] text-danger">{leaveError}</p>}
        </section>
      </main>
    </div>
  )
}
