/* ============================================================
   KB 청년 자취 도우미 — 맞춤 정책·지원금 (시나리오 ⑦)
   독립만세팀 / KB AI Challenge 2026

   사이드바의 [맞춤 정책·지원금] 메뉴 화면.
   POST /api/policy/recommend 로 조건에 맞는 청년 정책을 받아온다.

   [조건 3개]
     region     시·도 (회원가입 거주지역)
     income     월 소득 (원 단위)
     birthDate  생년월일 (YYYY-MM-DD)

   ※ 이 값들은 회원가입에서 받았지만 서버가 저장하지 않는다.
     (signup 이 loginId·password·email·name 4개만 받음)
     그래서 store 에 남겨둔 값으로 채우고, 화면에서 고칠 수도 있게 했다.
     로그인으로 들어온 사용자는 store 가 비어 있어서 직접 골라야 한다.
     signup 에 필드가 추가되면 이 입력줄은 없애고 자동으로 채우면 됨.
     (BACKEND_REQUEST_2D.md 8번)

   ※ policy API 는 인증이 필요 없다 (SecurityConfig 에서 permitAll).
     그래서 로그인 전에도 부를 수 있음.
   ============================================================ */

import { useEffect, useRef, useState } from 'react'
import { Sidebar, TopBar, IconBox } from './Shell.jsx'
import { recommendPolicy, askAi, getUser, ApiError } from './api.js'
import { useAppData, markCheck, savePolicySupport } from './store.js'
import { pickPolicy } from './analysis.js'
import AiPick from './AiPick.jsx'

/* ---------- 선택 항목 ---------- */

// 회원가입 화면과 같은 목록 (서버 region 파라미터로 그대로 전달)
const REGIONS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
  '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도',
  '제주특별자치도',
]

/* 서버가 주는 status 는 두 값만 사용하기로 정했다.
   그 외 값이 오면 회색으로 그대로 보여준다 (지어내지 않음) */
const STATUS_SKIN = {
  '신청 가능': 'bg-kb-yellow text-kb-brownDark',
  '조건 확인 필요': 'bg-gray-100 text-ink-700',
}

const won = (n) => `${Number(n ?? 0).toLocaleString('ko-KR')}원`
const digitsOnly = (v) => v.replace(/\D/g, '').slice(0, 12)

/* ---------- 조회 결과 캐시 ----------

   정책 추천은 조건이 같으면 답도 같다. 그런데 서버가 이 요청을 받을 때마다
   Perplexity 를 호출하면 화면을 한 번 들락거릴 때마다 크레딧이 나간다.
   같은 조건이면 이번 세션 동안은 저장해둔 결과를 그대로 쓴다.

   sessionStorage 를 쓰는 이유 — 탭을 닫으면 사라지므로 오래된 결과가 남지 않는다.
   [새로 조회] 버튼은 force 로 이 캐시를 건너뛴다. */
const CACHE_KEY = 'kb_policy_cache'

const cacheKey = ({ residenceRegion, birthDate, income }) =>
  `${residenceRegion}|${birthDate}|${income}`

function readCache(key) {
  try {
    const all = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}')
    return all[key] ?? null
  } catch {
    return null
  }
}

function writeCache(key, value) {
  try {
    const all = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}')
    all[key] = value
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(all))
  } catch {
    /* 저장 실패는 무시 — 다음에 다시 조회하면 그만이다 */
  }
}
const withComma = (v) => (v ? Number(v).toLocaleString('ko-KR') : '')

const CARD = 'rounded-2xl border border-line bg-white'

// 만 나이 — 화면에 '만 27세 기준' 처럼 보여주면 조건이 이해되기 쉬움
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

function Field({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="block mb-1.5 text-[13px] font-bold text-kb-brownDark">{label}</span>
      {children}
    </label>
  )
}

const inputClass = `w-full h-[46px] px-3.5 rounded-xl border border-line bg-white text-[14px]
  text-ink-900 placeholder:text-ink-300 outline-none transition-colors
  focus:border-kb-yellow focus:ring-2 focus:ring-kb-yellow/30`

/* ---------- 정책 카드 ---------- */

function PolicyCard({ policy, index = 0 }) {
  const skin = STATUS_SKIN[policy.status] ?? 'bg-gray-100 text-ink-500'

  return (
    // 카드가 한꺼번에 뜨면 몇 건인지 파악하기 어렵다. 순서대로 나타나면 자연히 세어진다
    <li
      className={`${CARD} kb-fade-up px-5 py-5 flex flex-col`}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[16px] font-bold text-kb-brownDark leading-[1.4]">
          {policy.name}
        </h3>
        {policy.status && (
          <span className={`shrink-0 h-[26px] px-2.5 rounded-full text-[12px] font-bold grid place-items-center ${skin}`}>
            {policy.status}
          </span>
        )}
      </div>

      {/* 서버가 25자 이내로 잘라서 보내는 한 줄 설명 */}
      {policy.description && (
        <p className="mt-2 text-[14px] leading-[1.6] text-ink-700">{policy.description}</p>
      )}

      {/* 신청 대상 조건 — 정책 자체의 성격이라 사용자와 무관하게 고정된 값 */}
      {policy.eligibility && (
        <p className="mt-2 text-[13px] leading-[1.6] text-ink-500">
          <span className="font-semibold text-ink-700">대상</span> {policy.eligibility}
        </p>
      )}

      {/* 왜 이 사람에게 맞는지 — 서버가 걸러낸 근거를 그대로 보여준다.
          "왜 나한테 이걸 추천했지?" 에 답이 없으면 추천 자체를 안 믿는다.
          AI 가 지어낸 문장이 아니라 필터를 통과한 조건이라 항상 사실이다 */}
      {policy.matchReasons?.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-xl bg-kb-yellowBg px-3.5 py-3">
          {policy.matchReasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-[13px] leading-[1.55] text-kb-brownDark">
              <span className="shrink-0 text-kb-yellowDark" aria-hidden>
                ✓
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 지원 금액이 있으면 금액과 근거를, 없으면 근거 문구만.
          대출처럼 '지원금' 개념이 아닌 정책은 supportAmount 가 null 로 온다 */}
      {(policy.supportAmount || policy.supportNote) && (
        <div className="mt-3 pt-3 border-t border-line">
          {policy.supportAmount > 0 && (
            <p className="text-[15px] font-bold text-kb-brownDark tabular-nums">
              {won(policy.supportAmount)}
            </p>
          )}
          {policy.supportNote && (
            <p className="mt-0.5 text-[13px] leading-[1.6] text-ink-500">{policy.supportNote}</p>
          )}
        </div>
      )}

      {/* 남는 높이를 밀어내서 버튼을 카드 아래에 정렬 */}
      <div className="flex-1 min-h-[8px]" />

      {policy.link ? (
        <a
          href={policy.link}
          target="_blank"
          rel="noreferrer"
          className="mt-4 h-[44px] grid place-items-center rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
            text-[14px] font-bold text-kb-brownDark transition-colors"
        >
          신청 페이지로 가기
        </a>
      ) : (
        <span className="mt-4 h-[44px] grid place-items-center rounded-xl bg-gray-50 border border-line
          text-[14px] font-semibold text-ink-300">
          신청 링크 준비 중
        </span>
      )}
    </li>
  )
}

/* ---------- 맞춤 정책·지원금 화면 ---------- */

export default function Policy({ onNavigate, onLogout }) {
  /* 조건(지역·생년월일·소득)을 서버에서 받아온다.
     예전에는 회원가입 때 브라우저에 담아둔 값을 썼는데, 이제 서버가 갖고 있어서
     다른 기기에서 로그인해도 그대로 채워진다 */
  const [saved] = useAppData()
  const userName = saved.me?.name ?? getUser()?.name ?? '고객'

  const [region, setRegion] = useState(saved.profile?.residenceRegion ?? '')
  const [birthDate, setBirthDate] = useState(saved.profile?.birthDate ?? '')
  const [incomeText, setIncomeText] = useState(
    saved.monthlyIncome ? String(saved.monthlyIncome) : '',
  )

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const income = Number(incomeText || 0)
  const age = calcAge(birthDate)
  const ready = region && birthDate && income > 0

  /* 조건 입력칸을 펼쳐둘지.
     이미 아는 값이면 접어두고 결과부터 보여준다. 모르면 펼쳐서 물어본다.
     "아까 가입할 때 적었는데 왜 또 묻지" 가 되지 않도록 */
  const [editing, setEditing] = useState(!ready)

  /* 조회 결과를 다른 화면에 반영한다. 서버에서 막 받았든 캐시에서 꺼냈든
     사용자에게는 똑같이 '정책을 확인한 것' 이라 한 곳에 모아두고 양쪽에서 부른다. */
  function applyResult(data) {
    // 홈 체크리스트의 '정책·지원금 확인' 을 완료로. 조회에 성공했을 때만 표시한다
    markCheck('policy')

    /* 받을 수 있는 지원금 합계를 자금조달 설계로 넘긴다.
       금액을 모르는 정책(supportAmount: null)은 빼고 더한다.

       합계가 0 이어도 0 을 넘긴다 — 전에는 null 로 바꿔 보냈는데, 그러면 자금조달 설계에서
       '아직 안 알아봄' 과 '알아봤는데 금액을 아는 정책이 없더라' 가 구분되지 않는다.
       null 은 '이 화면에 아직 안 왔다' 는 뜻으로만 쓴다. */
    const support = (data.policies ?? []).reduce((sum, p) => sum + Number(p.supportAmount ?? 0), 0)
    savePolicySupport(support)
  }

  async function search(next = { residenceRegion: region, income, birthDate }, { force = false } = {}) {
    if (!(next.residenceRegion && next.birthDate && next.income > 0)) {
      setError('지역·생년월일·월 소득을 모두 입력해주세요.')
      setEditing(true)
      return
    }

    /* 같은 조건이면 이번 세션 동안 다시 부르지 않는다.
       화면을 들락거릴 때마다 서버가 AI 를 호출하면 크레딧이 그만큼 나간다.
       조건(지역·생년월일·소득)이 바뀌면 키가 달라져서 자동으로 새로 부른다. */
    const key = cacheKey(next)
    if (!force) {
      const hit = readCache(key)
      if (hit) {
        setResult(hit)
        setEditing(false)
        setError('')
        /* 캐시로 그렸을 때도 다른 화면에 알린다.

           전에는 여기서 그냥 return 해버려서 아래 markCheck·savePolicySupport 가
           캐시 경로에서는 한 번도 실행되지 않았다. 그 결과 정책 화면에는 목록이 떠 있는데
           홈 체크리스트는 '대기', 자금조달 설계는 '지원금 0원' 인 상태가 됐다.
           사용자가 보기엔 세 화면이 같은 사실을 다르게 말하는 셈이었다. */
        applyResult(hit)
        return
      }
    }

    setError('')
    setLoading(true)
    try {
      const data = await recommendPolicy(next)
      writeCache(key, data)
      setResult(data)
      setEditing(false) // 결과가 나오면 조건은 한 줄로 접는다
      applyResult(data)
    } catch (err) {
      setResult(null)
      setError(
        err instanceof ApiError ? err.message : '정책을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
      )
    } finally {
      setLoading(false)
    }
  }

  /* 화면에 들어오자마자 자동 조회.
     아는 값이 다 있는데 버튼을 한 번 더 누르게 하는 건 사용자 입장에서 군더더기다.
     빈 값이 있을 때만 입력칸을 펼쳐서 물어본다.

     ★ 지금은 이 값들이 브라우저에만 남아 있어서, 다른 기기에서 로그인하면 다시 물어봐야 한다.
       회원 정보에 birthDate·residenceRegion 이 저장되면(BACKEND_REQUEST_2D 8번)
       GET /api/users/me 로 채워서 이 입력칸 자체를 없앨 수 있다. */
  /* 서버 응답은 첫 렌더 뒤에 온다. 조건이 채워지는 순간 한 번만 조회한다.
     autoRan 으로 잠가서, 값이 바뀔 때마다 반복 호출되지 않게 함 */
  const autoRan = useRef(false)

  useEffect(() => {
    // 빈 칸이 있으면 서버에서 온 값으로 채운다 (사용자가 고치던 값은 유지)
    if (!region && saved.profile?.residenceRegion) setRegion(saved.profile.residenceRegion)
    if (!birthDate && saved.profile?.birthDate) setBirthDate(saved.profile.birthDate)
    if (!incomeText && saved.monthlyIncome) setIncomeText(String(saved.monthlyIncome))
  }, [saved.profile, saved.monthlyIncome])

  useEffect(() => {
    if (autoRan.current || !ready) return
    autoRan.current = true
    search()
  }, [ready])

  const policies = result?.policies ?? []

  /* AI 어드바이스 — 서버 API 가 붙으면 여기서 답변이 채워진다.
     지금은 askAi 가 AI_NOT_READY 를 던져서 안내만 뜬다 */
  const [advice, setAdvice] = useState(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceError, setAdviceError] = useState('')

  async function ask(question) {
    setAdviceError('')
    setAdviceLoading(true)
    try {
      const res = await askAi({ scope: 'policy', question, context: { residenceRegion: region, income, birthDate, age, policies } })
      setAdvice({ ...res, question })
    } catch (err) {
      setAdvice(null)
      setAdviceError(err instanceof ApiError ? err.message : 'AI 답변을 받지 못했어요.')
    } finally {
      setAdviceLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      <Sidebar active="맞춤 정책·지원금" onNavigate={onNavigate} />

      <main className="flex-1 min-w-0 flex flex-col gap-5 px-5 sm:px-8 py-5 pb-14">
        <TopBar
          userName={userName}
          onNavigate={onNavigate}
          onLogout={onLogout}
          title="맞춤 정책·지원금"
          subtitle="조건에 맞는 청년 주거 정책을 찾아드려요."
        />

        {/* ① 조건 — 아는 값이면 한 줄 요약, 모르거나 고칠 때만 입력칸 */}
        {editing ? (
          <section className={`${CARD} px-6 sm:px-8 py-6`}>
            <SectionTitle
              title="내 조건"
              right={
                age != null && <span className="text-[13px] text-ink-500">만 {age}세 기준</span>
              }
            />

            <p className="mt-2 text-[14px] text-ink-500">
              {saved.profile
                ? '가입할 때 입력한 정보예요. 다른 조건으로도 찾아볼 수 있어요.'
                : '조건을 입력하면 맞는 정책을 찾아드려요.'}
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="거주 지역">
                <select
                  value={region}
                  onChange={(ev) => setRegion(ev.target.value)}
                  className={`${inputClass} ${region ? 'text-ink-900' : 'text-ink-300'}`}
                >
                  <option value="">시·도 선택</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r} className="text-ink-900">
                      {r}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="생년월일">
                <input
                  type="date"
                  value={birthDate}
                  onChange={(ev) => setBirthDate(ev.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className={inputClass}
                />
              </Field>

              <Field label="월 소득">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={withComma(incomeText)}
                    onChange={(ev) => setIncomeText(digitsOnly(ev.target.value))}
                    placeholder="2,000,000"
                    className={`${inputClass} pr-10 tabular-nums`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[14px] text-ink-500">
                    원
                  </span>
                </div>
              </Field>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-[14px] leading-[1.6] text-danger">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                /* 조건을 직접 고치고 누른 버튼이므로 캐시를 건너뛰고 새로 조회한다 */
                onClick={() => search(undefined, { force: true })}
                disabled={loading}
                className="h-[50px] px-8 rounded-xl bg-kb-yellow hover:bg-kb-yellowDark
                  disabled:opacity-60 disabled:cursor-not-allowed
                  text-[16px] font-bold text-kb-brownDark transition-colors"
              >
                {loading ? '찾는 중…' : '이 조건으로 찾기'}
              </button>

              {/* 결과를 보다가 조건만 열어본 경우엔 되돌아갈 수 있어야 함 */}
              {result && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="h-[50px] px-6 rounded-xl border border-line bg-white hover:bg-gray-50
                    text-[15px] font-semibold text-ink-700 transition-colors"
                >
                  취소
                </button>
              )}
            </div>
          </section>
        ) : (
          <section className={`${CARD} px-6 sm:px-8 py-4 flex flex-wrap items-center gap-x-3 gap-y-2`}>
            <span className="text-[13px] font-bold text-kb-brownDark">내 조건</span>
            <span className="text-[14px] text-ink-700">
              {region} · 만 {age}세 · 월 {won(income)}
            </span>
            <span className="flex-1 min-w-[8px]" />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-[38px] px-4 rounded-xl border border-line bg-white hover:bg-gray-50
                text-[14px] font-semibold text-ink-700 transition-colors"
            >
              조건 변경
            </button>
          </section>
        )}

        {/*
          ② 추천 — 여러 정책 중 무엇을 먼저 볼지
          서버 aiReason 은 지금 고정 문장이라(PolicyService 에 하드코딩) 쓰지 않는다.
          조건으로 하나를 고르고 근거를 숫자와 함께 보여준다.
          서버가 구조화된 AI 응답을 주면 그 값으로 바꾸면 된다.
        */}
        {/* 서버가 AI 추천(recommendation)을 주면 그대로 쓰고,
            못 만들었으면(null) 프론트가 조건으로 고른 값을 보여준다 */}
        {policies.length > 0 && (
          <AiPick
            {...(result?.recommendation
              ? {
                  source: result.recommendation.source ?? 'ai',
                  headline: result.recommendation.headline,
                  reasons: result.recommendation.reasons ?? [],
                  alternative: result.recommendation.alternative,
                  count: policies.length,
                }
              : pickPolicy(policies, { age, income, region }))}
            advice={advice}
            loading={adviceLoading}
            error={adviceError}
            onAsk={ask}
            questions={['이 중에서 뭐부터 신청해야 하나요?', '제가 못 받는 정책이 있나요?', '신청할 때 뭘 준비해야 하나요?']}
          />
        )}

        

        {/* ④ 정책 목록 */}
        {loading ? (
          // 들어오자마자 자동으로 찾기 때문에, 빈 화면 대신 찾는 중임을 보여준다
          <section className={`${CARD} px-6 py-16 grid place-items-center`}>
            <div className="text-center">
              <span
                className="block mx-auto w-[34px] h-[34px] rounded-full border-[3px] border-kb-yellowSoft border-t-kb-yellow animate-spin"
                aria-hidden
              />
              <p className="mt-5 text-[15px] font-semibold text-kb-brownDark">
                조건에 맞는 정책을 찾고 있어요
              </p>
            </div>
          </section>
        ) : result ? (
          policies.length > 0 ? (
            <section>
              <SectionTitle
                title={`추천 정책 ${policies.length}건`}
                right={
                  <span className="text-[13px] text-ink-500">
                    {region} · 만 {age}세 · 월 {won(income)}
                  </span>
                }
              />
              {/* 카드 높이를 맞추려고 items-stretch. 설명 길이가 달라도 버튼 줄이 맞음 */}
              <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
                {policies.map((p, i) => (
                  <PolicyCard key={p.policyId ?? p.name} policy={p} index={i} />
                ))}
              </ul>
            </section>
          ) : (
            <section className={`${CARD} px-6 py-16 grid place-items-center`}>
              <div className="text-center max-w-[380px]">
                {/* ★ 아이콘 : 정책 — public/assets/policy.png */}
                <img
                  src="/assets/policy.png"
                  alt=""
                  className="h-[56px] w-auto object-contain mx-auto opacity-50"
                />
                <p className="mt-5 text-[17px] font-bold text-kb-brownDark">
                  조건에 맞는 정책을 찾지 못했어요
                </p>
                <p className="mt-2 text-[14px] leading-[1.7] text-ink-500">
                  지역이나 소득 조건을 바꿔서 다시 찾아보세요.
                </p>
              </div>
            </section>
          )
        ) : (
          <section className={`${CARD} px-6 py-16 grid place-items-center`}>
            <div className="text-center max-w-[400px]">
              {/* ★ 아이콘 : 정책 — public/assets/policy.png */}
              <img
                src="/assets/policy.png"
                alt=""
                className="h-[56px] w-auto object-contain mx-auto opacity-50"
              />
              <p className="mt-5 text-[17px] font-bold text-kb-brownDark">
                조건을 알려주시면 바로 찾아드려요
              </p>
              {/* 소득은 마이데이터로도 안 잡히는 값이라, 아직 저장 전이면 여기서 물어보게 됨 */}
              <p className="mt-2 text-[14px] leading-[1.7] text-ink-500">
                지역·생년월일·월 소득이 있으면 다음부터는 자동으로 찾아드려요.
              </p>
            </div>
          </section>
        )}

        {/* 안내 — 정책은 수시로 바뀌므로 최종 확인은 공식 페이지에서 */}
        <p className="flex items-start gap-2.5 text-[13px] leading-[1.6] text-ink-500">
          {/* ★ 아이콘 : 방패 — public/assets/shield.png */}
          <img src="/assets/shield.png" alt="" className="h-[17px] w-auto object-contain shrink-0 mt-px" />
          정책 내용과 지원 조건은 수시로 바뀔 수 있어요. 신청 전 공식 페이지에서 다시 확인해주세요.
        </p>
        

      </main>
    </div>
  )
}
