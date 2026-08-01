# 백엔드 요청사항 — 개발자 2

작성 : 프론트엔드 담당
담당 범위 : **auth(JWT) · user · mydata · forecast**
확인 시점 : `feature/forecast` 커밋 `a5642c6`, `main` 커밋 `66fa1e3`

프론트는 이 브랜치 기준으로 전부 연동해뒀습니다.

```
회원가입 → 마이데이터(소득 입력 + 연동) → 자취 목표 설정(분석) → 홈
signup      users/me/income · mydata/sync    forecast/simulate
```

---

## 1. 최우선 — `main` 에 이 브랜치 코드가 안 올라갔습니다

PR #3 이 머지되면서 `main` 이 개발자 1 님 브랜치로 덮였습니다.
**이 브랜치의 모듈 4개가 `main` 에 없습니다.**

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

`docs/` 폴더 3개(`apis.md` · `auth.md` · `forecast.md`)도 `main` 에는 없습니다.
공유해주신 문서가 `feature/forecast` 브랜치에만 있어서, `main` 을 보는 팀원은 못 찾습니다.

개발자 1 님은 "선배 코드를 기준으로 삼았다"고 하셨는데, `auth` 폴더 **안의** 충돌 파일만
맞추신 것 같습니다. `user` · `mydata` · `forecast` 는 그쪽 브랜치에 원래 없던 폴더라
**충돌로 잡히지 않아서** 조용히 빠진 것으로 보입니다.

**개발자 1 님께 `feature/forecast` 를 먼저 머지한 뒤 policy·product 를 얹어달라고
요청해뒀습니다.** 두 분이 순서만 맞춰주시면 됩니다.

**`main` 에서 살릴 것 3개** — 이 브랜치에 없는 것들이라 머지할 때 챙겨주세요.

- `common/exception` 의 **401 · 409 핸들러** (`UnauthorizedException` · `DuplicateEmailException`)
- 온통청년 **API 키 환경변수 분리** (`${YOUTH_API_KEY:...}`)
- **`ProductController`** (`GET /api/products`)

---

## 2. 최우선 — CORS 설정이 없습니다

이 브랜치의 `SecurityConfig` 에 **CORS 설정이 전혀 없습니다.**
프론트가 쓰는 API 대부분이 여기 있어서, 지금은 브라우저에서 호출이 전부 막힙니다.

**놓치기 쉬운 이유** — Postman·curl 에서는 정상 동작합니다.
CORS 는 브라우저만 적용하는 규칙이라, 서버 테스트를 다 통과해도 화면에서만 막힙니다.

### 그리고 이 브랜치는 한 줄이 더 필요합니다

`AuthController.login()` 이 토큰을 **응답 헤더**로 내려줍니다.

```java
return ResponseEntity.ok()
        .header("Authorization", "Bearer " + result.accessToken())
        .header("Refresh-Token", result.refreshToken())
        .body(result.body());
```

브라우저는 CORS 응답에서 **안전한 헤더 6개만** 자바스크립트에 노출하고,
`Authorization` 과 `Refresh-Token` 은 거기에 포함되지 않습니다.
`setExposedHeaders` 로 노출을 명시하지 않으면

- 로그인은 `200 OK` 로 성공하고
- 바디의 `userId` · `loginId` · `name` 도 잘 읽히는데
- **토큰만 `null`** 이 됩니다

로그인은 되는데 그 다음 API 가 전부 실패하는 형태라 원인 찾기가 가장 어려운 종류입니다.

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:5173"));
    config.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));

    // ★ 이 줄이 없으면 프론트가 토큰을 읽지 못합니다
    config.setExposedHeaders(List.of("Authorization", "Refresh-Token"));

    config.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

필터체인에 한 줄 추가:

```java
http
    .cors(cors -> cors.configurationSource(corsConfigurationSource()))   // ← 추가
    .csrf(csrf -> csrf.disable())
    ...
```

`.cors()` 를 등록하면 `CorsFilter` 가 인가 검사보다 먼저 돌기 때문에,
브라우저 preflight(OPTIONS)가 `.anyRequest().authenticated()` 에 걸려 거부되는 문제도
같이 해결됩니다.

**개발자 1 님 브랜치의 CORS 코드를 참고하시되, `setExposedHeaders` 는 거기 없습니다.**
그쪽은 토큰을 응답 바디로 주기 때문에 필요가 없었습니다. 그대로 복사하면 이 문제가 남습니다.

**참고** — 프론트에서는 토큰을 못 읽으면
`"로그인은 됐지만 토큰을 읽지 못했어요. 서버의 Access-Control-Expose-Headers 설정이 필요해요."`
가 뜨도록 해뒀습니다. 이 문구가 보이면 이 설정이 빠진 것입니다.

---

## 3. 실행 환경 — MySQL 유지는 이해했습니다. 문서만 부탁드려요

> "h2 는 보통 인메모리로 사용해서 배포용으로는 잘 사용하지 않는 걸로 알고 있어서 mysql 로 대체"

맞는 판단입니다. 배포를 생각하면 MySQL 이 맞습니다. **그대로 가는 데 동의합니다.**

다만 제가 로컬에서 띄우려다 **두 번 막혔고**, 둘 다 코드 문제가 아니라
**어디에도 적혀 있지 않아서** 생긴 문제였습니다.

### 3-1. `JWT_SECRET` 은 32자 이상이어야 합니다

```
Could not resolve placeholder 'JWT_SECRET' in value "${JWT_SECRET}" <-- "${jwt.secret}"
```

이 에러를 보고 아무 값이나 넣으면 **또 막힙니다.**
`JwtProvider` 가 `Keys.hmacShaKeyFor(secret.getBytes())` 를 쓰는데 HS256 은
**최소 256비트(32바이트)** 키를 요구해서, 31자 이하면 `WeakKeyException` 이 납니다.

이건 코드를 열어보기 전엔 알 수 없는 부분이라 꼭 적어주세요.

### 3-2. `application.properties` 를 각자 고치는 방식은 충돌이 납니다

> "각자 pc 에서 로컬 mysql 사용자이름, 비밀번호, db 포트 작성해서 변경"

이 파일은 **git 이 추적하는 파일**이라, 각자 고치면

- `git pull` 할 때마다 이 파일에서 충돌이 나고
- 실수로 커밋하면 **본인 MySQL 비밀번호가 레포에 올라갑니다**

다행히 이미 환경변수로 되어 있으니(`${DB_USERNAME:root}` · `${DB_PASSWORD}`)
**파일은 그대로 두고 환경변수만 각자 넣는 방식**이면 이 문제가 없습니다.

레포 루트에 `.env.example` 하나만 추가해주세요. 값은 예시로 채우고 실제 값은 각자 넣습니다.

```
JWT_SECRET=change-me-to-a-32-characters-or-longer-secret
DB_USERNAME=root
DB_PASSWORD=your-mysql-password
```

**MySQL 설치 방법도 한 줄 적어주시면** 팀원이 헤매지 않습니다.
저는 `winget install Oracle.MySQL` 로 설치했는데 **비밀번호 입력 화면이 안 뜨고**
서버 초기화도 안 된 상태로 설치돼서, `mysqld --initialize-insecure` 부터 직접 해야 했습니다.

`docs/` 에 실행 방법을 한 문단 추가해주셔도 좋습니다.

### 3-3. JDBC URL 에 `allowPublicKeyRetrieval=true` 가 필요합니다

MySQL 을 설치하고 접속하니 이 에러가 났습니다.

```
com.mysql.cj.exceptions.UnableToConnectException: Public Key Retrieval is not allowed
    at ...CachingSha2PasswordPlugin.nextAuthenticationStep(...)
```

MySQL 8 의 기본 인증 방식이 `caching_sha2_password` 인데, 비밀번호를 주고받을 때
서버 공개키가 필요합니다. 현재 URL 에 `useSSL=false` 만 있고 공개키 조회 허용 옵션이 없어서
드라이버가 연결을 거부합니다.

**`application.properties` 의 URL 에 한 항목만 추가해주세요.**

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/kbdb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
```

**이건 MySQL 을 새로 설치한 사람은 전부 겪습니다.** 기존에 쓰던 MySQL 이 있으면
인증 플러그인이 예전 방식(`mysql_native_password`)으로 남아 있어 안 겪을 수 있는데,
MySQL 8.4 부터는 그 플러그인이 기본 비활성이라 새로 설치하면 반드시 만납니다.

**보안 참고** — `allowPublicKeyRetrieval=true` 는 중간자 공격 가능성 때문에
운영 환경에서는 권장되지 않습니다. 배포할 때는 `useSSL=true` 로 바꾸는 게 맞습니다.
지금은 localhost 전용이라 문제없습니다.

저는 우선 환경변수로 덮어써서 돌리고 있습니다 (파일은 안 건드렸습니다).

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:mysql://localhost:3306/kbdb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8"
```

### 3-4. 로컬 전용 H2 프로파일 (선택)

MySQL 을 운영용으로 유지하면서, 로컬 개발만 H2 로 쓰는 구성도 가능합니다.
저나 기획 담당은 MySQL 설치 없이 서버를 띄울 수 있어서 확인이 빨라집니다.

`build.gradle` 에 한 줄

```gradle
runtimeOnly 'com.h2database:h2'
```

`src/main/resources/application-local.properties` 새 파일

```properties
spring.datasource.url=jdbc:h2:mem:kbdb;DB_CLOSE_DELAY=-1;MODE=MySQL
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.hibernate.ddl-auto=create-drop
jwt.secret=local-dev-secret-key-please-change-me-32
```

```bash
./gradlew bootRun --args='--spring.profiles.active=local'
```

**운영 설정은 전혀 안 건드립니다.** 필수는 아니니 판단해주세요.

---

## 4. 요청 — `loginId` 에 숫자를 허용해주세요

현재 **영문만** 허용합니다.

```java
@Pattern(regexp = "^[a-zA-Z]{4,20}$", message = "아이디는 영문 대소문자 4~20자여야 합니다.")
```

숫자를 못 쓰면 실제 사용자가 쓰는 아이디 대부분(`hwptorag2` · `kim1234`)을 만들 수 없습니다.
심사 시연 중 계정을 새로 만들 때도 불편합니다.

**제안**

```java
@Pattern(regexp = "^[a-zA-Z][a-zA-Z0-9]{3,19}$",
         message = "아이디는 영문으로 시작하는 영문·숫자 4~20자여야 합니다.")
```

첫 글자를 영문으로 제한하는 건 `12345` 같은 순수 숫자 아이디를 막기 위함입니다
(회원번호와 헷갈릴 수 있어서). 단순하게 가고 싶으시면 `^[a-zA-Z0-9]{4,20}$` 도 괜찮습니다.

**프론트는 서버가 바뀐 뒤에 같이 바꾸겠습니다.** 지금 프론트만 풀면 사용자가 입력은 되는데
서버가 거부해서 "왜 안 되는지 모르겠는" 상태가 됩니다. 교체할 정규식은 주석으로 준비해뒀습니다.

---

## 5. 버그 — 순자산 계산이 대출을 두 번 빼고 있습니다

`ForecastService.calculateCurrentAsset()` 이 `assetLoan` 과 `assetRemainingRepayment` 를
**둘 다 빼고 있습니다.**

```java
return (s.getAssetDeposit() + s.getAssetSaving() + s.getAssetInvestment())
        - (s.getAssetLoan() + s.getAssetRemainingRepayment());
```

두 값은 **같은 대출을 두 관점으로 본 것**입니다.

| 필드 | mock 값 | 의미 |
|---|---|---|
| `assetLoan` | 20,000,000 | 처음 빌린 총액 |
| `assetRemainingRepayment` | 15,000,000 | 그중 아직 안 갚은 금액 |

이미 500만원을 갚았으니 **실제 부채는 1,500만원**입니다.
그런데 지금은 3,500만원을 빼고 있어서 순자산의 **부호가 뒤집힙니다.**

```
현재 :  18,000,000 − (20,000,000 + 15,000,000) = -17,000,000
정정 :  18,000,000 −  15,000,000               =  +3,000,000
```

**이게 자취 분석 결과를 크게 왜곡합니다.** `requiredAmount − currentAsset` 이
필요한 저축액이 되는데, 순자산이 −1,700만이면 실제보다 **3,200만원을 더 모아야 하는 것으로**
계산됩니다. 예상 기간이 그만큼 길어집니다.

```java
// 제안
private long calculateCurrentAsset(Optional<MyDataSnapshot> snapshot) {
    if (snapshot.isEmpty()) return 0L;
    MyDataSnapshot s = snapshot.get();
    return (s.getAssetDeposit() + s.getAssetSaving() + s.getAssetInvestment())
            - s.getAssetRemainingRepayment();   // 최초 대출액은 빼지 않음
}
```

**제 해석이 맞는지 확인 부탁드립니다.** 두 값이 서로 다른 부채(예: 학자금 / 카드할부)를
뜻하는 거라면 지금 계산이 맞습니다. 그렇다면 필드명을 `assetStudentLoan` ·
`assetCardInstallment` 처럼 나눠주시면 오해가 없겠습니다.

**프론트는 우선 남은 상환액만 부채로 잡도록 고쳤습니다.**
마이데이터 관리 화면에서는 순자산이 +300만원으로 나오고, 화면에도
"최초 대출액은 처음 빌린 금액이라 합계에 넣지 않아요" 라고 적어뒀습니다.
**서버가 고쳐지기 전까지는 자취 분석 화면(서버 값)과 숫자가 다르게 보입니다.**

---

## 6. 요청 — 인증 실패 시 `401` 로 내려주세요

`JwtAuthenticationFilter` 가 토큰이 유효하지 않으면 **조용히 넘어갑니다.**

```java
if (jwtProvider.validateToken(token)) { ...인증 설정... }
filterChain.doFilter(request, response);   // 실패해도 그냥 통과
```

그러면 `.anyRequest().authenticated()` 에서 걸리는데 `authenticationEntryPoint` 가
지정돼 있지 않아서, Spring Security 기본값이 적용되어 **`401` 이 아니라 `403`** 이 나갈
가능성이 큽니다.

프론트는 `401` 을 받으면 `reissue` 로 새 토큰을 받아 원래 요청을 자동 재시도합니다.
`403` 이 오면 이 자동 갱신이 **아예 동작하지 않고** 사용자가 그냥 튕깁니다.

```java
http.exceptionHandling(e -> e.authenticationEntryPoint(
        (req, res, ex) -> res.sendError(HttpServletResponse.SC_UNAUTHORIZED)))
```

**프론트는 방어적으로 `401` · `403` 을 모두 처리하도록 이미 고쳤습니다.**
그래도 서버에서 명확히 내려주시면 좋겠습니다.

**그리고 만료용 에러 코드를 따로 만들어주세요.**
현재 필터가 "토큰 없음" 과 "토큰 만료" 를 구분하지 않아서, 프론트가
`조용히 갱신할 상황` 과 `로그인 화면으로 보낼 상황` 을 구별할 수 없습니다.
예: `AUTH_005`(access token 만료).

---

## 7. 요청 — 조회 API 3개

이 브랜치의 API 는 전부 **쓰기(POST/PATCH)** 입니다. **새로고침하면 화면이 비어버립니다.**

`MyDataSnapshotRepository` 와 `SimulationResultRepository` 에 데이터가 이미 저장되고 있으니
읽기만 하는 API 를 얹어주시면 됩니다.

| 요청 API | 응답 | 용도 |
|---|---|---|
| `GET /api/mydata` | `MyDataSnapshotResponse` (sync 와 동일) | `sync` 는 연동 실행 API 라 화면 열 때마다 부를 수 없음 |
| `GET /api/forecast` | `SimulationResultResponse` (simulate 와 동일) | 홈 진입마다 재계산하면 값이 흔들리고 서버 부담도 생김 |
| `GET /api/users/me` | `name`·`loginId`·`email`·`monthlyIncome` | 홈 상단 인사말 + 소득 재표시 |

**`GET /api/users/me` 가 특히 급합니다.**
말씀하신 대로 월 급여는 사용자가 직접 입력받는 값인데, 지금은 그 값을 **프론트 메모리에만**
들고 있어서 새로고침하면 사라집니다. 그러면 사용자가 매번 다시 입력해야 합니다.

---

## 8. 요청 — 회원가입 필드 5개 추가

말씀해주신 입력 항목 정리 잘 받았습니다. 프론트도 같은 구조로 되어 있습니다.

> 1. 아이디, 비밀번호, 이메일, 이름
> 2. 마이데이터에서 가져오는 항목
> 3. 평균 월 급여 (직접 입력)

다만 **시나리오 ① 의 회원가입 항목은 10개**입니다. 화면에서는 10개를 다 받고 있는데
`SignupRequest` 가 4개만 받아서 **아래 5개는 서버로 못 보내고 버려집니다.**

개발자 1 님이 `birthDate` · `job` 을 나이 계산과 조건 필터링에 쓰신다고 하셨는데,
지금은 저장할 곳이 없어서 그 값이 사라지는 상태입니다.

| 필드 | 형식 |
|---|---|
| `birthDate` | `"1998-01-01"` (YYYY-MM-DD) |
| `gender` | `"남성"` / `"여성"` |
| `job` | `"학생"` / `"취업준비생"` / `"직장인"` |
| `residenceRegion` | 시·도 문자열 (예: `"서울특별시"`) |
| `phone` | `"010-1234-5678"` |

**이름을 `region` 이 아니라 `residenceRegion` 으로 제안하는 이유** —
`forecast` 의 `region` 은 서울 25개구, `policy` 의 `region` 은 시·도입니다.
회원가입까지 `region` 을 쓰면 **세 곳이 같은 이름에 다른 값**이 되어 반드시 헷갈립니다.

---

## 9. 요청 — 약관 동의 저장

회원가입 화면에 동의 체크박스 3개가 있는데(필수 2 / 선택 1) 저장할 곳이 없습니다.

개인정보보호법상 **동의를 받았다는 기록**이 필요하고, 실무에서는 동의 여부만이 아니라
**동의한 시각**까지 남깁니다. 심사에서 개인정보 처리를 물어볼 수 있는 부분입니다.

```json
{
  "agreements": {
    "privacy":   { "agreed": true,  "agreedAt": "2026-07-31T14:20:11+09:00" },
    "mydata":    { "agreed": true,  "agreedAt": "2026-07-31T14:20:11+09:00" },
    "marketing": { "agreed": false, "agreedAt": null }
  }
}
```

마케팅 동의는 철회가 가능해야 하므로 `User` 컬럼보다 **별도 테이블 + 변경 이력**을 권합니다.
`BaseTimeEntity` 가 이미 있으니 붙이기 어렵지 않을 것 같습니다.

---

## 10. 설계 확인 4가지

코드를 읽고 이해한 내용입니다. 화면 문구를 정확히 쓰기 위해 확인 부탁드립니다.

**① `isFallbackApplied` 의 의미** — `ForecastService` 를 보고
**'저축 여력을 소득의 20% 로 추정했다'** 는 뜻으로 이해했습니다.

```java
if (snapshot.isEmpty())        → 소득 × 0.2, fallbackApplied = true
if (income - consumption < 0)  → 소득 × 0.2, fallbackApplied = true
```

처음엔 '시세 데이터가 없어 평균값을 썼다' 는 뜻으로 잘못 이해해서 화면 문구를 틀리게 썼습니다.
지금은 `"소비 내역으로 저축 여력을 계산할 수 없어 소득의 20%로 추정했어요"` 로 고쳤는데
맞는지 확인 부탁드립니다.

**② 20% 의 근거** — 출처가 있으면 화면에 함께 표기하려 합니다.
**근거 없는 수치는 심사에서 지적받기 쉬운 부분**이라, 없다면 그것도 알려주시면
문구를 조정하겠습니다.

**③ 월세 보증금이 지역과 무관하게 1천만원 고정**입니다 (`WOLSE_FIXED_DEPOSIT`).
CSV 에 월세 보증금 컬럼이 없어서 그러신 것으로 보입니다.
의도된 단순화라면 화면에 "보증금 1천만원 기준" 이라고 명시해두겠습니다.
**강남과 강북의 월세 보증금이 같은 이유를 심사에서 물어볼 수 있는 부분**입니다.

**④ `requiredAmount` 에 월세 2개월분**이 들어갑니다.

```java
long requiredAmount = deposit + monthlyRent * 2 + brokerageFee;
```

프론트에는 `월세 2개월분` 으로 표시해뒀습니다. 2개월인 근거를 알려주시면 설명을 붙이겠습니다.

---

## 11. 잘 맞은 부분 (확인용)

**검증 규칙이 프론트와 정확히 일치합니다.** `SignupRequest` 애노테이션과 대조했습니다.

| 항목 | 서버 | 프론트 |
|---|---|---|
| `loginId` | `^[a-zA-Z]{4,20}$` | 동일 (4번 반영 시 같이 변경) |
| `password` 길이 | 10~22자 | 동일 |
| `password` 특수문자 | `.*[^a-zA-Z0-9].*` | `/[^A-Za-z0-9]/` — 동일 |

**지역 이름 25개가 CSV 와 전부 일치합니다.** 프론트 버튼 목록과 대조했고 차이가 없었습니다.

**중개보수 계산을 재현했습니다.** 구간별 요율(0.5%/0.4%/0.3%)과 상한(20만/30만)을 옮겨
명세서 예시 두 건(765,810원 / 326,310원)이 정확히 나오는 걸 확인했습니다.

**`estimatedMonths: null` 은 에러가 아니라 정상 응답으로 처리**했습니다.
"아직 예측할 수 없어요 + 고정 지출을 점검해보세요" 안내를 띄웁니다.

**`currentAsset` 이 음수로 오는 것도 정상 처리**했습니다.
`(예금+적금+투자) − (대출+남은상환액)` 이라 순자산이 마이너스일 수 있다는 걸 확인하고,
라벨을 `현재 순자산` 으로 바꾸고 설명을 붙였습니다.

---

## 12. 요청 — 회원 프로필을 DB 에 저장하고 조회 API 로 내려주세요 (7·8번 보강)

8번에서 회원가입 필드 5개 추가를 요청드렸는데, **정책 화면을 만들면서 이게 왜 필요한지가
구체적으로 드러나서** 저장 형태와 조회 방법까지 정리해 덧붙입니다.

### 지금 무슨 일이 일어나는가

`POST /api/policy/recommend` 는 `region` · `income` · `birthDate` 세 개를 요청 본문으로 받습니다.
그런데 이 값들은 **회원가입 때 이미 입력받은 값**입니다. 서버가 저장하지 않으니
정책 화면에서 사용자에게 **또 물어봐야 합니다.**

```
회원가입 : 생년월일 1999-04-11, 거주지역 서울특별시  →  서버로 안 감 (버려짐)
정책 화면 : "생년월일과 지역을 입력해주세요"          →  방금 적었는데 또 물어봄
```

프론트는 임시로 브라우저(`sessionStorage`)에 담아두고 자동으로 채우게 해뒀습니다.
다만 **탭을 닫거나 다른 기기에서 로그인하면 사라집니다.** 임시방편입니다.

### 요청 ① — `user` 테이블에 컬럼 5개

| 컬럼 | 타입 | 예시 | 이 값을 쓰는 곳 |
|---|---|---|---|
| `birth_date` | `DATE` | `1999-04-11` | 정책 나이 조건(만 19~34 등) |
| `residence_region` | `VARCHAR(20)` | `서울특별시` | 정책 지역 조건 |
| `gender` | `VARCHAR(10)` | `남성` | 통계 · 향후 조건 |
| `job` | `VARCHAR(20)` | `직장인` | 정책 대상 조건(청년/학생) |
| `phone` | `VARCHAR(20)` | `010-1234-5678` | 알림 (추후) |

```sql
ALTER TABLE user
  ADD COLUMN birth_date       DATE,
  ADD COLUMN residence_region VARCHAR(20),
  ADD COLUMN gender           VARCHAR(10),
  ADD COLUMN job              VARCHAR(20),
  ADD COLUMN phone            VARCHAR(20);
```

`ddl-auto` 가 `update` 면 엔티티에 필드만 추가하셔도 됩니다.

```java
// User.java
@Column(name = "birth_date")
private LocalDate birthDate;

@Column(name = "residence_region", length = 20)
private String residenceRegion;

@Enumerated(EnumType.STRING)   // 혹은 String 그대로
private Gender gender;

private String job;
private String phone;
```

**`birthDate` 는 `String` 이 아니라 `LocalDate` 를 권합니다.** 나이 계산을 서버가 하게 되면
`Period.between(birthDate, LocalDate.now()).getYears()` 로 한 줄이고, 문자열이면 매번 파싱해야 합니다.
프론트는 지금도 `"1999-04-11"` 형식으로 보냅니다. (`@JsonFormat` 없이 그대로 매핑됩니다)

**나이를 컬럼으로 저장하지는 말아주세요.** 생일이 지나면 틀린 값이 되고, 갱신 배치가 필요해집니다.

### 요청 ② — `SignupRequest` 에 필드 추가

```java
@NotNull  private LocalDate birthDate;        // 필수
@NotBlank private String residenceRegion;     // 필수
          private String gender;              // 선택
          private String job;                 // 선택
          private String phone;               // 선택
```

**만 19~39세만 가입 가능**하도록 서버에서도 막아주시면 좋겠습니다.
프론트에서 이미 검사하고 있지만, 프론트 검사는 우회가 가능합니다.
(청년 정책 대상이 아닌 사용자가 가입하면 추천이 0건이 되어 화면이 비어버립니다)

### 요청 ③ — `GET /api/users/me` 응답에 포함 (7번 API)

7번에서 요청드린 조회 API 에 이 값들을 같이 넣어주시면, 프론트가 화면을 열 때 한 번 불러서
정책·시뮬레이션 조건을 자동으로 채웁니다.

```json
{
  "loginId": "rlaehgus",
  "name": "김도현",
  "email": "rlaehgus124@naver.com",
  "monthlyIncome": 2400000,
  "birthDate": "1999-04-11",
  "residenceRegion": "서울특별시",
  "gender": "남성",
  "job": "직장인"
}
```

이 API 가 생기면 **정책 화면의 입력칸을 아예 없앨 수 있습니다.**
지금은 `sessionStorage` 가 비어 있으면 다시 묻는 화면이 남아 있어야 합니다.

### 개발자 1 님과 함께 정해야 하는 부분

`policy/recommend` 가 **요청 본문 대신 토큰으로 회원을 식별하는 방식**도 가능합니다.
그러면 프론트는 조건을 보낼 필요가 없어집니다. 다만 `SecurityConfig` 에서
`/api/policy/**` 가 지금 `permitAll` 이라 **인증 정책을 바꿔야 하는 문제**가 걸립니다.
같은 내용을 `BACKEND_REQUEST_1D.md` 6번에 적어뒀으니 두 분이 상의해서 정해주세요.

**프론트는 어느 쪽이든 대응 가능합니다.** 정해진 쪽으로 맞추겠습니다.

---

## 13. 요청 — 회원 정보 수정 API (`PATCH /api/users/me`)

마이페이지를 만들었는데, **소득 말고는 저장할 곳이 없습니다.**

지금 있는 건 `PATCH /api/users/me/income` 하나뿐이라, 이름·이메일·생년월일·지역을
고쳐도 서버에 보낼 수 없습니다. 화면에서는 브라우저에만 저장하고
"이 브라우저에만 저장돼요" 라고 정직하게 적어뒀지만, 임시방편입니다.

```
PATCH /api/users/me
Authorization: Bearer {accessToken}

{
  "name": "김도현",
  "email": "new@kb.com",
  "birthDate": "1999-04-11",
  "residenceRegion": "서울특별시",
  "gender": "남성",
  "job": "직장인",
  "phone": "010-1234-5678"
}
```

**부분 수정(보낸 필드만 갱신)으로 만들어주세요.** 화면마다 고치는 항목이 달라서,
전체 필드를 항상 보내야 하면 프론트가 매번 나머지 값을 채워 보내야 하고
그 과정에서 값이 덮어써질 위험이 있습니다.

응답은 수정된 회원 정보 전체(7번의 `GET /api/users/me` 와 같은 형태)면 좋겠습니다.

### 같이 필요한 것 2개

**① 이메일 변경 시 중복 검사** — 다른 사람이 쓰는 이메일이면 `409` + `AUTH_002` 로
내려주세요. 프론트는 이미 그 코드에 "이미 가입된 이메일이에요" 문구를 붙여뒀습니다.

**② 비밀번호 변경은 별도 API 로** — 같은 API 에 넣으면 위험합니다.

```
PATCH /api/users/me/password
{ "currentPassword": "...", "newPassword": "..." }
```

**현재 비밀번호 확인이 반드시 필요합니다.** 없으면 로그인된 브라우저를 잠깐만 만져도
비밀번호를 바꿔버릴 수 있습니다. 틀리면 `401` + `AUTH_003` 으로 주시면 됩니다.
변경 후에는 기존 refresh token 을 무효화(`user.refreshToken = null`)해주세요.
그래야 다른 기기에 남아 있던 세션이 끊깁니다.

### 회원 탈퇴 (여유 있으면)

```
DELETE /api/users/me
```

마이페이지에 자리는 만들어뒀고 지금은 '준비 중' 으로 비활성입니다.
개인정보보호법상 탈퇴(파기) 경로가 있어야 해서, 심사에서 물어볼 수 있는 부분입니다.
실제 삭제 대신 `deletedAt` 을 남기는 소프트 삭제도 괜찮습니다.

---

## 14. 화면별로 필요한 API 총정리

화면을 다 만들고 나서, 어떤 데이터가 어디서 오는지 한 번에 정리했습니다.
**개별 요청은 앞 항목들에 있고, 이 장은 전체 그림을 보기 위한 것**입니다.

### 지금 상태

| 화면 | 필요한 데이터 | 지금 어떻게 하고 있나 | 필요한 API |
|---|---|---|---|
| 홈 · 인사말 | 이름 | 로그인 응답을 브라우저에 보관 | `GET /api/users/me` (7번) |
| 홈 · 자금 현황 | 자산·부채 | `sync` 응답을 브라우저에 보관 | `GET /api/mydata` (7번) |
| 홈 · 자취 가능 시점 | 분석 결과 | `simulate` 응답을 브라우저에 보관 | `GET /api/forecast` (7번) |
| 홈 · AI 인사이트 | 소비 항목별 금액 | **프론트에서 계산 중** | 없어도 됨 |
| 홈 · 체크리스트 | 진행 상태 | **프론트에서 판단 중** | 없어도 됨 |
| 홈 · 월 저축 목표 | 사용자가 정한 목표액 | **저장할 곳이 없어 빈칸** | **14-2** |
| 홈 · 대출 활용 시 비교 | 대출 조건 시뮬레이션 | **빈칸 (준비 중)** | 자금조달 설계와 함께 |
| 홈 · 저축 추이 그래프 | 과거 분석 이력 | **선형 가정으로 그리는 중** | **14-3** |
| 자취 시뮬레이션 | 지역별 시세 | 선택 후 `simulate` 응답으로만 확인 | **14-1** |
| 마이데이터 관리 | 소비·자산·부채 | `sync` 재실행 | `GET /api/mydata` (7번) |
| 마이페이지 | 가입 정보 | **브라우저에만 보관** | 12·13번 |
| 맞춤 정책·지원금 | 정책 목록 | `policy/recommend` 연동 완료 ✅ | (개발자 1 담당) |
| 자금조달 설계 | 금융상품 | 화면 미개발 | `GET /api/products` (개발자 1) |

**'프론트에서 계산 중' 두 개는 이대로 두는 게 낫다고 봅니다.** 인사이트와 체크리스트는
화면에서만 쓰는 표시용 값이라 서버가 계산해줄 필요가 없고, 기준을 바꿀 때 프론트만 고치면
됩니다. 서버 부담을 늘리지 않으려고 일부러 프론트에 둔 것입니다.

---

### 14-1. 요청 — `GET /api/forecast/regions` (지역 시세 목록)

자취 시뮬레이션 화면에서 자치구 25개 버튼을 누르기 전에 **"이 동네는 전세 얼마인지"**
를 보여주고 싶은데, 그 값을 받을 방법이 없습니다.

`simulate` 응답에 `deposit` 이 오지만 **선택한 한 곳뿐**이고, 25개를 미리 보여주려고
25번 호출하면 그때마다 분석 결과가 DB에 덮어써집니다.

**데이터는 이미 서버에 있습니다.** `RegionHousingFeeLoader` 가 시작할 때
`seoul_housingfee_pergu.csv` 를 읽어 Map 으로 들고 있습니다. 그 Map 을 그대로 내려주시면 됩니다.

```
GET /api/forecast/regions        (인증 불필요 — 시세는 개인정보가 아님)

{
  "regions": [
    { "region": "서초구", "deposit": 286340000, "monthlyRent": 740000 },
    { "region": "중구",   "deposit": 273020000, "monthlyRent": 650000 }
  ],
  "baseYearMonth": "2025-12"
}
```

`RegionHousingFeeLoader` 에 `findAll()` 을, `ForecastController` 에 `@GetMapping("/regions")`
하나를 추가하는 정도라 부담이 크지 않을 것 같습니다.

**`baseYearMonth`(시세 기준 시점)를 같이 주시면 좋겠습니다.** 화면에 "2025년 12월 기준"
이라고 적어야 심사에서 "이 숫자 언제 것이냐" 는 질문에 답할 수 있습니다.
CSV 에 없으면 상수로 넣어주셔도 됩니다.

**프론트가 CSV 값을 복사해 쓰지 않는 이유** — 목(mock)에는 같은 값이 들어 있어서 지금도
화면에 띄울 수는 있습니다. 그런데 그러면 나중에 CSV 를 갱신했을 때 **계산은 새 값,
화면은 옛 값**이 되어 두 숫자가 어긋납니다. 그래서 API 로 받기 전까지는 비워두겠습니다.

---

### 14-2. 요청 — 월 저축 목표 저장

홈에 `월 저축 목표` 칸이 있는데 저장할 곳이 없어 비어 있습니다.

`monthlySavingCapacity`(소득 − 지출)는 **계산된 여력**이고, 저축 목표는 **사용자가 스스로
정하는 값**이라 다릅니다. "매달 80만원씩 모으겠다" 는 목표가 있어야
목표 대비 달성률을 보여줄 수 있고, 저축 플랜 추천(시나리오 ⑥)의 기준이 됩니다.

**새 API 는 필요 없습니다. 13번 `PATCH /api/users/me` 에 필드 하나만 추가해주세요.**

```java
// User.java
@Column(name = "monthly_saving_goal")
private Long monthlySavingGoal;
```

```sql
ALTER TABLE user ADD COLUMN monthly_saving_goal BIGINT;
```

---

### 14-3. 요청 — 분석 이력 남기기 (`GET /api/forecast/history`)

`SimulationResult` 가 `@OneToOne @MapsId` 라서 **사용자당 한 줄**입니다.
다시 분석하면 이전 결과가 사라집니다.

```java
@Id private UUID userId;
@OneToOne @MapsId private User user;   // → 재분석 시 덮어쓰기
```

그래서 홈에서 **"지난번보다 3개월 빨라졌어요"** 같은 걸 보여줄 수 없습니다.
지금 저축 추이 그래프는 이력이 없어서 **직선으로 가정해 그리고 있습니다.**
실제 데이터가 아니라는 걸 알고 쓰는 임시 처리입니다.

**제안 — 결과 테이블을 이력형으로 바꿔주세요.**

```java
@Id @GeneratedValue private UUID id;          // 유저당 여러 줄
@ManyToOne @JoinColumn(name = "user_id") private User user;
private LocalDateTime createdAt;
```

```
GET /api/forecast          → 가장 최근 1건 (7번에서 요청한 것)
GET /api/forecast/history  → 최근 N건 (그래프·비교용)
```

부담되면 **이력 저장만 먼저** 해주셔도 됩니다. 조회 API 는 나중에 붙여도 되고,
데이터가 쌓여 있어야 나중에 만들 수 있습니다. 지금 구조로는 지난 기록이 계속 사라집니다.

---

### `GET /api/home` 같은 집계 API 는 요청하지 않습니다

홈에 카드가 6개라 "홈 전용 API 하나로 묶어달라"고 할 수도 있지만, 그러지 않겠습니다.

- 7번의 조회 API 3개(`users/me` · `mydata` · `forecast`)면 홈에 필요한 값이 다 나옵니다
- 집계 API 를 만들면 **홈 화면이 바뀔 때마다 백엔드도 같이 고쳐야** 합니다
- 조회 API 3개는 홈 말고 다른 화면에서도 쓰지만, 홈 전용 API 는 홈에서만 쓰입니다

**즉 새 API 를 만드는 것보다 7번을 먼저 해주시는 게 훨씬 도움이 됩니다.**

---

### 개발자 1 담당 항목 (참고)

중복 요청을 피하려고 적어둡니다. 상세는 `BACKEND_REQUEST_1D.md` 에 있습니다.

| 항목 | 내용 |
|---|---|
| `GET /api/products` | 응답 형태 조정 (자금조달 설계 화면용) |
| `policy/recommend` | 조건 전달 방식 (요청 본문 유지 / 토큰 식별) — 12번과 연결 |
| `income` 단위 | 연소득인지 월소득인지 확인 필요 |

---

## 15. 확인 — 마이데이터 없이 `simulate` 가 되는 동작

코드를 보고 의도를 이해했는데, 화면에서 오해가 생겨서 적어둡니다.

```java
// ForecastService.simulate()
if (snapshot.isEmpty()) {
    monthlySavingCapacity = applyFallback(monthlyIncome);  // 소득의 20%로 추정
    fallbackApplied = true;
}

private long calculateCurrentAsset(Optional<MyDataSnapshot> snapshot) {
    if (snapshot.isEmpty()) return 0L;                     // 자산은 0원
}
```

**소득만 있으면 분석이 됩니다.** 마이데이터를 연결하지 않아도 결과가 나옵니다.
"일단 대략이라도 보여주자" 는 의도로 이해했고, 그 자체는 합리적입니다.

**다만 화면에서는 결과가 나온 뒤에야 그 사실을 알 수 있었습니다.**
자산 0원 · 저축 여력 추정치로 계산된 값인데, 사용자는 정확한 예측이라고 믿게 됩니다.

**프론트에서 처리했습니다.** 마이데이터가 없으면 분석 버튼 위에 경고를 띄웁니다.

> 마이데이터를 아직 연결하지 않았어요
> 지금 분석하면 **모은 자산은 0원**, 저축 여력은 **소득의 20%** 로 추정해 계산해요.

**서버는 지금 동작을 유지해주셔도 됩니다.** 막아달라는 요청이 아니라,
이 동작이 의도한 것이 맞는지만 확인 부탁드립니다.
만약 "마이데이터 없이는 분석 불가" 로 바꾸실 계획이면 알려주세요.
그때는 프론트에서 버튼 자체를 막겠습니다.

---

## 16. 참고 — AI 기능은 개발자 1 님과 연결됩니다

세 화면(정책·저축·자금조달)에 **AI 추천 / AI 어드바이스** 자리를 만들어뒀습니다.
GPT 호출은 개발자 1 님께 요청해뒀는데(`BACKEND_REQUEST_1D.md` 7 · 7-3),
**AI 가 인용할 값은 이 브랜치의 데이터입니다.**

| AI 가 답하려면 필요한 값 | 어디서 오나 |
|---|---|
| 필요 초기자금 · 순자산 · 저축 여력 | `forecast/simulate` (이 브랜치) |
| 소비 항목별 금액 | `mydata/sync` (이 브랜치) |
| 월 소득 · 나이 · 지역 | `user` (이 브랜치, 12번 컬럼 추가 필요) |

지금은 프론트가 들고 있는 값을 요청에 실어 보내는 방식으로 만들어뒀습니다.
서버끼리 직접 읽는 편이 정확하니, **7번 조회 API 가 생기면 그쪽이 더 좋습니다.**
개발자 1 님이 AI 를 붙일 때 이 브랜치의 데이터가 필요하다는 점만 공유드립니다.

**이 브랜치에 추가로 요청드릴 것은 없습니다.** AI 카드는 화면 세 곳에 하나씩 두고,
서버가 값을 주면 그대로 표시하는 구조라 이미 준비가 끝났습니다.
다만 **AI 가 인용할 숫자(필요 자금·순자산·저축 여력)가 정확해야** 답변도 정확해지므로,
5번(순자산 이중 차감)이 AI 연동보다 먼저 고쳐지는 편이 좋습니다.

---

## 우선순위

| 순위 | 항목 | 이유 |
|---|---|---|
| 1 | **5.** 순자산 계산 버그 | 분석 결과가 크게 왜곡됨. 시연에서 바로 보임 |
| 2 | **1.** 재머지 (개발자 1 님과 순서 조율) | main 에 이 브랜치 코드가 없음 |
| 3 | **2.** CORS + Expose-Headers | 없으면 화면에서 호출 자체가 불가 |
| 3 | **3-1·3-2·3-3.** 실행 환경 문서화 + JDBC 옵션 | 지금 팀원이 서버를 못 띄움 |
| 4 | **7.** 조회 API 3개 | 새로고침하면 화면이 비어버림. **14장 대부분이 이것 하나로 해결됨** |
| 5 | **6.** 401 + 만료 에러코드 | 자동 토큰 갱신 동작 여부 |
| 6 | **14-3.** 분석 이력 저장 | 지금 구조로는 재분석할 때마다 지난 기록이 사라짐 (저장만 먼저여도 됨) |
| 7 | **4.** `loginId` 숫자 허용 | 실제 사용자 아이디를 못 만듦 |
| 8 | **8·12.** 회원가입 필드 5개 + DB 컬럼 | 값이 버려져서, 정책·마이페이지에서 또 물어보게 됨 |
| 9 | **13.** `PATCH /api/users/me` | 마이페이지에서 저장할 곳이 없음 (14-2 컬럼 포함) |
| 10 | **14-1.** 지역 시세 목록 | 이미 서버에 있는 CSV 를 내려주기만 하면 됨 |
| 11 | **10-①** `isFallbackApplied` 확인 | 화면 문구가 틀렸을 수 있음 |
| 12 | **10-②③④** 설계 확인 | 심사 질의 대비 |
| 13 | **9.** 약관 동의 저장 | 개인정보 처리 근거 |
| 14 | **3-4.** 로컬 H2 프로파일 | 선택 사항 |
