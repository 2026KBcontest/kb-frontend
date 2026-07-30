import { useState } from 'react'
import Review from './Review.jsx'
import Signup from './Signup.jsx'
import Mydata from './Mydata.jsx'
import Login from './Login.jsx'
import Home from './Home.jsx'

/* ============================================================
   화면 전환

   [흐름]
   홍보(review) ─ 회원가입하기 → 가입(signup) → 마이데이터(mydata) ┐
                └ 로그인하기  → 로그인(login) ───────────────────┴→ 홈(home)

   시나리오상 마이데이터 다음은 '자취 목표 설정(③)' 인데 아직 화면이 없어서
   지금은 홈으로 바로 보냄. 해당 화면이 생기면 아래 mydata 의 onNext 만 바꾸면 됨.

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

  switch (page) {
    case 'review':
      return <Review onSignup={go('signup')} onLogin={go('login')} />

    case 'signup':
      return (
        <Signup
          onNext={go('mydata')} /* 다음 (마이데이터 연결) */
          onGoLogin={go('login')} /* 이미 계정이 있으신가요? */
          onBack={go('review')} /* 상단 로고 */
        />
      )

    case 'mydata':
      return (
        <Mydata
          onNext={go('home')} /* TODO: 자취 목표 설정 화면이 생기면 go('goal') 로 */
          onBack={go('signup')}
        />
      )

    case 'login':
      return <Login onSuccess={go('home')} onGoSignup={go('signup')} onBack={go('review')} />

    default:
      return <Home />
  }
}
