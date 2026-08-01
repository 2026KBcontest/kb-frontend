# Perplexity API 연동 가이드

독립만세팀 / KB AI Challenge 2026
작성 : 프론트엔드 (D3)  ·  구현 담당 : 백엔드 (D1 / D2)

---

## 0. 한 줄 요약

**숫자는 우리가 계산하고, Perplexity 는 "고르기 + 설명하기"만 시킨다.**

정책 목록·상품 목록·시뮬레이션 결과는 이미 우리 DB 에 있다.
그걸 프롬프트에 넣어주고, Perplexity 는 그 안에서만 답하게 만든다.
이걸 **grounded generation(근거 기반 생성)** 이라고 부르고, 금융 서비스에서
"AI 가 숫자를 지어내는" 사고를 막는 표준적인 방법이다.

> ❌ "27살 서울 사는 사람한테 맞는 정책 알려줘"  → 존재하지 않는 정책을 만들어냄
> ✅ "아래 4개 정책 중에서 골라. 목록에 없는 건 절대 말하지 마" → 안전

---

## 1. 왜 Perplexity 인가

| | OpenAI / Claude | **Perplexity Sonar** |
|---|---|---|
| 웹 검색 | 별도 구현 필요 | **API 자체에 내장** |
| 출처 | 없음 | **응답에 citations URL 포함** |
| 최신 정책 정보 | 학습 시점까지만 | 검색해서 가져옴 |
| 가격 (Sonar) | — | 입력·출력 각 $1 / 100만 토큰 + 요청당 $5~12 / 1,000건 |

우리 서비스는 **"2026년 지금 신청 가능한 청년 정책"** 을 다룬다.
온통청년 API 가 안 주는 정보(마감 임박, 최근 변경 사항)를 검색으로 보충할 수 있는 게
Perplexity 를 쓰는 진짜 이유다. 심사위원에게도 이 논리로 설명하면 된다.

---

## 2. 준비 (10분)

### 2-1. API 키 발급

1. https://www.perplexity.ai/settings/api 접속
2. **Generate API Key** → `pplx-xxxxxxxx...` 복사

> ✅ **우리 팀은 가입 크레딧 $10 을 이미 확보했다.** 추가 결제 없이 개발부터 시연까지
> 이 크레딧으로 끝낼 계획이다. 쓰는 법은 **6-4** 를 반드시 읽고 따를 것.
>
> 💡 잔액이 0 이면 키가 있어도 401 이 난다. 401 이 나면 먼저 잔액부터 확인.

### 2-2. 환경변수 등록 (PowerShell)

```powershell
# 이 세션에만
$env:PERPLEXITY_API_KEY="pplx-여기에키"

# 영구 (새 터미널에서도 유지 — 등록 후 터미널 재시작 필요)
setx PERPLEXITY_API_KEY "pplx-여기에키"
```

**키를 코드에 절대 적지 않는다.** 깃허브에 올라가면 자동 스캔 봇이 몇 분 안에 찾아내고,
Perplexity 가 키를 폐기한다. `application.properties` 에도 값을 직접 쓰지 말 것.

### 2-3. 호출 확인

```powershell
curl -X POST https://api.perplexity.ai/chat/completions `
  -H "Authorization: Bearer $env:PERPLEXITY_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{\"model\":\"sonar\",\"messages\":[{\"role\":\"user\",\"content\":\"안녕\"}]}'
```

응답이 오면 준비 끝. **엔드포인트는 OpenAI 와 완전히 같은 형식**이라
`chat/completions` 예제 코드를 거의 그대로 쓸 수 있다.

---

## 3. 전체 흐름

```
[프론트]                    [우리 백엔드]                  [Perplexity]
                                  |
POST /api/policy/recommend  →  ① DB 에서 정책 목록 조회
                               ② 사용자 정보 + 정책 목록으로
                                  프롬프트 조립
                               ③ 호출  ────────────────→  sonar
                               ④ JSON 파싱 ←──────────── {"pickId":..,"reasons":[..]}
                               ⑤ 목록에 없는 id 면 버림 (검증)
  ← policies[] + recommendation ⑥ 응답 조립
```

**핵심은 ⑤ 다.** AI 가 목록에 없는 id 를 답하면 그 응답을 버리고
지금처럼 규칙 기반 추천을 쓴다. 그래야 화면이 절대 안 깨진다.

---

## 4. 백엔드 구현

### 4-1. 설정

`application.properties`

```properties
perplexity.api.key=${PERPLEXITY_API_KEY}
perplexity.api.url=https://api.perplexity.ai/chat/completions
perplexity.model=sonar
perplexity.timeout-seconds=20
```

`build.gradle` — Spring Boot 4.x 는 `RestClient` 가 기본이라 추가 의존성이 필요 없다.

### 4-2. 클라이언트

`ai/client/PerplexityClient.java`

```java
@Component
@RequiredArgsConstructor
public class PerplexityClient {

    @Value("${perplexity.api.key}")   private String apiKey;
    @Value("${perplexity.api.url}")   private String apiUrl;
    @Value("${perplexity.model}")     private String model;

    private final ObjectMapper objectMapper;

    /**
     * system + user 프롬프트를 보내고 JSON 문자열을 돌려받는다.
     * 실패하면 null — 호출한 쪽에서 규칙 기반으로 넘어가면 된다.
     */
    public String ask(String systemPrompt, String userPrompt, Map<String, Object> jsonSchema) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("model", model);
            body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user",   "content", userPrompt)
            ));
            body.put("temperature", 0.2);          // 낮게 — 매번 답이 달라지면 시연이 불안하다
            body.put("max_tokens", 700);

            // 구조화 출력 : 정해진 JSON 모양으로만 답하게 강제한다
            if (jsonSchema != null) {
                body.put("response_format", Map.of(
                    "type", "json_schema",
                    "json_schema", Map.of("name", "kb_advice", "schema", jsonSchema)
                ));
            }

            RestClient client = RestClient.create();
            String raw = client.post()
                .uri(apiUrl)
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);

            // OpenAI 와 동일한 응답 구조
            return objectMapper.readTree(raw)
                .path("choices").get(0).path("message").path("content").asText();

        } catch (Exception e) {
            log.warn("Perplexity 호출 실패 — 규칙 기반으로 대체합니다", e);
            return null;   // ★ 예외를 위로 던지지 않는다
        }
    }
}
```

> ⚠️ **처음 쓰는 JSON 스키마는 준비에 10~30초 걸린다.** 두 번째 호출부터 빨라진다.
> 시연 직전에 한 번 호출해서 예열해두면 좋다.

### 4-3. 정책 추천에 붙이기

`policy/service/PolicyRecommendService.java`

```java
private static final String SYSTEM = """
    당신은 한국 청년 주거 금융 상담사입니다.
    아래 규칙을 반드시 지키세요.
    1. 반드시 [정책 목록] 안에서만 고르세요. 목록에 없는 정책을 만들어내지 마세요.
    2. 금액·기간·조건은 목록에 적힌 값을 그대로 쓰세요. 계산하거나 추정하지 마세요.
    3. 존댓말로, 한 문장은 40자 이내로 쓰세요.
    4. 확실하지 않으면 "확인이 필요해요" 라고 쓰세요.
    """;

public PolicyRecommendResponse recommend(User user) {
    List<YouthPolicy> policies = policyRepository.findMatching(...);   // 기존 로직 그대로

    String userPrompt = """
        [사용자]
        나이 만 %d세 / 월소득 %,d원 / 거주지 %s / 직업 %s

        [정책 목록]
        %s

        위 목록에서 이 사용자에게 가장 먼저 확인하라고 권할 정책 하나(pickId)와,
        그다음으로 볼 만한 정책 하나(altId)를 고르고 이유를 2~3개 적어주세요.
        """.formatted(age, income, region, job, toPromptTable(policies));

    String json = perplexityClient.ask(SYSTEM, userPrompt, ADVICE_SCHEMA);

    Recommendation rec = parseAndVerify(json, policies);   // ★ 검증
    return new PolicyRecommendResponse(policies, rec);
}
```

**정책 목록을 프롬프트에 넣는 모양** — 표 형태가 가장 잘 먹힌다.

```
id=P001 | 서울시 청년 월세 지원 | 지원 240만원(월20만×12) | 만19~39세, 중위소득150% 이하 | 신청 가능
id=P002 | 청년 전세보증금 대출   | 한도 2억원 금리 2.4%    | 만19~34세, 무주택          | 상시
```

**검증 코드** — 이게 없으면 연동하면 안 된다.

```java
private Recommendation parseAndVerify(String json, List<YouthPolicy> policies) {
    if (json == null) return null;                    // 호출 실패 → 규칙 기반
    try {
        JsonNode n = objectMapper.readTree(json);
        String pickId = n.path("pickId").asText();

        // ★ 목록에 없는 id 면 통째로 버린다 (환각 차단)
        boolean exists = policies.stream().anyMatch(p -> p.getId().equals(pickId));
        if (!exists) {
            log.warn("AI 가 목록에 없는 정책을 골랐습니다: {}", pickId);
            return null;
        }
        return new Recommendation("ai", pickId, headline, reasons, altId);
    } catch (Exception e) {
        return null;
    }
}
```

### 4-4. JSON 스키마

```java
private static final Map<String, Object> ADVICE_SCHEMA = Map.of(
    "type", "object",
    "properties", Map.of(
        "pickId",   Map.of("type", "string"),
        "headline", Map.of("type", "string", "maxLength", 60),
        "reasons",  Map.of("type", "array", "minItems", 2, "maxItems", 3,
                           "items", Map.of("type", "string", "maxLength", 60)),
        "altId",    Map.of("type", "string")
    ),
    "required", List.of("pickId", "headline", "reasons")
);
```

---

## 5. 프론트는 이미 준비돼 있다

**프론트에서 고칠 코드가 없다.** 지금 규칙 기반으로 채워둔 자리에
서버가 값을 넣어주면 그대로 표시된다.

### 5-1. 정책 화면 (`Policy.jsx`)

`POST /api/policy/recommend` 응답에 `recommendation` 을 추가하면 된다.

```json
{
  "policies": [ ... 지금과 동일 ... ],
  "recommendation": {
    "source": "ai",
    "pickId": "P001",
    "headline": "서울시 청년 월세 지원을 먼저 확인해보세요",
    "reasons": [
      "지금 소득이 신청 기준 안에 들어와요",
      "12개월 동안 240만원을 받을 수 있어요"
    ],
    "altId": "P002"
  }
}
```

`recommendation` 이 **없거나 null 이면** 프론트가 알아서 규칙 기반으로 표시한다.
즉 **백엔드가 붙기 전에도 화면은 정상**이고, 붙는 순간 배지가
`조건 기반` → `AI 분석` 으로 바뀐다.

### 5-2. 질문 답변 (`AiPick` 의 질문 칩)

`POST /api/ai/advice` 하나만 만들면 3개 화면(저축·자금조달·정책)이 동시에 살아난다.

**요청**

```json
{
  "scope": "funding",
  "question": "대출을 받는 게 나을까요, 더 모으는 게 나을까요?",
  "context": {
    "required": 256035810, "own": 3000000, "support": 2400000,
    "loan": 200000000, "dsr": 82.3, "monthlyPayment": 1976317
  }
}
```

`context` 는 **프론트가 이미 계산해서 보낸다.** 백엔드는 이 숫자를 그대로
프롬프트에 붙이기만 하면 된다 — 다시 계산하지 말 것.

**응답**

```json
{
  "source": "ai",
  "headline": "지금 조건이면 대출보다 저축을 먼저 늘리는 게 좋아요",
  "reasons": [
    "DSR 82%는 규제선 40%를 크게 넘어 승인이 어려워요",
    "지원금을 먼저 받으면 필요한 대출이 줄어들어요"
  ],
  "alternative": "6개월 더 모으면 DSR이 40%대로 내려와요",
  "citations": ["https://..."]
}
```

`scope` 값은 `saving` / `funding` / `policy` 세 가지다.
scope 별로 system 프롬프트만 다르게 두면 된다.

### 5-3. 지금 프론트 상태

| 화면 | AI 어드바이스 칸 | 지금 표시 | API 붙으면 |
|---|---|---|---|
| 맞춤 정책·지원금 | O | 조건 기반 배지 | AI 분석 배지 + AI 문장 |
| 저축 플랜 추천 | O | 조건 기반 배지 | 위와 같음 |
| 자금조달 설계 | O | 조건 기반 배지 | 위와 같음 |

질문 칩을 누르면 지금은 `AI_NOT_READY` 안내가 뜬다.
`/api/ai/advice` 가 200 을 주는 순간 그 자리에 답변이 뜬다.

---

## 6. 반드시 지킬 것 (심사에서 갈리는 부분)

### 6-1. 숫자는 AI 에게 시키지 않는다

DSR, 월 상환액, 필요 자금, 도달 개월 수는 **전부 서버·프론트가 계산한 값**이다.
AI 에게는 "이 숫자를 보고 뭘 먼저 하면 좋을지 골라라" 만 시킨다.
LLM 은 산수를 틀린다. 금융 서비스에서 틀린 숫자는 그 자체로 탈락 사유다.

### 6-2. AI 가 죽어도 화면은 산다

```
Perplexity 실패 → null 반환 → 규칙 기반 추천 표시 → 사용자는 아무 문제 못 느낌
```

시연 도중 API 가 느리거나 크레딧이 떨어져도 화면이 멀쩡해야 한다.
**타임아웃 20초, 실패 시 예외를 던지지 말 것.**

### 6-3. 출처를 보여준다

Perplexity 응답의 `citations` 배열을 그대로 내려주면
"AI 가 어디서 본 정보인지" 를 화면에 링크로 붙일 수 있다.
이건 다른 팀이 잘 안 하는 부분이라 차별점이 된다.
(프론트 표시 자리는 만들어둘 수 있으니 붙일 거면 말해주세요)

### 6-4. $10 크레딧으로 시연까지 버티기

**결론부터 : 아래 4개만 지키면 $10 로 충분히 남습니다.**

#### 호출 1회 비용 계산

| 항목 | 값 |
|---|---|
| 요청 수수료 (Sonar, **low** context) | $0.005 |
| 입력 토큰 (프롬프트 약 1,500) | $0.0015 |
| 출력 토큰 (약 300) | $0.0003 |
| **합계** | **약 $0.0068 ≈ 10원** |

→ **$10 ÷ $0.0068 ≈ 1,470회**
개발·테스트·시연을 다 합쳐도 이 숫자를 넘기기 어렵습니다.

**단, 이건 low context 기준입니다.** high 로 올리면 요청 수수료가 $0.012 로 2배 이상
뛰어서 800회로 줄어듭니다. 우리는 정책 목록을 직접 프롬프트에 넣어주기 때문에
**웹 검색을 많이 할 이유가 없습니다.**

#### ① search_context_size 를 low 로 고정

`PerplexityClient.ask()` 의 body 에 한 줄 추가.

```java
body.put("web_search_options", Map.of("search_context_size", "low"));
```

기본값이 low 이긴 하지만, 명시해두면 나중에 누가 실수로 올리는 걸 막을 수 있습니다.

#### ② 캐시 — 이게 가장 크게 아낍니다

정책 추천은 **사용자 정보가 안 바뀌면 답도 안 바뀝니다.**
그런데 지금 프론트는 정책 화면을 열 때마다 `/api/policy/recommend` 를 부릅니다.
캐시가 없으면 화면을 10번 들락거릴 때 10번 과금됩니다.

```java
@Component
public class AiCache {
    private record Entry(String value, long expireAt) {}
    private final Map<String, Entry> map = new ConcurrentHashMap<>();

    public String get(String key) {
        Entry e = map.get(key);
        if (e == null || e.expireAt() < System.currentTimeMillis()) return null;
        return e.value();
    }
    public void put(String key, String value) {
        map.put(key, new Entry(value, System.currentTimeMillis() + Duration.ofHours(6).toMillis()));
    }
}

// 사용
String key = userId + "|" + scope + "|" + DigestUtils.md5Hex(userPrompt);
String cached = aiCache.get(key);
if (cached != null) return parseAndVerify(cached, policies);   // 과금 0원
```

키에 **프롬프트 해시**를 넣는 게 핵심입니다. 소득이나 지역을 바꾸면
프롬프트가 달라져서 자동으로 새로 호출되고, 안 바뀌면 계속 캐시를 씁니다.
Redis 필요 없이 `ConcurrentHashMap` 으로 충분합니다.

**시연 중에는 캐시가 오히려 장점입니다** — 두 번째부터 즉시 뜨니까 화면이 빠릅니다.

#### ③ 하루 호출 상한 (가장 중요한 안전장치)

**$10 을 날리는 원인은 비싼 요금이 아니라 무한 루프입니다.**
`useEffect` 의존성 배열 실수 하나로 초당 수십 번 호출되면 몇 분 만에 크레딧이 사라집니다.

```java
@Component
public class AiBudgetGuard {
    private static final int DAILY_LIMIT = 300;      // 하루 최대 300회 = 약 $2
    private final AtomicInteger count = new AtomicInteger();
    private volatile LocalDate day = LocalDate.now();

    public synchronized boolean allow() {
        if (!day.equals(LocalDate.now())) { day = LocalDate.now(); count.set(0); }
        if (count.get() >= DAILY_LIMIT) {
            log.warn("AI 호출 하루 상한({}회) 도달 — 규칙 기반으로 대체합니다", DAILY_LIMIT);
            return false;
        }
        count.incrementAndGet();
        return true;
    }
}

// PerplexityClient.ask() 맨 앞
if (!budgetGuard.allow()) return null;   // → 규칙 기반 폴백, 화면은 정상
```

상한에 걸려도 **화면은 그대로 동작합니다.** 배지만 `조건 기반` 으로 돌아갈 뿐입니다.
이 두 가지(캐시 + 상한)를 넣으면 크레딧이 갑자기 사라지는 일은 구조적으로 불가능합니다.

#### ④ 개발 중에는 AI 를 끄고 짠다

UI 다듬는 동안 매번 진짜 호출을 할 이유가 없습니다.

```properties
# application.properties
perplexity.enabled=${AI_ENABLED:false}
```

```java
if (!enabled) return FIXED_SAMPLE_JSON;   // 미리 저장해둔 정상 응답 한 개
```

**진짜 호출은 (1) 기능 검증할 때 (2) 리허설 (3) 본 시연** — 이 세 번만 켜면 됩니다.
저장해둔 샘플 응답으로 개발하면 화면 확인이 오히려 빨라집니다.

#### 예상 사용량

| 단계 | 호출 수 | 비용 |
|---|---|---|
| 기능 개발·디버깅 | ~100회 | $0.7 |
| 팀 통합 테스트 | ~100회 | $0.7 |
| 리허설 2회 | ~60회 | $0.4 |
| 본 시연 | ~30회 | $0.2 |
| **합계** | **~290회** | **약 $2** |

$10 중 $8 가 남습니다. 넉넉합니다.

#### 크레딧 확인

https://www.perplexity.ai/settings/api 에서 남은 잔액과 사용 내역을 볼 수 있습니다.
**주 1회 확인**하고, 만료일이 있는지도 한 번 봐두세요
(무료 크레딧에 기한이 붙는 경우가 있습니다).

---

## 7. 작업 순서 (권장)

| 순서 | 할 일 | 담당 | 예상 |
|---|---|---|---|
| 1 | API 키 발급 + curl 로 응답 확인 | D1 | 10분 |
| 2 | `PerplexityClient` 작성 + 단위 테스트 | D1 | 1시간 |
| 3 | `/api/ai/advice` 엔드포인트 (scope 3종) | D1 | 2시간 |
| 4 | 정책 추천에 `recommendation` 추가 | D2 | 2시간 |
| 5 | **캐시 + 하루 상한 + 실패 시 폴백** (6-4) | D1 | 1시간 |
| 6 | 프론트와 붙여서 3개 화면 확인 | 전원 | 30분 |

**3번(`/api/ai/advice`)을 먼저 하면 3개 화면이 한 번에 살아난다.**
4번은 그다음이다.

---

## 8. 자주 나는 오류

| 증상 | 원인 | 해결 |
|---|---|---|
| 401 Unauthorized | 크레딧 미구매 | 결제수단 등록 후 크레딧 충전 |
| 400 Bad Request | `model` 이름 오타 | `sonar` (구 `llama-3.1-sonar-*` 는 폐기됨) |
| 첫 호출만 30초 | JSON 스키마 준비 시간 | 정상. 시연 전 예열 호출 |
| 답이 매번 다름 | temperature 높음 | `0.2` 이하로 |
| 없는 정책을 말함 | 검증 누락 | 4-3 의 `parseAndVerify` 필수 |
| 응답이 잘림 | `max_tokens` 부족 | 700 이상으로 |

---

## 9. 회의 때 정할 것

1. **`/api/ai/advice` 를 D1 이 맡을지 D2 가 맡을지** — 3개 화면이 여기 물려 있어 가장 급하다
2. **캐시 TTL** — 시연용이면 1시간, 실제 서비스면 10분
3. **citations 표시 여부** — 표시하기로 하면 프론트에 자리를 만든다
4. **API 키 공유 방법** — 깃허브에 올리지 않고 각자 `setx` 로 등록
5. **개발 중 `AI_ENABLED=false`** 로 두기로 합의 — 크레딧은 검증·리허설·시연에만 쓴다

---

## 참고

- 엔드포인트 : `POST https://api.perplexity.ai/chat/completions` (OpenAI 호환)
- 모델 : `sonar` (기본), `sonar-pro` (더 정확·비쌈)
- 문서 : https://docs.perplexity.ai
