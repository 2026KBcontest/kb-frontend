import { useState } from 'react'
import Review from './Review.jsx'
import Signup from './Signup.jsx'
import Mydata from './Mydata.jsx'
import Forecast from './Forecast.jsx'
import Login from './Login.jsx'
import Home from './Home.jsx'
import { logout } from './api.js'

/* ============================================================
   화면 전환

   [흐름] — 시나리오 전체 순서와 같음
   홍보(review) ─ 회원가입하기 → 가입(signup) → 마이데이터(mydata) → 목표설정·분석(forecast) ┐
                └ 로그인하기  → 로그인(login) ──────────────────────────────────────────┴→ 홈(home)

   회원가입을 마친 사람은 마이데이터 → 목표설정을 거쳐야 홈에 갈 수 있고,
   이미 가입한 사람은 로그인만 하면 바로 홈으로 간다.

   ※ 로그인 화면으로 되돌아갈 때는 저장된 토큰을 비운다.
     안 그러면 이전 사용자의 토큰으로 API 를 호출하게 됨.

   화면이 더 늘어나면 react-router-dom 을 넣고 <Routes> 로 바꾸는 게 좋음.
   지금은 뒤로가기·주소창 공유가 필요 없어서 useState 로 충분함.
   ============================================================ */

export default function App() {
  const [page, setPage] = useState('review')

  // 화면이 바뀔 때 스크롤을 맨 위로 올려줌.
  // 안 하면 긴 회원가입 화면에서 아래를 보다 이동했을 때 중간부터 보임
  const go = (next) => () => {
    setPage(next)
    window.scrollTo(0, 0)
  }

  // 처음 화면으로 돌아가는 건 사실상 로그아웃이라 토큰도 같이 정리
  const goStart = () => () => {
    logout()
    setPage('review')
    window.scrollTo(0, 0)
  }

  switch (page) {
    case 'review':
      return <Review onSignup={go('signup')} onLogin={go('login')} />

    case 'signup':
      return (
        <Signup
          onNext={go('mydata')} /* 다음 (마이데이터 연결) */
          onGoLogin={go('login')} /* 이미 계정이 있으신가요? */
          onBack={goStart()} /* 상단 로고 */
        />
      )

    case 'mydata':
      return (
        <Mydata
          onNext={go('forecast')} /* 다음 (자취 목표 설정) */
          onBack={go('signup')}
        />
      )

    case 'forecast':
      return (
        <Forecast
          onNext={go('home')} /* 분석 결과 자세히 보기 */
          onBack={go('mydata')}
        />
      )

    case 'login':
      return <Login onSuccess={go('home')} onGoSignup={go('signup')} onBack={goStart()} />

    default:
      return <Home />
  }
}
