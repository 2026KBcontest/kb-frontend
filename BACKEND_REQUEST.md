# 백엔드 요청사항 v2 — API 명세서 검토 결과 반영

작성 : 프론트엔드 담당

## 1. 최우선 — CORS 설정 (명세서에 없는 항목)

명세서에 "인증 없이 호출 가능 (CSRF 비활성화)"라고 되어 있는데, **CORS 는 별개 문제**입니다.
현재 `SecurityConfig` 에 CORS 설정이 전혀 없습니다.

프론트는 `http://localhost:5173`(Vite), 백엔드는 `http://localhost:8080` 입니다.
포트가 다르면 브라우저가 다른 출처로 판단해 응답을 막습니다.
**지금 상태로는 화면에서 호출하면 전부 실패합니다.**

이게 놓치기 쉬운 이유 — **Postman·curl 에서는 정상 동작합니다.** CORS 는 브라우저만 적용하는 규칙이라
서버 테스트를 다 통과해도 화면에서만 막힙니다.

`SecurityConfig.java` 에 추가 부탁드립니다.

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:5173"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

기존 필터체인에 한 줄 추가:

```java
http
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))   // ← 추가
    .csrf(csrf -> csrf.disable())
    ...
```

---

## 2. 지금 확정해야 할 것 3가지

명세서와 프론트 화면이 서로 다른 값을 쓰고 있는 부분입니다.
**나중에 발견하면 양쪽 코드를 다 고쳐야 하니 지금 정하는 게 좋습니다.**

| 항목 | 명세서 | 프론트 현재 | 제안 |
|---|---|---|---|
| `income` / `asset` 단위 | 만원 (`200`, `1000`) | 원 (`2000000`) | **원으로 통일** |
| `birthDate` 형식 | `"19980101"` | `"2000-03-15"` | **`YYYY-MM-DD`** |
| 토큰 전달 방식 | 미정 | 미정 | **`Authorization: Bearer <token>`** |

**① 금액 단위 — 원으로 통일 요청**

홈화면은 모든 금액을 원 단위로 다룹니다 (목표 보증금 `30000000`, 모은 금액 `12400000`).
정책 API 만 만원이면 API 하나마다 단위를 기억해야 하고, **틀리면 100배 차이**가 나서
"소득 200만원"이 "소득 2억"으로 판정됩니다.

콤마 찍고 "만원"으로 바꿔 보여주는 건 프론트가 처리하니, 서버는 원 단위 숫자만 주시면 됩니다.

**② 생년월일 — `YYYY-MM-DD` 요청**

`"19980101"` 은 자바스크립트 `new Date()` 가 해석하지 못해서 프론트에서 잘라 붙여야 합니다.
`"1998-01-01"` 은 표준 형식이라 그대로 들어갑니다. DTO 타입이 `String` 이라 서버 코드 변경은 없을 겁니다.

**③ 토큰 — `Authorization: Bearer <token>` 으로 확정 요청**

명세서에 "Header에 첨부하는 로직은 아직 없습니다"라고 되어 있는데,
프론트는 로그인 성공 시 토큰을 저장하고 이후 요청에 붙이는 코드를 **지금 만들어야** 합니다.
나중에 방식이 바뀌면 모든 API 호출 코드를 고쳐야 하니, 형식만 먼저 정해주시면
서버 검증 로직은 나중에 붙어도 프론트는 그대로 갑니다.

---

## 3. 코드 수정 요청

### 3-1. 정책 추천 — 객체 1개 → 배열

현재 `PolicyResponse` 는 정책 하나만 담습니다.
홈화면의 `맞춤 정책·지원금` 카드와 정책 페이지는 **3~4개를 목록으로** 보여주는 구조라
지금 응답으로는 화면을 만들 수 없습니다.

```json
{
  "policies": [
    {
      "policyId": "jeonse-loan",
      "policyName": "청년 버팀목 전세자금대출",
      "description": "최대 1.2억원 대출 가능",
      "eligibility": "만 19~34세 / 연소득 5천만원 이하",
      "status": "신청 가능",
      "link": "https://nhuf.molit.go.kr/..."
    },
    {
      "policyId": "monthly-rent",
      "policyName": "서울시 청년 월세 지원",
      "description": "월 최대 20만원 × 12개월",
      "eligibility": "만 19~39세 / 중위소득 150% 이하",
      "status": "조건 확인 필요",
      "link": "https://youth.seoul.go.kr/..."
    }
  ],
  "aiReason": "현재 연령·소득·자취 목표를 고려하면 '청년 월세 지원'을 우선 신청하는 것이 유리합니다."
}
```

- `policyId` — 프론트 목록 렌더링 key. 고유한 문자열이면 아무거나 괜찮습니다
- `description` — 카드에 한 줄로 들어갑니다. **25자 이내**로 부탁드립니다
- `status` — **`"신청 가능"` / `"조건 확인 필요"` 두 값만** 사용합니다. 이 문자열이 그대로 뱃지로 표시됩니다
- `aiReason` — 정책 페이지의 `AI 추천 이유` 영역. 없으면 `null` 로 주시면 프론트가 영역을 숨깁니다

### 3-2. 미사용 요청 파라미터 3개 — 사용 예정인지 확인

`YouthPolicyClient` 를 보면 **`region` 과 `income` 만** 응답에 반영되고,
`job`·`birthDate`·`asset` 세 개는 받은 뒤 사용되지 않습니다.
`eligibility` 의 `"만 19세~34세"` 도 `birthDate` 와 무관한 고정 문자열입니다.

명세서에는 세 필드가 다 있어서, 프론트에서 입력 화면을 만들어야 하는지 판단이 안 됩니다.

- 앞으로 조건 판정에 쓸 예정이면 → 프론트가 입력 UI 만들겠습니다
- 쓰지 않을 거면 → 요청 필드에서 빼는 게 명세서가 깔끔합니다

### 3-3. 실패 응답 정의 — 401 / 409

현재 로그인은 아무 값이나 200 을 반환해서, **프론트에서 실패 화면을 만들 수도 테스트할 수도 없습니다.**
로직은 나중에 붙여도 되니 **어떤 상태코드로 줄지만** 확정해주시면 프론트는 미리 만들어두겠습니다.

| 상황 | 요청 상태코드 |
|---|---|
| 이메일 없음 / 비밀번호 틀림 | `401` |
| 회원가입 이메일 중복 | `409` |
| 필수 필드 누락 (`@Valid`) | `400` |

### 3-4. 에러 메시지 노출

명세서의 실패 예시대로 지금은 `message` 필드가 없습니다.
Spring 기본 설정(`server.error.include-message=never`) 때문인데,
그래서 프론트가 받는 정보가 `status: 401` 뿐이고 **사용자에게 보여줄 문장이 없습니다.**

간단한 방법 — `application.properties` 에 한 줄:

```properties
server.error.include-message=always
```

더 나은 방법 — `@RestControllerAdvice` 로 통일:

```json
{
  "code": "INVALID_PASSWORD",
  "message": "비밀번호가 일치하지 않습니다."
}
```

`message` 를 화면에 그대로 띄울 예정이니 사용자가 읽을 문장으로 주시면 됩니다.
`code` 는 프론트에서 분기 처리용입니다 (예: 중복 이메일이면 회원가입 화면으로 유도).

---

## 4. 명세서 문서에 추가 부탁드립니다

문서 자체는 잘 정리되어 있는데, 프론트에서 판단할 수 없어 물어봐야 했던 항목들입니다.

- [ ] **CORS 허용 Origin** — 인증/CSRF 항목 옆에
- [ ] **인증 토큰 전달 방식** — `Authorization` 헤더 형식
- [ ] **공통 데이터 규칙** — 금액 단위(원), 날짜 형식(`YYYY-MM-DD`)을 문서 맨 위에 한 번만
- [ ] **HTTP 상태코드 목록** — 401·409·404 를 쓸지 여부
- [ ] **문서 버전 / 작성일** — 심사 제출물이라 이력이 남으면 좋습니다

---

## 5. 추가로 필요한 API

현재 3개로는 **회원가입·로그인 화면만** 붙일 수 있습니다.
홈화면은 연결할 API가 없어서 시안 숫자가 하드코딩된 상태입니다.

### 5-1. `GET /api/home` — 홈화면 한 번에 조회

필드별 계산식과 출처는 같은 레포의 **`DATA_SPEC.md`** 에 정리해두었습니다.

```json
{
  "user":     { "name": "도현", "profileImageUrl": null, "unreadCount": 3 },
  "mydata":   { "lastSyncedAt": "2025-07-20" },
  "analysis": { "lastViewedAt": "2025-07-23", "nextScheduledAt": "2025-08-24" },
  "goal":     { "targetDeposit": 30000000, "useLoan": true },
  "fund": {
    "progressRate": 42,
    "savedAmount": 12400000,
    "remainingAmount": 17600000,
    "loanAvailableAmount": 20000000,
    "monthlySavingGoal": 500000,
    "expectedMonthlySaving": 520000,
    "breakdown": {
      "accountBalance": 2400000,
      "deposit": 5000000,
      "savings": 4000000,
      "investment": 1000000
    }
  },
  "plan": {
    "current":  { "months": 14, "targetDate": "2026-09", "trend": [10, 28, 44, 62, 80] },
    "withLoan": { "months": 8,  "targetDate": "2026-03", "trend": [14, 34, 52, 70, 92] },
    "previous": { "months": 16, "analyzedAt": "2025-06-24" }
  },
  "insight": {
    "headline": "식비를 월 80,000원 절약하면\n자취 가능 시점이 2개월 앞당겨져요!",
    "tips": [
      { "label": "배달/외식 줄이기", "amount": -40000 },
      { "label": "카페 지출 줄이기", "amount": -25000 },
      { "label": "구독 서비스 점검", "amount": -15000 }
    ]
  },
  "checklist": [
    { "key": "mydata",   "label": "마이데이터 연결 확인",  "status": "완료" },
    { "key": "simulate", "label": "자취 시뮬레이션 실행",  "status": "완료" },
    { "key": "funding",  "label": "자금조달 설계 확인",    "status": "진행중" },
    { "key": "product",  "label": "추천 금융상품 비교",    "status": "대기" },
    { "key": "policy",   "label": "정책·지원금 신청 확인", "status": "대기" }
  ],
  "coach": {
    "message": "현재 소비 패턴을 유지하면 14개월 후 자취가 가능해요.",
    "successRate": 87,
    "dsrRate": 21,
    "region": { "name": "성북구", "savingRange": "월 8~15만원" }
  }
}
```

**지켜주셔야 하는 규칙 5개**

1. **금액은 숫자, 원 단위** — `12400000`. 콤마와 "만원" 변환은 프론트가 합니다
2. **날짜는 `2026-09` / `2025-08-24`** — `2026년 09월` 변환은 프론트가 합니다
3. **`breakdown` 4개 합계 = `savedAmount`** — 도넛과 막대가 같은 값을 나눠 쓰기 때문에 어긋나면 화면에 바로 보입니다
4. **`plan.previous` 는 최초 분석이면 `null`** — 프론트가 비교 문구를 자동으로 숨깁니다
5. **`checklist.status` 는 `완료` / `진행중` / `대기` 세 값만**

### 5-2. `POST /api/analysis` — 자취 목표 설정 + AI 분석 실행

홈화면 `다시 분석하기` 버튼과 자취 시뮬레이션 페이지에서 호출합니다.

```json
요청
{
  "targetDeposit": 30000000,
  "desiredRegion": "서울특별시 성북구",
  "houseType": "원룸",
  "moveInDate": "2027-03",
  "useLoan": true
}

응답 — GET /api/home 의 goal / plan / insight / coach 와 같은 구조
```

**GPT 생성 문구는 이 시점에만 만들어 DB에 저장해주세요.**
`GET /api/home` 에서 매번 GPT를 호출하면 새로고침마다 문구가 바뀌고 비용도 계속 발생합니다.

### 5-3. `GET /api/products` — KB 금융상품 목록

자금조달 설계 페이지용. 팀 회의에서 실제 KB 상품으로 하기로 한 부분입니다. 3~4개면 충분합니다.

```json
{
  "products": [
    {
      "productId": "kb-youth-jeonse-loan",
      "name": "KB 청년전세자금대출",
      "tag": "최저 금리",
      "specs": [
        { "label": "최저 금리", "value": "2.30%" },
        { "label": "예상 한도", "value": "2억원" },
        { "label": "상환 기간", "value": "최대 10년" }
      ],
      "link": "https://obank.kbstar.com/..."
    }
  ]
}
```

---

## 6. DB

현재 `@Entity` 가 하나도 없어 테이블이 생성되지 않습니다.
`ddl-auto=create-drop` 설정은 있지만 매핑할 클래스가 없는 상태입니다.

**최소 3개** (상세 컬럼은 `DATA_SPEC.md` 3번 항목)

1. **`user`** — 회원가입 정보
2. **`goal`** — 자취 목표 (목표 보증금, 희망 지역, 주거 형태, 입주 시기, 대출 의향)
3. **`analysis`** — 분석 이력. **재분석 시 이전 결과와 비교하기로 팀에서 정한 부분**입니다.
   최신 1건 + 직전 1건이 있어야 `이전 분석 대비 2개월 단축` 문구를 만들 수 있습니다

---

## 7. 팀 공유 — 개발 환경 주의점

이 프로젝트는 **Spring Boot 4.1.0 + Gradle 9.5.1** 입니다. 2025년 말에 나온 버전이라 주의할 점이 있습니다.

- **JDK 17 이상 필수** (`build.gradle` toolchain 17). 팀원 PC에 JDK 11 만 있으면 실행되지 않습니다
- **검색 자료 대부분이 Boot 3.x 기준**입니다. 스타터 이름이 `starter-web` → `starter-webmvc` 로 바뀐 것처럼
  구조가 달라진 부분이 있어서, 블로그·StackOverflow 답변을 그대로 붙이면 안 맞을 수 있습니다.
- `RestTemplate` 은 유지보수 모드입니다. 외부 API 연동을 본격적으로 붙일 때 `RestClient` 를 검토해보셔도 좋습니다. 지금은 그대로 두셔도 무리 없습니다

---

## 우선순위

| 순위 | 항목 | 이유 |
|---|---|---|
| 1 | 2. CORS 설정 | 이게 없으면 프론트에서 호출 자체가 불가 |
| 2 | 3. 단위·형식·토큰 확정 | 나중에 바뀌면 양쪽 코드를 다 고쳐야 함 |
| 3 | 4-1. 정책 배열화 | 정책 화면을 만들 수 없음 |
| 4 | 6-1. 홈화면 API | 홈화면이 하드코딩 상태 |
| 5 | 7. DB 엔티티 | 재분석 비교 기능의 전제 조건 |
| 6 | 4-3 / 4-4. 실패 응답 | 상태코드만 먼저 정해주시면 프론트 선작업 가능 |
| 7 | 4-2. 미사용 파라미터 | 입력 화면 설계 판단용 |
