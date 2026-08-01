import { useState } from 'react'
import Review from './Review.jsx'
import Signup from './Signup.jsx'
import Mydata from './Mydata.jsx'
import Forecast from './Forecast.jsx'
import Login from './Login.jsx'
import Home from './Home.jsx'
import MydataManage from './MydataManage.jsx'
import Policy from './Policy.jsx'
import MyPage from './MyPage.jsx'
import SavingPlan from './SavingPlan.jsx'
import FundingPlan from './FundingPlan.jsx'
import { Sidebar, ComingSoon, ErrorBoundary } from './Shell.jsx'
import { logout, isLoggedIn } from './api.js'
import { clearAppData, saveLastPage, getLastPage } from './store.js'

/* ============================================================
   화면 전환

   [가입 흐름] — 시나리오 순서와 같음
   홍보(review) ─ 회원가입하기 → 가입(signup) → 마이데이터(mydata) → 목표설정(forecast) ┐
                └ 로그인하기  → 로그인(login) ──────────────────────────────────────┴→ 홈(home)

   [로그인 이후] 사이드바 메뉴 7개로 이동.
   아직 만들지 않은 화면은 ComingSoon 으로 대신 띄운다.
   눌러도 아무 반응이 없으면 고장난 것처럼 보이기 때문.

   [새로고침]
   토큰이 남아 있으면 마지막으로 보던 화면부터 시작한다.
   안 그러면 F5 한 번에 홍보 페이지로 돌아가서 회원가입부터 다시 해야 함.

   화면이 더 늘어나면 react-router-dom 을 넣고 <Routes> 로 바꾸는 게 좋음.
   지금은 주소창 공유가 필요 없어서 useState 로 충분함.
   ============================================================ */


/* 사이드바 메뉴 label → 페이지 키.
   값이 null 이면 아직 화면이 없다는 뜻 (ComingSoon 표시) */
const MENU_TO_PAGE = {
  '홈': 'home',
  '자취 시뮬레이션': 'forecast',
  '자금조달 설계': 'fundingPlan',
  '저축 플랜 추천': 'savingPlan',
  '맞춤 정책·지원금': 'policy',
  '마이데이터 관리': 'mydataManage',
  '마이페이지': 'mypage',
}

/* 새로고침했을 때 어디서 시작할지.
   토큰이 있으면 마지막 화면, 없으면 홍보 페이지 */
function initialPage() {
  if (!isLoggedIn()) return 'review'
  return getLastPage() ?? 'home'
}

export default function App() {
  const [page, setPage] = useState(initialPage)

  // 아직 화면이 없는 메뉴를 눌렀을 때, 어떤 메뉴였는지 기억해둠
  const [pendingMenu, setPendingMenu] = useState(null)

  // 로그인이 필요해서 로그인 화면으로 보낼 때 함께 띄우는 안내
  const [loginNotice, setLoginNotice] = useState('')

  /* 화면을 바꿀 때 하는 일 3가지 — 한 곳에 모아둠
     1) 페이지 교체  2) 스크롤 맨 위로  3) 새로고침 대비 기억 */
  function goTo(next) {
    setPage(next)
    saveLastPage(next)
    window.scrollTo(0, 0)
  }

  const go = (next) => () => {
    if (next !== 'login') setLoginNotice('') // 다른 경로로 들어오면 안내는 지운다
    goTo(next)
  }

  // 처음 화면으로 = 로그아웃. 토큰과 보관 데이터를 함께 정리
  function signOut() {
    logout()
    clearAppData() // 다음 사용자에게 이전 값이 보이면 안 됨
    setPage('review')
    window.scrollTo(0, 0)
  }

  // 사이드바·프로필 메뉴 클릭
  function navigate(label) {
    /* 로그인 이후 화면은 전부 개인 데이터를 보여준다.
       토큰이 없는데 들어가면 빈 화면만 나오고, 사용자는 왜 비었는지 알 수 없다.
       (예: 다른 탭에서 로그아웃했거나, 토큰이 만료된 채로 뒤로가기를 한 경우)
       그래서 여기서 한 번 막고 로그인 화면으로 안내한다 */
    if (!isLoggedIn()) {
      setLoginNotice('로그인이 필요한 화면이에요. 로그인하면 이어서 확인할 수 있어요.')
      goTo('login')
      return
    }

    const target = MENU_TO_PAGE[label]
    if (target) {
      setPendingMenu(null)
      goTo(target)
    } else {
      setPendingMenu(label) // 아직 없는 화면
      setPage('comingSoon')
      window.scrollTo(0, 0)
    }
  }

  // 로그인 이후 화면은 전부 에러 경계로 감싼다.
  // 한 곳이 터져도 흰 화면 대신 안내가 뜨고, 사이드바로 다른 메뉴로 갈 수 있음
  const guard = (node, label) => <ErrorBoundary label={label}>{node}</ErrorBoundary>

  switch (page) {
    /* ---------- 가입 · 로그인 ---------- */

    case 'review':
      return <Review onSignup={go('signup')} onLogin={go('login')} />

    case 'signup':
      return (
        <Signup
          onNext={go('mydata')} /* 다음 (마이데이터 연결) */
          onGoLogin={go('login')} /* 이미 계정이 있으신가요? */
          onBack={signOut} /* 상단 로고 */
        />
      )

    case 'mydata':
      return <Mydata onNext={go('forecast')} onBack={go('signup')} />

    case 'login':
      return (
        <Login
          onSuccess={go('home')}
          onGoSignup={go('signup')}
          onBack={signOut}
          notice={loginNotice}
        />
      )

    /* ---------- 로그인 이후 ---------- */

    case 'forecast':
      return guard(
        <Forecast
          onNext={go('home')}
          onBack={go('home')}
          onGoMydata={() => navigate('마이데이터 관리')}
        />,
        '자취 목표 설정',
      )

    case 'mydataManage':
      return guard(
        <MydataManage onNavigate={navigate} onLogout={signOut} />,
        '마이데이터 관리',
      )

    case 'policy':
      return guard(<Policy onNavigate={navigate} onLogout={signOut} />, '맞춤 정책·지원금')

    case 'mypage':
      return guard(<MyPage onNavigate={navigate} onLogout={signOut} />, '마이페이지')

    case 'savingPlan':
      return guard(<SavingPlan onNavigate={navigate} onLogout={signOut} />, '저축 플랜 추천')

    case 'fundingPlan':
      return guard(<FundingPlan onNavigate={navigate} onLogout={signOut} />, '자금조달 설계')

    case 'comingSoon':
      // 사이드바는 그대로 두고 본문만 '준비 중' 으로 바꿔서 메뉴 이동은 계속 되게 함
      return (
        <div className="min-h-screen flex bg-white">
          <Sidebar active={pendingMenu} onNavigate={navigate} />
          <ComingSoon title={pendingMenu} onGoHome={go('home')} />
        </div>
      )

    default:
      return guard(<Home onNavigate={navigate} onLogout={signOut} />, '홈화면')
  }
}
