import { useState } from 'react'
import Review from './Review.jsx'
import Home from './Home.jsx'

/* ============================================================
   화면 전환

   처음 들어오면 랜딩(Review) → [회원가입하기]/[로그인하기] 누르면 홈(Home).

   지금은 화면이 2개뿐이라 useState 로 충분함.
   회원가입·마이데이터 연동 같은 페이지가 늘어나면
   react-router-dom 을 넣고 <Routes> 로 바꾸는 게 좋음.
   ============================================================ */

export default function App() {
  const [page, setPage] = useState('review')

  if (page === 'review') {
    return <Review onEnter={() => setPage('home')} />
  }
  return <Home />
}
