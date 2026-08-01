# DB 스키마 — 지금 만든 화면을 돌리는 데 필요한 것만

작성 : 프론트엔드 담당
기준 : `feature/forecast` (auth·user·mydata·forecast) + `main` (policy·product)

**결론부터 — `user` 표에 컬럼 9개만 추가하면 됩니다. 새 표는 없습니다.**

---

## 1. 지금 있는 표 (그대로 두면 됨)

| 표 | 담는 것 | 손댈 것 |
|---|---|---|
| `user` | 로그인 정보, 월 소득, refresh token | **컬럼 9개 추가** ↓ |
| `my_data_snapshot` | 소비 10 · 자산 3 · 부채 2 | 없음 |
| `simulation_result` | 자취 분석 결과 | 없음 |
| `youth_policy` | 온통청년 정책 캐시 | 없음 |
| `kb_product` | KB 금융상품 | 없음 |

---

## 2. 필요한 변경 — `user` 컬럼 9개

```sql
ALTER TABLE user
  ADD COLUMN birth_date            DATE,
  ADD COLUMN residence_region      VARCHAR(20),
  ADD COLUMN gender                VARCHAR(10),
  ADD COLUMN job                   VARCHAR(20),
  ADD COLUMN phone                 VARCHAR(20),
  ADD COLUMN monthly_saving_goal   BIGINT,
  ADD COLUMN agreed_privacy_at     DATETIME,
  ADD COLUMN agreed_mydata_at      DATETIME,
  ADD COLUMN agreed_marketing_at   DATETIME;
```

`ddl-auto=update` 라서 **엔티티에 필드만 추가하면 컬럼이 생깁니다.**

```java
// User.java 에 추가
@Column(name = "birth_date")        private LocalDate birthDate;
@Column(name = "residence_region")  private String residenceRegion;
private String gender;
private String job;
private String phone;

@Column(name = "monthly_saving_goal") private Long monthlySavingGoal;

@Column(name = "agreed_privacy_at")   private LocalDateTime agreedPrivacyAt;
@Column(name = "agreed_mydata_at")    private LocalDateTime agreedMydataAt;
@Column(name = "agreed_marketing_at") private LocalDateTime agreedMarketingAt;
```

### 각 컬럼이 어느 화면에서 쓰이는지

| 컬럼 | 쓰는 화면 | 지금은 |
|---|---|---|
| `birth_date` | 맞춤 정책·지원금 (나이 조건) | 브라우저에만 있어서, 재접속하면 다시 물어봄 |
| `residence_region` | 맞춤 정책·지원금 (지역 조건) | 〃 |
| `gender` | 상단 프로필 아이콘 (남/여) | 〃 |
| `job` | 마이페이지 표시 · 향후 정책 조건 | 〃 |
| `phone` | 마이페이지 표시 | 〃 |
| `monthly_saving_goal` | 저축 플랜 추천 → 홈 '월 저축 목표' | 〃 |
| `agreed_*_at` × 3 | 회원가입 동의 체크박스 3개 | **아예 저장 안 됨** |

### 두 가지만 짚고 넘어가면

**`birth_date` 는 `String` 이 아니라 `DATE`** — 나이 조건을 SQL 로 거를 수 있고,
`Period.between(birthDate, LocalDate.now()).getYears()` 로 나이 계산이 한 줄입니다.
**나이 자체를 컬럼으로 저장하면 안 됩니다.** 생일이 지나면 틀린 값이 됩니다.

**`monthly_saving_goal` 은 `monthly_saving_capacity` 와 다른 값입니다.**

```
monthly_saving_capacity   소득 − 지출        계산된 최대치    (simulation_result 에 이미 있음)
monthly_saving_goal       사용자가 정한 금액   실제 저축 목표   (user 에 추가)
```

여력이 72만원이어도 예상 못 한 지출을 감안해 54만원을 목표로 잡을 수 있어서,
둘을 같은 칸에 담으면 안 됩니다.

**동의는 `BOOLEAN` 이 아니라 `DATETIME`** — 개인정보보호법상 **언제 동의했는지**가
필요합니다. 동의 안 했으면 `NULL`, 철회하면 `NULL` 로 되돌리면 됩니다.

---

## 3. 함께 필요한 API 3개

컬럼만 있고 넣고 뺄 통로가 없으면 소용이 없습니다.

| API | 하는 일 |
|---|---|
| `POST /api/auth/signup` 확장 | 위 컬럼 중 가입 때 받는 8개를 함께 저장 |
| `GET /api/users/me` | 저장된 값을 화면이 다시 읽음 (지금은 조회 API 가 없음) |
| `PATCH /api/users/me` | 마이페이지·저축 플랜에서 수정 (보낸 필드만 갱신) |

`GET /api/users/me` 응답 예시 — 이대로 오면 프론트가 바로 씁니다.

```json
{
  "loginId": "rlaehgus",
  "name": "김도현",
  "email": "rlaehgus124@naver.com",
  "monthlyIncome": 2400000,
  "monthlySavingGoal": 540000,
  "birthDate": "1999-04-11",
  "residenceRegion": "서울특별시",
  "gender": "남성",
  "job": "직장인"
}
```

---

## 4. 지금은 **안 해도 되는 것** (헷갈리지 않게 적어둠)

| 항목 | 왜 지금은 아닌지 |
|---|---|
| 분석 이력 표 (`simulation_result` 1:N) | 지금 화면에 '지난번과 비교' 기능이 없음. 나중에 |
| 마이데이터 이력 | 소비 추이 비교 화면이 아직 없음 |
| 동의 이력 표 (`user_agreement`) | 철회 이력까지 남기려면 필요하지만, 지금은 시각 3개면 충분 |
| 체크리스트 상태 저장 | 홈에서만 쓰는 표시값이라 브라우저 보관으로 충분 |
| 알림 · 정책 찜 · AI 코치 대화 | 화면이 없음 |

---

## 5. 관계도

```
user (1)
 ├─(1:1)── my_data_snapshot
 └─(1:1)── simulation_result

youth_policy   독립 (외부 API 캐시)
kb_product     독립 (상품 마스터)
```

정책·상품은 사용자와 연결하지 않습니다.
추천은 요청 시점에 조건으로 걸러 내려주는 방식이라 관계 표가 필요 없습니다.
