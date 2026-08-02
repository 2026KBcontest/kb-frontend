/* ============================================================
   KB 청년 자취 도우미 — 파생 계산
   독립만세팀 / KB AI Challenge 2026

   서버가 주는 원본(마이데이터·분석 결과)에서 화면에 필요한 값을 계산한다.
   화면 코드에 계산식이 흩어지면 같은 값이 카드마다 다르게 나오기 쉬워서 한 곳에 모았다.

   ※ 여기 있는 계산은 전부 '프론트에서 임시로' 하는 것이다.
     원래는 서버가 GET /api/home 으로 계산된 값을 내려주는 게 맞다.
     서버가 계산해주면 이 파일의 함수를 하나씩 지우면 된다.
   ============================================================ */


/* ---------- 소비 항목 분류 ---------- */

/* 절약 대상을 고를 때 '줄일 수 있는 돈'과 '못 줄이는 돈'을 나눠야 한다.
   주거비·교통비·통신비·보험료·대출이자는 계약이 걸려 있어 이번 달에 못 줄인다.
   그런 항목을 "줄이세요" 라고 하면 조언이 아니라 잔소리가 된다. */

/* 바로 줄일 수 있는 항목 (변동 소비 + 해지 가능한 구독)

   [문구를 '카테고리명 + 줄이기' 로 통일한 이유]
   전에는 '충동구매 점검', '배달·외식 줄이기' 처럼 항목마다 다르게 적었다.
   그런데 이건 사용자의 소비를 단정하는 말이다. 쇼핑 20만원이 충동구매인지
   필요한 지출인지 우리는 알 수 없는데, '충동구매' 라고 부르면 훈계가 된다.

   지금은 전부 '식비 줄이기' 처럼 카테고리명만 쓴다.
   판단은 사용자가 하고, 우리는 어디에 얼마가 나가는지만 보여준다.
   문구가 규칙적이라 나중에 AI 가 항목을 만들어줘도 그대로 붙는다. */

export const FLEXIBLE_COST = [
  { key: 'food', label: '식비' },
  { key: 'shopping', label: '쇼핑' },
  { key: 'culture', label: '문화·취미' },
  { key: 'etc', label: '기타 소비' },
  { key: 'fixedCostSubscription', label: '구독료' },
]

// 절약 팁 문구. 규칙이 한 줄이라 바꿀 일이 있으면 여기만 고치면 된다
export const tipLabelOf = (categoryLabel) => `${categoryLabel} 줄이기`

// 단기간에 못 줄이는 항목
export const RIGID_COST = [
  { key: 'fixedCostHousing', label: '주거비' },
  { key: 'fixedCostTransport', label: '교통비' },
  { key: 'fixedCostTelecom', label: '통신비' },
  { key: 'fixedCostInsurance', label: '보험료' },
  { key: 'fixedCostLoanInterest', label: '대출이자' },
]

export const ASSET_ITEMS = [
  { key: 'assetDeposit', label: '예금', color: '#FFBC00' },
  { key: 'assetSaving', label: '적금', color: '#FFD466' },
  { key: 'assetInvestment', label: '투자 자산', color: '#FFE9AD' },
]

/* 부채는 '남은 상환액' 만 센다.
   assetLoan(최초 대출액)까지 더하면 같은 빚을 두 번 빼게 된다. */
export const DEBT_KEY = 'assetRemainingRepayment'


/* ---------- 카테고리별 아이콘 ---------- */

/* ★ 아이콘을 여기 한 곳에서만 관리한다.

   [왜 분리했나]
   전에는 FLEXIBLE_COST 안에 아이콘 경로를 같이 적어뒀다.
   나중에 절약 팁을 AI(API)가 만들어 보내주면, 서버는 '어떤 카테고리인지' 만 알려주지
   아이콘 경로까지 주지는 않는다. 그때 화면 코드에서 아이콘을 찾아야 하는데
   목록 안에 섞여 있으면 그 목록을 쓰지 않는 팁에는 아이콘을 붙일 수 없다.

   그래서 '카테고리 키 → 아이콘' 표를 따로 뒀다.
   서버가 어떤 카테고리를 보내든 이 표만 보면 아이콘이 정해진다.

   [아이콘을 추가할 때]
   public/assets/ 에 파일을 넣고 아래 표의 null 을 경로로 바꾸면 끝이다.
   화면 코드는 건드리지 않아도 된다. 없으면 노란 점이 대신 그려진다.

   ※ 소비 10개 항목 전부를 키로 넣어뒀다. AI 가 고정비(주거·통신 등)를 제안해도
     아이콘이 붙도록 미리 자리를 만들어둔 것이다. */

export const CATEGORY_ICON = {
  // 변동 소비
  food: '/assets/food.png',
  shopping: '/assets/shopping.png',
  culture: '/assets/hobby.png',
  etc: '/assets/etc.png',

  // 고정 지출
  fixedCostSubscription: '/assets/subscription.png',
  fixedCostHousing: '/assets/home.png',
  fixedCostTransport: null,
  fixedCostTelecom: null,
  fixedCostInsurance: null,
  fixedCostLoanInterest: null,
}

// 표에 없거나 아직 아이콘이 없는 카테고리는 null → 화면이 기본 점을 그린다
export const iconOf = (key) => CATEGORY_ICON[key] ?? null


/* ---------- 절감률 ---------- */

/* 각 항목에서 몇 %를 아낄 수 있다고 볼 것인가.

   20% 로 잡은 이유 —
     50% 는 "배달을 절반으로 줄이세요" 라 현실성이 없고,
     10% 는 월 3만원 쓰는 항목에서 3천원이라 화면에 띄울 의미가 없다.
     20% 면 배달 5번 → 4번, 커피 10잔 → 8잔 정도라 한 달 안에 실행 가능하다.

   ★ 통계에 근거한 값이 아니라 '실행 가능성' 기준으로 정한 값이다.
     팀에서 다른 기준(예: 또래 평균 대비 초과분)을 정하면 이 숫자만 바꾸면 된다. */
export const SAVING_RATE = 0.2

// 이 금액보다 적게 아껴지는 항목은 제안하지 않는다 (조언이 시시해짐)
const MIN_TIP_AMOUNT = 10000


/* ---------- 기본 계산 ---------- */

const num = (v) => Number(v ?? 0)

export const sumBy = (items, data) =>
  data ? items.reduce((s, i) => s + num(data[i.key]), 0) : 0

// 월 총지출 = 줄일 수 있는 것 + 못 줄이는 것
export const totalSpending = (data) =>
  data ? sumBy(FLEXIBLE_COST, data) + sumBy(RIGID_COST, data) : 0

// 자산 합계 (부채 빼기 전)
export const totalAsset = (data) => sumBy(ASSET_ITEMS, data)

// 남은 상환액
export const totalDebt = (data) => (data ? num(data[DEBT_KEY]) : 0)

// 순자산 = 자산 − 남은 상환액
export const netAsset = (data) => totalAsset(data) - totalDebt(data)

// 월 저축 여력 = 소득 − 지출. 마이너스면 0 으로 본다
export const savingCapacity = (data, income) =>
  Math.max(num(income) - totalSpending(data), 0)


/* ---------- 서버 순자산 보정 (임시) ---------- */

/* [왜 필요한가]
   서버 ForecastService.calculateCurrentAsset() 이
     예금 + 적금 + 투자 − 대출 총액 − 남은 상환액
   으로 계산하고 있다. 대출 총액 2,000만원 중 1,500만원이 남았다면
   실제 빚은 1,500만원인데 3,500만원을 뺀다. 같은 빚을 두 번 빼는 것이다.

   그 결과 화면끼리 숫자가 어긋난다.
     마이데이터 관리 : 순자산 +3,000,000원  (프론트 계산 — 맞음)
     자취 시뮬레이션 : 순자산 −17,000,000원 (서버 값 — 틀림)
   게다가 자취 가능 시점도 3년 4개월로 늘어난다 (실제로는 1년 안쪽).

   [어떻게 보정하나]
   서버 값이 '이중 차감한 값과 정확히 같을 때만' 순자산을 다시 계산한다.
   백엔드가 고치면 이 조건이 더 이상 성립하지 않아 보정이 저절로 꺼진다.
   그래서 나중에 이 코드를 지우는 걸 잊어도 숫자가 틀어지지 않는다.

   ★ 백엔드 수정 요청은 BACKEND_REQUEST_2D.md 5번(우선순위 1)에 적어뒀다.
     수정이 반영되면 이 함수와 호출부를 지우면 된다. */

export function fixForecast(forecast, data) {
  if (!forecast || !data) return forecast

  const asset = totalAsset(data)
  const remaining = num(data[DEBT_KEY])
  const loan = num(data.assetLoan)

  // 서버가 이중 차감했을 때 나오는 값
  const doubleCounted = asset - loan - remaining
  if (Math.abs(num(forecast.currentAsset) - doubleCounted) > 1) return forecast
  if (loan === 0) return forecast // 뺄 게 없으면 어차피 같은 값

  const net = asset - remaining
  const required = num(forecast.requiredAmount)
  const capacity = num(forecast.monthlySavingCapacity)

  // 개월 수도 다시 계산한다. 서버와 같은 식(올림)을 써야 숫자가 어긋나지 않음
  let estimatedMonths = forecast.estimatedMonths
  let predictedStartDate = forecast.predictedStartDate

  if (net >= required) {
    estimatedMonths = 0
    predictedStartDate = isoDate(new Date())
  } else if (capacity > 0) {
    estimatedMonths = Math.ceil((required - net) / capacity)
    const now = new Date()
    // 서버는 LocalDate.now().plusMonths(n) — 일자는 그대로 두고 달만 더한다
    predictedStartDate = isoDate(
      new Date(now.getFullYear(), now.getMonth() + estimatedMonths, now.getDate()),
    )
  }

  return {
    ...forecast,
    currentAsset: net,
    estimatedMonths,
    predictedStartDate,
    isNetAssetCorrected: true, // 보정했다는 표시 (화면에는 안 씀, 확인용)
  }
}

const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`


/* ---------- 자금 현황 ---------- */

/* 진행률은 '순자산 ÷ 필요 금액'.
   서버의 currentAsset 과 같은 기준이라 자취 분석 결과와 어긋나지 않는다. */
/* loanAmount — 자금조달 설계에서 고른 대출 상품의 금액 (안 골랐으면 0).
   대출은 '모은 돈' 이 아니라 '빌린 돈' 이라 asset/net 에 섞지 않고 따로 센다.
   섞으면 카드가 '내가 다 모았다' 처럼 보인다 — 금융 화면에서 하면 안 되는 착시다.
   합쳐서 보는 값은 funded(마련한 금액) 하나로만 둔다. */
export function buildFundStatus(data, forecast, loanAmount = 0, policySupport = null) {
  if (!data || !forecast) return null

  const required = num(forecast.requiredAmount)
  const asset = totalAsset(data)
  const debt = totalDebt(data)
  const net = asset - debt
  const loan = Math.max(num(loanAmount), 0)

  /* 지원금도 자금원이다.

     [왜 뒤늦게 넣었나]
     자금조달 설계 화면은 대출 금액을 이렇게 잡는다.
        대출 = 필요 금액 − 자기자본 − 지원금
     즉 지원금만큼 대출을 이미 줄여놓는다. 그런데 홈이 지원금을 빼고
        남은 금액 = 필요 금액 − (자기자본 + 대출)
     로 계산하면, 두 화면이 정확히 지원금만큼 어긋난다.
     자금조달에서는 '다 채웠다' 고 했는데 홈은 아직 모자라다고 말하게 된다.

     [null 과 0 은 다르다]
     policySupport 가 null 이면 아직 정책 화면을 안 다녀온 것이고,
     0 이면 받을 수 있는 지원금이 없다고 확인한 것이다.
     null 을 0 으로 뭉개면 '지원금은 없다' 를 사실로 확정한 채 계산하게 되는데,
     하필 '더 모아야 한다' 쪽으로 틀리는 방향이라 화면이 알고 있어야 한다. */
  const supportKnown = policySupport != null
  const support = Math.max(num(policySupport), 0)

  const funded = net + loan + support
  const remaining = Math.max(required - funded, 0)

  /* 마련한 돈이 어디서 왔는지 — 예금·적금·투자에 이번에 고른 대출까지 더한다.
     대출을 빼놓으면 '앞으로 모아야 할 금액' 이 줄어든 이유가 화면 어디에도 없다.

     여기 합계(sourceTotal)는 funded 와 다르다. 기존 대출 잔액을 아직 안 뺐기 때문.
        예금+적금+투자+새 대출  =  sourceTotal
        − 기존 대출 잔액(debt)  =  funded (= 실제로 쓸 수 있는 돈)
     막대는 음수를 그릴 수 없어서, 빼는 줄은 카드에 글로 따로 적는다. */
  const sources = [
    ...ASSET_ITEMS.map((item) => ({
      label: item.label,
      color: item.color,
      amount: num(data[item.key]),
    })),
    /* 지원금도 실제로 쓸 수 있는 돈이라 구성에 넣는다 (0원이면 줄을 만들지 않는다).
       색은 적금(#FFD466)과 겹치지 않게 kb-yellowDark 를 쓴다 —
       같은 막대 안에 같은 색이 두 번 나오면 어느 조각이 무엇인지 알 수 없다 */
    ...(support > 0 ? [{ label: '지원금', color: '#EDAE00', amount: support }] : []),
    ...(loan > 0 ? [{ label: '대출', color: '#60584C', amount: loan }] : []),
  ]
  const sourceTotal = sources.reduce((sum, item) => sum + item.amount, 0)
  const breakdown = sources.map((item) => ({
    ...item,
    ratio: (item.amount / (sourceTotal || 1)) * 100,
  }))

  const pct = (v) => (required > 0 ? Math.min(Math.round((v / required) * 100), 100) : 0)

  return {
    required,
    asset,
    debt,
    net,
    loan,
    support,
    supportKnown,
    funded,
    remaining,
    sourceTotal,
    /* progress   내 돈만으로 얼마나 왔나 (도넛의 노란 조각)
       loanShare  대출이 메우는 몫      (도넛의 브라운 조각)
       progressWithLoan  둘을 합친 값. 100 을 넘지 않게 자른다 */
    progress: pct(net),
    supportShare: Math.max(pct(net + support) - pct(net), 0),
    loanShare: Math.max(pct(funded) - pct(net + support), 0),
    progressWithLoan: pct(funded),
    breakdown,
  }
}


/* ---------- 절약 인사이트 (AI 아님 — 계산 결과) ---------- */

/* [계산 규칙]

   1) 줄일 수 있는 항목(FLEXIBLE_COST)만 후보로 둔다
   2) 각 항목의 20% 를 절감 가능액으로 본다
   3) 1만원 미만은 버리고, 큰 순으로 최대 3개를 고른다
   4) 절감액을 저축에 더하면 몇 개월 빨라지는지 계산한다

        새 저축여력 = 기존 저축여력 + 절감액 합계
        새 개월수   = ceil((필요금액 − 순자산) ÷ 새 저축여력)
        단축 개월   = 기존 개월수 − 새 개월수

   서버의 estimatedMonths 와 같은 식(올림)을 써서 두 숫자가 어긋나지 않게 했다. */

export function buildInsight(data, income, forecast) {
  if (!data) return null

  /* 아이콘은 CATEGORY_ICON 표에서 찾는다.
     나중에 AI 가 만든 팁으로 바뀌어도 서버가 준 카테고리 키만 iconOf() 에 넣으면
     같은 규칙으로 아이콘이 붙는다 */
  const tips = FLEXIBLE_COST
    .map((item) => ({
      key: item.key,
      label: tipLabelOf(item.label), // "식비 줄이기"
      category: item.label,
      icon: iconOf(item.key),
      spent: num(data[item.key]),
      amount: Math.floor((num(data[item.key]) * SAVING_RATE) / 1000) * 1000, // 천원 단위 반올림
    }))
    .filter((t) => t.amount >= MIN_TIP_AMOUNT)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)

  if (tips.length === 0) return null

  const totalSave = tips.reduce((s, t) => s + t.amount, 0)

  /* 몇 개월 단축되는지 — 분석 결과가 있어야 계산 가능

     [두 개를 따로 계산한다]
       topShortenMonths : 1등 항목 하나만 아꼈을 때   → "식비를 7만원 아끼면 …" 문장용
       shortenMonths    : 팁 3개를 모두 실천했을 때   → "합계" 줄에 쓰는 값

     전에는 문장은 식비 하나를 말하면서 개월 수는 3개 합계로 계산해 과장돼 보였다.
     같은 문장 안의 금액과 개월 수는 반드시 같은 금액에서 나와야 한다. */
  let shortenMonths = null
  let topShortenMonths = null

  if (forecast && forecast.estimatedMonths != null && income > 0) {
    /* [기준을 맞추는 것도 중요하다]
       forecast.estimatedMonths 는 basisAmount(저축 여력 또는 내 목표) 로 계산된 값이라,
       절감 효과도 같은 금액에 더해야 한다. 다른 기준끼리 빼면 값이 폭주한다. */
    const base = num(forecast.basisAmount) || savingCapacity(data, income)
    const remaining = Math.max(num(forecast.requiredAmount) - num(forecast.currentAsset), 0)

    if (base > 0 && remaining > 0) {
      const monthsWith = (extra) =>
        Math.max(forecast.estimatedMonths - Math.ceil(remaining / (base + extra)), 0)

      shortenMonths = monthsWith(totalSave)
      topShortenMonths = monthsWith(tips[0].amount)
    }
  }

  return {
    tips,
    totalSave,
    shortenMonths, // 팁 3개를 다 실천했을 때
    topShortenMonths, // 1등 항목만 아꼈을 때 (null 이면 문구를 숨김)
    top: tips[0],
  }
}


/* ---------- 월 저축 목표 ---------- */

/* 목표 금액을 정했을 때 자취 시점이 어떻게 되는지 계산한다.

   [저축 여력과 저축 목표는 다른 값이다]
     저축 여력 = 소득 − 지출        → 산술적으로 가능한 최대치
     저축 목표 = 사용자가 정한 금액  → 실제로 모으기로 한 금액

   여력이 72만원이어도 예상 못 한 지출을 감안해 60만원만 목표로 잡을 수 있다.
   반대로 여력보다 높게 잡으면 소비를 줄여야 달성되는 목표가 된다.
   그래서 둘을 나눠 두고, 목표가 여력을 넘으면 얼마를 더 줄여야 하는지 알려준다.

   개월 수는 서버 estimatedMonths 와 같은 식(올림)을 쓴다. */

/* 저축 여력을 못 구했을 때 소득의 몇 %로 잡는지.
   서버 ForecastService.SAVING_FALLBACK_RATE 와 같은 값이어야 한다 */
const SAVING_FALLBACK_RATE = 0.2

/* 지금 값으로 저축 여력을 다시 계산한다.

   서버 ForecastService 와 같은 규칙이다 — 지출 항목 10개도 같고, 소득보다 지출이 크면
   소득의 20% 로 대신하는 것도 같다. 규칙이 같아야 "값이 다르면 입력이 바뀐 것" 이라고
   말할 수 있다. 다르게 계산하면 늘 다른 값이 나와서 판단에 쓸 수 없다.

   ★ 이 값을 화면의 저축 여력으로 쓰지는 않는다. 표시는 서버가 준 값 그대로 두고,
     여기서 구한 값은 '어긋났는지' 를 판단하는 데만 쓴다. */
export function expectedCapacity(mydata, income) {
  const raw = num(income) - totalSpending(mydata)
  return raw < 0 ? Math.floor(num(income) * SAVING_FALLBACK_RATE) : raw
}

/* 분석한 뒤에 소득(또는 지출)이 바뀌어서 저축 여력이 옛날 값인지 알려준다.

   [왜 필요한가]
   저축 여력(monthlySavingCapacity)은 분석 시점의 소득으로 서버가 계산한 값이다.
   마이데이터 관리에서 소득만 고치면 이 값은 그대로 남아서, 화면은 옛 소득 기준
   금액을 계속 보여준다. 숫자가 안 바뀌는 것 자체보다, 화면이 그걸 '지금 소득' 이라고
   말하는 게 문제다. 사용자는 자기가 방금 고친 값이 반영된 줄 안다.

   [두 가지 방법으로 알아낸다]
     ① incomeAtAnalysis 가 있으면 그걸로 바로 비교한다 (2026-08-02 이후 분석분)
     ② 없으면 지금 값으로 같은 식을 다시 돌려 저장된 값과 비교한다
        — 그전에 분석해둔 데이터도 알아채야 해서 필요하다

   여기서는 판단만 하고 고치지는 않는다. 프론트가 임의로 다시 계산해 화면에 쓰면
   서버가 준 숫자와 어긋난다. 다시 분석하라고 안내하는 것이 맞다.

   @returns 어긋났으면 { before, now, expected }, 아니면 null
            before 는 분석 당시 소득. 알 수 없으면 null */
export function incomeChangedSinceAnalysis({ forecast, mydata, incomeAtAnalysis, monthlyIncome }) {
  // 마이데이터가 없으면 지출을 몰라서 다시 계산할 수 없다
  if (!forecast || !mydata) return null

  const now = num(monthlyIncome)
  if (now <= 0) return null

  const stored = num(forecast.monthlySavingCapacity)
  if (stored <= 0) return null

  const expected = expectedCapacity(mydata, now)
  const before = num(incomeAtAnalysis)

  // ① 분석 당시 소득이 남아 있는 경우
  if (before > 0) {
    return before === now ? null : { before, now, expected }
  }

  /* ② 옛 데이터 — 값이 다르면 입력이 바뀐 것이다.
     1,000원 미만 차이는 서버의 소수점 절삭 정도라 보고 넘어간다. */
  if (Math.abs(expected - stored) < 1000) return null
  return { before: null, now, expected }
}

export function buildGoalPlan({ forecast, mydata, income, goal }) {
  const capacity = forecast?.monthlySavingCapacity ?? savingCapacity(mydata, income)
  const required = num(forecast?.requiredAmount)
  const net = num(forecast?.currentAsset)
  const remaining = Math.max(required - net, 0)

  const monthsAt = (perMonth) =>
    perMonth > 0 && remaining > 0 ? Math.ceil(remaining / perMonth) : null

  const goalAmount = num(goal)
  const baseMonths = forecast?.estimatedMonths ?? monthsAt(capacity)
  const goalMonths = monthsAt(goalAmount)

  return {
    capacity,
    remaining,
    hasForecast: Boolean(forecast),
    goal: goalAmount || null,
    baseMonths,
    goalMonths,
    // 목표대로 모으면 몇 개월 빨라지는지 (음수면 오히려 늦어짐)
    diffMonths: baseMonths != null && goalMonths != null ? baseMonths - goalMonths : null,
    // 목표가 여력보다 크면 그 차액만큼 소비를 줄여야 한다
    overCapacity: goalAmount > capacity ? goalAmount - capacity : 0,
  }
}

/* 월 저축 목표를 정했으면, 그 금액 기준으로 자취 시점을 다시 계산한다.

   [왜 필요한가]
   서버의 estimatedMonths 는 monthlySavingCapacity(소득 − 지출) 로 계산된 값이다.
   즉 '한 달 지출을 전부 저축했을 때' 라서, 사용자가 목표를 54만원으로 정해도
   홈은 계속 72만원 기준 시점을 보여준다. 목표를 정한 의미가 없어진다.

   필요한 값(필요 금액·순자산·목표액)이 전부 프론트에 있어서 여기서 다시 계산한다.
   서버 요청이 필요한 일이 아니다.

   계산식은 서버와 동일(올림)하게 맞춰서 두 숫자가 어긋나지 않게 했다.
   basis 로 '무엇을 기준으로 한 값인지' 를 함께 돌려주고, 화면은 그 값으로 문구를 고른다. */

export function applyGoalToForecast(forecast, savingGoal) {
  if (!forecast) return null

  const capacity = num(forecast.monthlySavingCapacity)
  const goal = num(savingGoal)

  /* 목표가 없거나, 여력과 같거나, 지나치게 작으면 서버 값을 그대로 쓴다.

     1만원 미만을 걸러내는 이유 — 실수로 자릿수를 덜 친 값(예: 1,200원)이 저장돼 있으면
     도달까지 71만 개월 같은 숫자가 나와 홈 화면 전체가 망가진다.
     입력 화면에서도 막지만, 이미 저장된 값이 남아 있을 수 있어 여기서 한 번 더 막는다. */
  if (goal < 10000 || goal === capacity) {
    return { ...forecast, basis: 'capacity', basisAmount: capacity }
  }

  const remaining = Math.max(num(forecast.requiredAmount) - num(forecast.currentAsset), 0)

  let estimatedMonths = 0
  let predictedStartDate = isoDate(new Date())

  if (remaining > 0) {
    estimatedMonths = Math.ceil(remaining / goal)
    const now = new Date()
    predictedStartDate = isoDate(
      new Date(now.getFullYear(), now.getMonth() + estimatedMonths, now.getDate()),
    )
  }

  return {
    ...forecast,
    estimatedMonths,
    predictedStartDate,
    basis: 'goal',
    basisAmount: goal,
  }
}


/* 목표 금액 추천 3가지.
   빈 칸에 숫자를 직접 적게 하면 대부분 막막해한다. 기준점을 주고 고치게 하는 게 쉽다.

   [비율을 화면에 같이 보여주는 이유]
   금액만 보면 57만원이 큰 건지 작은 건지 알 수 없다.
   '저축 여력의 75%' 라고 적어야 내가 얼마나 빡빡하게 잡는 건지 감이 온다.

   50 / 75 / 100 은 근거 있는 통계값이 아니라 '고르기 쉬운 눈금' 이다.
   100% 는 소득에서 지출을 뺀 전부라 더 올릴 수 없는 상한이라서 마지막에 뒀다.
   1만원 단위로 내림해 숫자가 지저분해지지 않게 했다. */
export function goalPresets(capacity) {
  const round = (v) => Math.floor(v / 10000) * 10000
  return [
    { label: '여유 있게', percent: 50, amount: round(capacity * 0.5) },
    { label: '적당히', percent: 75, amount: round(capacity * 0.75) },
    { label: '바짝 모으기', percent: 100, amount: round(capacity) },
  ].filter((p) => p.amount >= 10000)
}


/* ---------- 추천 판단 (AI 붙기 전 임시) ---------- */

/* [여기 있는 함수들의 성격]
   서버에 GPT 가 붙기 전까지 화면을 채우기 위한 '조건 판단' 이다.
   AI 라고 부르지 않는다. 화면에도 '조건 기반 추천' 으로 표기한다.

   서버가 { source: 'ai', headline, reasons, alternative } 를 주기 시작하면
   그 값을 그대로 쓰고 이 함수들은 지우면 된다. */

/* 정책 여러 건 중 무엇을 먼저 신청할지.

   판단 기준 (위에서부터)
     1. status 가 '신청 가능' 인 것 우선   — 조건 확인이 필요한 건 나중
     2. 신청 링크가 있는 것 우선           — 링크가 없으면 당장 신청할 수 없음
     3. 목록 순서                          — 서버가 준 순서를 존중

   ★ 정책 조건문(ageInfo, summary)은 비정형 한글이라 규칙으로 못 읽는다.
     "만 19세~34세 이하 무주택 세대주로서 연소득 5천만원 이하" 같은 문장에서
     조건을 뽑아 내 상황과 대조하는 건 LLM 이 필요한 일이다.
     여기가 AI 를 붙였을 때 가장 크게 좋아지는 부분. */

export function pickPolicy(policies = [], { age, income, region } = {}) {
  if (!policies.length) return null

  /* 2026-08-01 응답 개편 : policyName → name, eligibility → supportNote,
     supportAmount(지원 금액) 추가. 금액이 큰 정책을 먼저 보여주는 게 도움이 된다 */
  const score = (p) =>
    (p.status === '신청 가능' ? 4 : 0) + (p.link ? 1 : 0) + (p.supportAmount > 0 ? 2 : 0)

  const best = [...policies].sort((a, b) => score(b) - score(a))[0]
  const others = policies.filter((p) => p !== best)

  const reasons = []
  if (age != null) reasons.push({ label: '나이', value: `만 ${age}세` })
  if (income > 0) reasons.push({ label: '월 소득', value: won(income) })
  if (region) reasons.push({ label: '거주 지역', value: region })
  if (best.supportAmount > 0) {
    reasons.push({ label: '예상 지원 금액', value: won(best.supportAmount), note: best.supportNote })
  } else if (best.supportNote) {
    reasons.push({ label: '지원 내용', value: best.supportNote })
  }
  if (best.status) reasons.push({ label: '신청 상태', value: best.status })

  return {
    source: 'rule',
    count: policies.length,
    headline: `${best.name}${best.status === '신청 가능' ? '을 먼저 확인해보세요' : '부터 조건을 확인해보세요'}`,
    reasons,
    alternative:
      others.length > 0
        ? `${others.map((p) => p.name).join(' · ')} 도 함께 볼 수 있어요. 조건 확인이 필요한 정책은 신청 페이지에서 자세한 기준을 확인해주세요.`
        : null,
  }
}

/* 자금조달 — 지금 상황에서 무엇부터 해야 하는지.
   대출 상품 목록이 아직 없어서, '무엇을 먼저 채울지' 를 알려준다. */

export function pickFunding({ required, own, support, loan, dsr, monthsToGoal }) {
  const gap = num(required) - (num(own) + num(support) + num(loan))
  if (num(required) <= 0) return null

  const reasons = [
    { label: '필요 초기자금', value: won(required) },
    { label: '지금 모은 금액', value: won(own), note: `필요 자금의 ${Math.round((num(own) / num(required)) * 100)}%` },
  ]
  if (dsr != null) reasons.push({ label: '현재 DSR', value: `${dsr}%`, note: dsr <= 40 ? '규제 한도 이내' : '규제 한도 초과' })

  if (gap <= 0) {
    return {
      source: 'rule',
      headline: '필요한 자금을 모두 마련했어요',
      reasons,
      alternative: '계약 전 보증금 보호(전세보증보험)와 확정일자 일정을 함께 확인해보세요.',
    }
  }

  return {
    source: 'rule',
    headline: `${won(gap)}을 더 마련해야 해요`,
    reasons,
    alternative:
      num(support) === 0
        ? '지원금은 갚지 않아도 되는 돈이라 대출보다 먼저 알아보는 게 유리해요. 맞춤 정책·지원금에서 받을 수 있는 금액을 확인해보세요.'
        : '남은 금액은 저축과 대출로 나눠 채울 수 있어요. 대출은 DSR 한도를 넘지 않는 선에서 잡아주세요.',
  }
}

/* 저축 플랜 — 목표를 어떻게 잡을지. */

export function pickSaving({ capacity, goal, baseMonths, goalMonths, overCapacity }) {
  if (num(capacity) <= 0) return null

  const reasons = [
    { label: '월 저축 여력', value: won(capacity), note: '소득 − 지출' },
  ]
  if (num(goal) > 0) reasons.push({ label: '내 목표', value: won(goal) })
  if (goalMonths != null) reasons.push({ label: '목표대로 저축 시', value: `${goalMonths}개월 뒤` })

  if (!num(goal)) {
    const suggested = Math.floor((capacity * 0.75) / 10000) * 10000
    return {
      source: 'rule',
      count: 3,
      headline: `월 ${won(suggested)}부터 시작해보세요`,
      reasons,
      alternative:
        '저축 여력의 75% 정도로 잡으면 예상 못 한 지출이 생겨도 목표를 지키기 쉬워요. 여력을 전부 목표로 잡으면 한 달만 어긋나도 계획이 밀려요.',
    }
  }

  if (num(overCapacity) > 0) {
    return {
      source: 'rule',
      headline: `목표를 지키려면 매달 ${won(overCapacity)}을 더 아껴야 해요`,
      reasons,
      alternative: '줄이기 어려우면 목표를 저축 여력 안쪽으로 낮추는 것도 방법이에요. 못 지킨 목표는 안 세운 것과 같아요.',
    }
  }

  const slack = num(capacity) - num(goal)
  return {
    source: 'rule',
    headline: '지금 목표는 지킬 수 있는 수준이에요',
    reasons,
    alternative:
      slack > 0
        ? `여력이 ${won(slack)} 남아요. 더 빨리 모으고 싶다면 목표를 조금 올려도 괜찮아요.`
        : '저축 여력을 전부 쓰는 목표라 예상 못 한 지출이 생기면 밀릴 수 있어요.',
  }
}


/* ---------- 오늘의 체크리스트 ---------- */

/* 실제 진행 상태에서 만들어낸다. 하드코딩된 목록이 아니라
   사용자가 어디까지 했는지가 그대로 보이게 함 */

/* [완료 판정 기준]

   앞의 세 개는 '결과 데이터가 남았는지' 로 판단한다.
   버튼을 눌렀는지가 아니라 실제로 값이 들어왔는지를 보는 것이라,
   새로고침하거나 다른 화면을 거쳐도 판정이 흔들리지 않는다.

   정책은 조회해도 남는 데이터가 없어서 store 의 checks 에 표시해둔다.
   (Policy.jsx 가 조회에 성공했을 때 markCheck('policy') 를 부른다)

   자금조달 설계는 화면이 아직 없어서 '준비 중' 으로 둔다.
   할 수 없는 일을 '대기' 라고 적어두면 사용자는 자기가 안 한 줄 알고 계속 찾게 된다.

   target 은 그 항목을 완료하려면 어디로 가야 하는지 — 홈에서 눌러 바로 이동한다. */

export function buildChecklist({ mydata, monthlyIncome, forecast, savingGoal, checks = {} }) {
  return [
    { label: '마이데이터 연결', state: mydata ? '완료' : '대기', target: '마이데이터 관리' },
    { label: '월 소득 입력', state: monthlyIncome > 0 ? '완료' : '대기', target: '마이데이터 관리' },
    { label: '자취 시뮬레이션 실행', state: forecast ? '완료' : '대기', target: '자취 시뮬레이션' },
    { label: '월 저축 목표 설정', state: savingGoal > 0 ? '완료' : '대기', target: '저축 플랜 추천' },
    { label: '정책·지원금 확인', state: checks.policy ? '완료' : '대기', target: '맞춤 정책·지원금' },
  ]
}


/* ---------- 저축 추이 그래프 ---------- */

/* 서버가 월별 누적 데이터를 주지 않는다.
   다만 '매달 같은 금액을 저축한다'는 전제라면 누적액은 직선으로 늘어난다.
   그 전제 그대로 5개 점을 만들어 형태만 보여준다.
   실제 데이터가 오면 이 함수를 지우고 서버 값을 그대로 넣으면 됨. */

export function buildTrend(startPercent = 0, endPercent = 100) {
  const steps = 5
  return Array.from({ length: steps }, (_, i) =>
    Math.round(startPercent + ((endPercent - startPercent) * (i + 1)) / steps),
  )
}


/* ---------- 표시용 ---------- */

export const won = (n) => `${num(n).toLocaleString('ko-KR')}원`

/* 좁은 자리(도넛 가운데 등)에 넣는 짧은 금액 표기.
   11,072,000원 은 13글자라 도넛 안쪽 구멍(지름 약 124px)을 넘어서 링 위로 삐져나온다.
   만원 단위로 줄이면 1,107만원 = 8글자로 줄어 안에 들어간다.

     11_072_000 → "1,107만원"      1만원 미만은 버림 (도넛 안에서 볼 값이 아님)
      8_000_000 → "800만원"
          5_000 → "5,000원"        1만원 미만이면 그냥 원 단위로 적는다   */
export const wonShort = (n) => {
  const v = num(n)
  if (v < 10000) return won(v)
  return `${Math.floor(v / 10000).toLocaleString('ko-KR')}만원`
}

// 427 → '35년 7개월'
export function monthsText(months) {
  if (months == null) return null
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}개월`
  if (m === 0) return `${y}년`
  return `${y}년 ${m}개월`
}

// '2062-02-28' → '2062년 02월'
export function yearMonth(iso) {
  if (!iso) return null
  const [y, m] = iso.split('-')
  return `${y}년 ${m}월`
}

// ISO 문자열 → '2026.07.31'
export function dotDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}.${mm}.${dd}`
}
