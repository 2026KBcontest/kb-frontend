/* ============================================================
   KB 청년 자취 도우미 — AI 어드바이스 (공통)
   독립만세팀 / KB AI Challenge 2026

   맞춤 정책 · 저축 플랜 · 자금조달 설계 세 화면이 같은 모양으로 쓰는 카드.
   화면마다 하나씩만 둔다.

   ────────────────────────────────────────────────────────────
   [이 카드가 하는 일]

     ① 지금 상황에서 무엇을 해야 하는지 한 줄로
     ② 왜 그런지 — 계산된 숫자를 인용해서
     ③ 다른 선택지는 왜 지금이 아닌지
     ④ 더 물어볼 수 있는 질문들

   ────────────────────────────────────────────────────────────
   [AI 가 숫자를 만들지 않는다]

   금액·개월수·비율은 전부 화면이 계산해서 넘긴다.
   AI 는 '무엇을 고를지' 와 '왜 그런지' 만 쓴다.

   생성형 모델은 그럴듯한 숫자를 지어낸다.
   "최대 2억 4천만원까지 대출 가능합니다" 가 근거 없이 나오면
   금융 서비스로서 치명적이라, 숫자는 계산에서 설명만 AI 에서 가져온다.

   ────────────────────────────────────────────────────────────
   [지금 상태와 앞으로]

     source: 'rule'  프론트가 조건으로 판단   → 배지 "조건 기반"
     source: 'ai'    서버가 GPT 로 생성       → 배지 "AI 분석"

   서버 응답이 오면 source 만 바뀌고 화면 코드는 그대로다.
   질문 칩을 누르면 askAi() 로 서버에 묻고, 답이 오면 이 카드가 그 답을 보여준다.

   ★ 백엔드 요청 : BACKEND_REQUEST_1D.md 7 · 7-3
   ============================================================ */

import { IconBox } from './Shell.jsx'


/* headline    : 한 줄 결론 (필수)
   reasons     : [{ label, value, note }] — 근거. value 는 계산된 값이어야 한다
   alternative : 다른 선택지를 왜 지금 안 고르는지
   source      : 'ai' | 'rule'
   count       : 후보가 몇 개였는지

   advice      : 질문에 대한 AI 답변 { question, text } — 있으면 결론 대신 이걸 보여줌
   questions   : 물어볼 수 있는 질문 목록
   onAsk       : 질문을 눌렀을 때
   loading     : 답변 기다리는 중
   error       : 답변을 못 받았을 때 문구 */

export default function AiPick({
  headline,
  reasons = [],
  alternative,
  source = 'rule',
  count,
  advice,
  questions = [],
  onAsk,
  loading = false,
  error,
  className = '',
}) {
  const answered = Boolean(advice?.text)

  /* 답변이 왔다고 무조건 AI 는 아니다.
     서버가 아직 AI 를 안 붙이고 고정 문구를 주는 동안에는 source 가 'rule' 로 온다.
     그 말을 그대로 믿고 배지를 정한다 — 우리가 임의로 'AI' 라고 부르지 않는다. */
  const isAi = answered ? advice.source === 'ai' : source === 'ai'

  // 보여줄 내용이 아무것도 없으면 카드를 그리지 않는다
  if (!headline && !answered && questions.length === 0) return null

  return (
    <section
      className={`kb-fade-up rounded-2xl border border-kb-yellow bg-kb-yellowBg px-6 sm:px-8 py-6 ${className}`}
    >
      {/* ---------- 제목 ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-kb-brownDark">
          <span className="w-[3px] h-[17px] rounded-full bg-kb-yellowDark" aria-hidden />
          AI 어드바이스
        </h2>

        <div className="flex items-center gap-2">
          {count > 0 && <span className="text-[13px] text-ink-500">후보 {count}건 중</span>}
          {/* 규칙으로 고른 것을 AI 라고 부르지 않는다 */}
          <span
            className={`h-[24px] px-2.5 rounded-full text-[12px] font-bold grid place-items-center ${
              isAi ? 'bg-kb-brownDark text-white' : 'bg-white border border-kb-yellow text-kb-brownDark'
            }`}
          >
            {isAi ? 'AI 분석' : '조건 기반'}
          </span>
        </div>
      </div>

      {/* ---------- 본문 ---------- */}

      {loading ? (
        <div className="mt-5 flex items-center gap-3">
          <span
            className="w-[22px] h-[22px] rounded-full border-[3px] border-white border-t-kb-yellowDark animate-spin"
            aria-hidden
          />
          <span className="text-[14px] text-ink-700">AI 가 상황을 살펴보고 있어요…</span>
        </div>
      ) : answered ? (
        /* 질문에 대한 AI 답변 */
        <div className="mt-4 flex items-start gap-3.5">
          {/* ★ 아이콘 : AI 코치 캐릭터 — public/assets/ai_coach.png */}
          <img
            src="/assets/ai_coach.png"
            alt=""
            className="hidden sm:block h-[52px] w-auto object-contain shrink-0"
          />
          <div className="min-w-0">
            {advice.question && (
              <p className="text-[13px] font-semibold text-ink-500">Q. {advice.question}</p>
            )}
            <p className="mt-1.5 text-[15px] leading-[1.8] text-ink-900 whitespace-pre-line">
              {advice.text}
            </p>
          </div>
        </div>
      ) : (
        /* 기본 상태 — 결론 + 근거 */
        <div className="mt-4 flex items-start gap-4">
          {/* ★ 아이콘 : 전구 — public/assets/light_bulb.png */}
          <IconBox size={32} src="/assets/light_bulb.png" className="mt-0.5" />

          <div className="flex-1 min-w-0">
            <p className="text-[19px] font-extrabold leading-[1.45] text-kb-brownDark">
              {headline}
            </p>

            {/* 근거 — 계산된 숫자를 그대로 인용한다 */}
            {reasons.length > 0 && (
              <ul className="mt-4 space-y-2">
                {reasons.map((r) => (
                  <li key={r.label} className="flex items-start gap-2.5 text-[14px] leading-[1.65]">
                    <span
                      className="mt-[7px] w-1.5 h-1.5 rounded-full bg-kb-yellowDark shrink-0"
                      aria-hidden
                    />
                    <span className="text-ink-700">
                      <span className="font-bold text-kb-brownDark">{r.label}</span>
                      {r.value && (
                        <span className="ml-1.5 font-semibold tabular-nums">{r.value}</span>
                      )}
                      {r.note && <span className="ml-1.5 text-ink-500">— {r.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* 고른 이유만 있으면 '왜 저건 안 되지' 가 남는다 */}
            {alternative && (
              <p className="mt-4 pt-3.5 border-t border-kb-yellowSoft text-[13px] leading-[1.7] text-ink-500">
                {alternative}
              </p>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-[13px] leading-[1.6] text-ink-500">{error}</p>}

      {/* ---------- 질문 칩 ---------- */}

      {/* 더 물어볼 수 있다는 걸 보여준다. 무엇을 물어볼지 떠올리는 것 자체가 어렵기 때문 */}
      {questions.length > 0 && (
        <div className="mt-5 pt-4 border-t border-kb-yellowSoft">
          <p className="text-[13px] font-bold text-kb-brownDark">
            {answered ? '다른 것도 물어보세요' : 'AI에게 물어보기'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {questions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onAsk?.(q)}
                disabled={loading}
                className="h-[38px] px-4 rounded-full border border-kb-yellow bg-white
                  hover:bg-kb-yellow disabled:opacity-50 disabled:cursor-not-allowed
                  text-[13px] font-semibold text-kb-brownDark transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 규칙으로 고른 상태임을 숨기지 않는다. AI 답변이 오면 이 줄은 사라진다.

          예전에는 "AI 분석이 연결되면 더 자세히 답해드려요" 라고 적혀 있었는데,
          이제 질문 칩이 실제로 AI 를 호출하므로 사실과 맞지 않는 문장이 됐다.
          지금 카드가 규칙으로 골라졌다는 사실만 밝히고, 물어보면 된다고 안내한다. */}
      {!isAi && (
        <p className="mt-3 text-[12px] leading-[1.6] text-ink-300">
          지금은 입력한 조건과 계산 결과로 골랐어요.
          {onAsk && questions.length > 0 && ' 위에서 질문하면 AI가 답해드려요.'}
        </p>
      )}
    </section>
  )
}
