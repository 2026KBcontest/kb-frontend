# 백엔드 요청사항 — 개발자 1

작성 : 프론트엔드 담당
담당 범위 : **policy · product · common(에러 처리)**
확인 시점 : `main` 커밋 `66fa1e3` (PR #3 머지 직후)

먼저 반영해주신 것부터 확인했습니다. 감사합니다.
그리고 머지 결과에 문제가 하나 있어서 그것부터 적었습니다.

---

## 1. 최우선 — 머지 결과에 개발자 2 모듈이 안 들어갔습니다

"윤지 선배 코드를 기준점으로 삼고 충돌 코드를 덮어씌웠다"고 하셨는데,
**`main` 을 새로 clone 해서 확인해보니 반대로 되어 있습니다.**

```
확인 방법 : git clone --branch main https://github.com/2026KBcontest/kb-backend.git
커밋      : 66fa1e3  Merge pull request #3 from 2026KBcontest/feature/auth-signup
```

| 폴더 | `main` | `feature/forecast` |
|---|---|---|
| `auth/jwt` | **없음** | 2개 |
| `user` | **없음** | 6개 |
| `mydata` | **없음** | 6개 |
| `forecast` | **없음** | 11개 |
| `policy` | 10개 | 6개 |
| `product` | 4개 | 없음 |

컨트롤러도 `AuthController` · `PolicyController` · `ProductController` **세 개뿐**입니다.
`MyDataController` · `ForecastController` · `UserController` 가 없습니다.
`docs/` 폴더 3개(`apis.md` · `auth.md` · `forecast.md`)도 같이 사라졌습니다.

`main` 과 `feature/auth-signup` 은 **파일 기준으로 완전히 동일**합니다 (`git diff` 결과 0).

### 왜 이렇게 됐는지

`auth` 폴더 **안의** 충돌 파일만 맞추신 것 같습니다.
그런데 개발자 2 님의 작업은 `auth` 밖에도 `user` · `mydata` · `forecast` 세 폴더가 따로 있고,
**그 폴더들은 애초에 이쪽 브랜치에 없었으니 충돌로 잡히지도 않았을 것**입니다.
그래서 "충돌 없이 머지됨" 으로 보였지만 실제로는 통째로 빠진 상태가 됐습니다.

실제로 `main` 의 auth 코드를 보면 여전히 `email` 로그인이고 JWT 가 없습니다.

```java
// main 의 SignupRequest — loginId 없음
private String email;
private String password;
private String name;
```

### 다시 해주실 순서

```
1. feature/forecast 를 main 으로 먼저 머지
2. 그 위에 policy · product · common 얹기
```

이렇게 하면 개발자 2 님 모듈 4개가 살아있는 상태에서 이쪽 작업만 추가됩니다.
`policy` · `product` 는 개발자 2 님 브랜치에 없는 폴더라 충돌 없이 그대로 올라갑니다.

**두 브랜치 차이는 아래 명령으로 확인하실 수 있습니다.**

```bash
git diff main feature/forecast --stat
```

---

## 2. 반영 확인 — 잘 들어갔습니다

| 요청 항목 | 확인 내용 |
|---|---|
| **401 · 409 핸들러** | `UnauthorizedException` · `DuplicateEmailException` 추가 확인 |
| **온통청년 API 키 분리** | `${YOUTH_API_KEY:default_key_here}` 로 환경변수 처리 확인 |
| **`GET /api/products`** | `ProductController` 신규 추가 확인 |
| 정책 `policies` 배열 + `aiReason` | `PolicyResponse` 확인 |
| `description` 25자 제한 | `PolicyService` 의 substring 처리 확인 |
| `status` 뱃지 | `신청 가능` / `조건 확인 필요` 두 값만 사용 |
| CORS `localhost:5173` | `SecurityConfig` 확인 |
| 에러 메시지 노출 | `server.error.include-message=always` 확인 |
| 금액 원 단위 · 생년월일 `YYYY-MM-DD` | `PolicyRequest` 확인 |

**이 세 가지(401·409 / API 키 / ProductController)는 개발자 2 브랜치에 없는 것들이라,
다시 머지하실 때 꼭 같이 올려주세요.**

프론트도 새 에러 코드(`UNAUTHORIZED` · `DUPLICATE_EMAIL`)에 한글 문구를 붙여뒀고,
이메일 중복이면 이메일 입력칸 아래에 바로 뜨도록 연결했습니다.

**API 키 관련 한 가지만 더** — 이미 커밋된 키(`50b0b237-...`)는 git 히스토리에 남아 있습니다.
여유가 되면 온통청년에서 **재발급**받는 것도 권합니다.

---

## 3. 요청 — `GET /api/products` 응답 형태 조정

컨트롤러가 생긴 건 확인했는데, 지금 형태로는 화면을 만들기 어려운 부분이 있습니다.

**현재 응답**

```json
[
  { "id": "prod-1", "name": "KB 청년 맞춤형 전세자금대출",
    "category": "LOAN", "maxAmount": 200000000, "interestRate": "2.4%" }
]
```

**세 가지만 바꿔주시면 좋겠습니다.**

**① 배열을 객체로 감싸주세요** — `{ "products": [ ... ] }`
나중에 `totalCount` 나 `aiReason` 같은 값을 추가할 때 응답 구조를 안 바꿔도 됩니다.
`policy` 는 이미 `{ policies, aiReason }` 형태라 그쪽과도 맞습니다.

**② `link` 가 필요합니다** — 상품 카드의 `자세히 보기` 버튼을 연결할 곳이 없습니다.
KB 상품 페이지 URL 을 넣어주세요.

**③ 항목 표시가 상품마다 달라서 `specs` 배열이면 좋겠습니다**
대출은 `금리 / 한도 / 상환기간`, 적금은 `금리 / 월납입한도 / 기간` 처럼 항목이 달라집니다.
지금처럼 `maxAmount` · `interestRate` 고정 필드면 적금에 `maxAmount 700000` 이 들어가
"최대 70만원 대출" 처럼 읽힐 수 있습니다.

```json
{
  "products": [
    {
      "productId": "kb-youth-jeonse-loan",
      "name": "KB 청년 맞춤형 전세자금대출",
      "category": "LOAN",
      "tag": "최저 금리",
      "specs": [
        { "label": "최저 금리", "value": "2.40%" },
        { "label": "예상 한도", "value": "2억원" },
        { "label": "상환 기간", "value": "최대 10년" }
      ],
      "link": "https://obank.kbstar.com/..."
    }
  ]
}
```

`tag` 는 카드 우측 상단 뱃지용입니다. 없으면 `null` 로 주시면 프론트가 숨깁니다.

**한 가지 확인** — `kb_products.json` 과 `MockKbCoreBankingClient` 를 만들어두셨는데
컨트롤러에는 상품이 하드코딩되어 있습니다. 그 파일들을 쓰실 계획이면
**`kb_products.json` 의 필드 구조를 알려주세요.** 그 구조에 맞춰 화면을 만들겠습니다.

---

## 4. 요청 — 에러 코드 체계를 하나로

지금 **세 벌**이 섞여 있습니다.

```
AUTH_001 ~ COMMON_001            개발자 2 (forecast 브랜치)
UNAUTHORIZED / DUPLICATE_EMAIL   개발자 1 (main 신규)
INVALID_INPUT / BAD_REQUEST      개발자 1 (기존)
```

응답 형식도 다릅니다.

```
개발자 1 →  { "code": "UNAUTHORIZED", "message": "..." }
개발자 2 →  { "success": false, "errorCode": "AUTH_003", "message": "...", "timestamp": "..." }
```

**프론트는 셋 다 읽도록 처리해뒀습니다** (`errorCode ?? code`). 당장 깨지지는 않습니다.
다만 화면에서 "이 에러면 이렇게 안내" 같은 분기를 걸 때 코드 체계가 여러 벌이면
어느 쪽이 올지 몰라 조건을 두 번씩 써야 합니다.

개발자 2 님 체계(`errorCode` + `AUTH_001`~`COMMON_001`)가 상황별로 세분화돼 있어
프론트에서 쓰기 좋습니다. **두 분이 상의해서 하나로 정해주세요.**

정해지면 프론트에서 관용 처리를 지우겠습니다.

---

## 5. 확인 요청 3개

**① 온통청년 API 인증키 발급 상태**
`${YOUTH_API_KEY:default_key_here}` 로 기본값이 `default_key_here` 라, 환경변수를 안 넣으면
실제 호출은 실패하고 fallback 2건만 나옵니다.
시연 때 정책이 2건만 보이면 화면이 비어 보이니, **발급 예정이 없다면 fallback 목록을
3~4건으로 늘려주시면** 좋겠습니다.

**② `PolicyRequest.region` 의 값 범위**
주석에 `"서울, 경기"` 라고 되어 있어 **시·도 단위**로 이해했습니다.
프론트는 `"서울특별시"` 처럼 정식 명칭으로 보내고 있는데, `"서울"` 형태를 기대하신다면
알려주세요.

**주의** — `forecast` 의 `region` 은 **서울 25개 자치구**(`"강남구"`)입니다.
이름은 같은데 값의 범위가 달라서, 회원가입 필드는 `residenceRegion` 으로
이름을 나누자고 개발자 2 님께 제안해뒀습니다.

**③ `/api/policy/**` 인증 필요 여부**
개발자 2 님 `SecurityConfig` 에서는 `permitAll` 입니다.
로그인 없이도 정책 추천이 되는 게 맞나요? 맞다면 홍보 페이지에도 정책 미리보기를
넣을 수 있어 좋습니다.

---

## 6. 참고 — 개발자 2 께 요청한 것

중복 요청을 피하려고 적어둡니다. 상세 내용은 `BACKEND_REQUEST_2D.md` 에 있습니다.

- CORS + `setExposedHeaders` 추가 (forecast 브랜치에 CORS 가 없음)
- 필요 환경변수 문서화 (`JWT_SECRET` 은 32자 이상이어야 함)
- `loginId` 에 숫자 허용
- 인증 실패 시 `401` 로 통일 + 만료 에러코드 분리
- 조회 API 3개 (`GET /api/mydata` · `/api/forecast` · `/api/users/me`)
- 회원가입 필드 5개 추가 · 약관 동의 저장

**`birthDate`·`job` 을 앞으로 쓰신다고 하신 부분** — 회원가입 API 가 개발자 2 브랜치에 있어서
그쪽에 필드 추가를 요청해뒀습니다. 지금은 화면에서 입력은 받지만 서버로 못 보내고
버려지는 상태입니다.

---

## 우선순위

| 순위 | 항목 | 이유 |
|---|---|---|
| 1 | 1. 재머지 (forecast 먼저) | 지금 main 으로는 회원가입 이후가 전부 동작 안 함 |
| 2 | 3. `products` 응답 형태 | 자금조달 설계 화면 설계에 필요 |
| 3 | 4. 에러 코드 통일 | 프론트가 임시로 세 벌 다 처리 중 |
| 4 | 5-① 온통청년 키 / fallback | 시연 때 정책이 2건만 나옴 |
| 5 | 5-②③ 확인 사항 | 값 범위 · 인증 여부 |
| 6 | 2. API 키 재발급 | 히스토리에 남아 있음 |
