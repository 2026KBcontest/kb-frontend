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

## 5. 요청 — 인증 실패 시 `401` 로 내려주세요

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

## 6. 요청 — 조회 API 3개

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

## 7. 요청 — 회원가입 필드 5개 추가

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

## 8. 요청 — 약관 동의 저장

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

## 9. 설계 확인 4가지

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

## 10. 잘 맞은 부분 (확인용)

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

## 우선순위

| 순위 | 항목 | 이유 |
|---|---|---|
| 1 | 1. 재머지 (개발자 1 님과 순서 조율) | main 에 이 브랜치 코드가 없음 |
| 2 | 2. CORS + Expose-Headers | 없으면 화면에서 호출 자체가 불가 |
| 3 | 3-1·3-2·3-3. 실행 환경 문서화 + JDBC 옵션 | 지금 팀원이 서버를 못 띄움 |
| 4 | 5. 401 + 만료 에러코드 | 자동 토큰 갱신 동작 여부 |
| 5 | 6. 조회 API 3개 | 새로고침하면 화면이 비어버림 |
| 6 | 4. `loginId` 숫자 허용 | 실제 사용자 아이디를 못 만듦 |
| 7 | 9-① `isFallbackApplied` 확인 | 화면 문구가 틀렸을 수 있음 |
| 8 | 7. 회원가입 필드 5개 | 입력받은 값이 버려지고 있음 |
| 9 | 9-②③④ 설계 확인 | 심사 질의 대비 |
| 10 | 8. 약관 동의 저장 | 개인정보 처리 근거 |
| 11 | 3-4. 로컬 H2 프로파일 | 선택 사항 |
