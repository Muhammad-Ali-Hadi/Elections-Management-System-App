import { useState, useCallback, useEffect } from 'react'
import { voterAPI, attendanceAPI } from '../services/api'
import VoteCasting from '../pages/vote_casting'
import Results from '../pages/results'
import AdminPanel from '../panels/adminpanel'
import UserPanel from '../panels/userPanel'
import Login from './Login'

const STORAGE_USER_KEY = 'sessionUser'
const STORAGE_PAGE_KEY = 'sessionPage'

const parseJSON = (raw) => {
  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function Router({ currentUser, setCurrentUser, electionData, setElectionData }) {
  const getInitialPage = () => {
    const hash = window.location.hash.replace('#', '')
    if (hash === '/final-results') return 'public-final'
    const storedPage = sessionStorage.getItem(STORAGE_PAGE_KEY)
    return storedPage || 'login'
  }

  const [currentPage, setCurrentPage] = useState(getInitialPage)
  const [attendance, setAttendance] = useState({})
  const ENV_ELECTION_ID = import.meta.env.VITE_ELECTION_ID
  // Prefer env ID, then hydrated electionData, then fallback
  const ELECTION_ID = ENV_ELECTION_ID || electionData._id || electionData.electionId || '69657a9d6767a0bc1e83ec02'

  // Hydrate user from sessionStorage on load
  useEffect(() => {
    if (!currentUser) {
      const storedUser = parseJSON(sessionStorage.getItem(STORAGE_USER_KEY))
      if (storedUser) {
        setCurrentUser(storedUser)
      }
    }
  }, [currentUser, setCurrentUser])

  const handleLogin = useCallback(async (user) => {
    console.log('🔐 Router: handleLogin called with user:', user)
    
    if (!user) {
      console.error('❌ Router: No user provided to handleLogin')
      return
    }
    
    setCurrentUser(user)
    sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
    
    if (user.role !== 'admin') {
      console.log('📊 Setting page to vote')
      setCurrentPage('vote')
      sessionStorage.setItem(STORAGE_PAGE_KEY, 'vote')
    } else {
      console.log('👤 Admin detected, setting page to admin')
      setCurrentPage('admin')
      sessionStorage.setItem(STORAGE_PAGE_KEY, 'admin')
    }
  }, [ELECTION_ID, setCurrentUser])

  const recordVote = useCallback(async (user) => {
    // Update local attendance first for immediate UI feedback
    setAttendance(prev => ({
      ...prev,
      [user.flatNumber]: {
        ...prev[user.flatNumber],
        voted: true,
        voteTime: new Date().toLocaleString()
      }
    }))
    
    // Fetch updated attendance from API
    try {
      console.log('Fetching updated attendance for:', user.flatNumber)
      const attendanceData = await attendanceAPI.getAttendanceByFlat(user.flatNumber, ELECTION_ID)
      
      if (attendanceData) {
        setAttendance(prev => ({
          ...prev,
          [user.flatNumber]: {
            name: attendanceData.name || user.name,
            flatNumber: attendanceData.flatNumber,
            loginTime: attendanceData.loginTime ? new Date(attendanceData.loginTime).toLocaleString() : 'N/A',
            voteTime: attendanceData.voteTime ? new Date(attendanceData.voteTime).toLocaleString() : null,
            voted: attendanceData.voted || false
          }
        }))
      }
    } catch (error) {
      console.warn('Could not fetch attendance from API:', error)
      // Keep the local state update if API fails
    }
  }, [ELECTION_ID])

  const handleLogout = () => {
    voterAPI.logout()
    setCurrentUser(null)
    setAttendance({})
    setCurrentPage('login')
    sessionStorage.removeItem(STORAGE_USER_KEY)
    sessionStorage.removeItem(STORAGE_PAGE_KEY)
    
    // Clear all session-related state from localStorage
    localStorage.removeItem('selectedCandidates')
    localStorage.removeItem('voteSubmitted')
    localStorage.removeItem('adminActiveTab')
    localStorage.removeItem('resultsFinalized')
    localStorage.removeItem('resultsPage')
  }

  // Persist page changes per tab so refresh keeps context
  useEffect(() => {
    sessionStorage.setItem(STORAGE_PAGE_KEY, currentPage)
  }, [currentPage])

  // Sync hash navigation for shareable final results link
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash === '/final-results') {
        setCurrentPage('public-final')
        sessionStorage.setItem(STORAGE_PAGE_KEY, 'public-final')
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const renderPage = () => {
    console.log('📄 Rendering page:', currentPage, 'for user:', currentUser?.name || 'none')
    
    switch (currentPage) {
      case 'login':
        console.log('  → Rendering Login')
        return <Login onLogin={handleLogin} />
      case 'vote':
        console.log('  → Rendering VoteCasting')
        return <VoteCasting electionData={electionData} setElectionData={setElectionData} currentUser={currentUser} onNavigate={setCurrentPage} recordVote={recordVote} />
      case 'results':
        console.log('  → Rendering Results')
        return <Results electionData={electionData} onNavigate={setCurrentPage} isAdmin={currentUser?.role === 'admin'} />
      case 'admin':
        console.log('  → Rendering AdminPanel')
        return <AdminPanel electionData={electionData} setElectionData={setElectionData} onNavigate={setCurrentPage} attendance={attendance} />
      case 'profile':
        console.log('  → Rendering UserPanel')
        return <UserPanel currentUser={currentUser} electionData={electionData} onNavigate={setCurrentPage} attendance={attendance} />
      case 'public-final':
        console.log('  → Rendering Public Final Results')
        return <Results electionData={electionData} onNavigate={() => {}} isAdmin={false} isPublic />
      default:
        console.log('  → Default: Rendering Login (unknown page)')
        return <Login onLogin={handleLogin} />
    }
  }

  return (
    <div className="router-container">
      {console.log('🔄 Router rendering, currentPage:', currentPage, 'currentUser:', currentUser)}
      
      {currentUser && (
        <nav className="navbar">
          <div className="nav-brand">🏢 Elections Management</div>
          <div className="nav-links">
            {currentUser.role !== 'admin' && (
              <>
                <button onClick={() => setCurrentPage('vote')} className="nav-btn">Vote</button>
                <button onClick={() => setCurrentPage('profile')} className="nav-btn">My Profile</button>
              </>
            )}
            {currentUser.role === 'admin' && (
              <>
                <button onClick={() => setCurrentPage('admin')} className="nav-btn">Dashboard</button>
              </>
            )}
            <span className="current-user">{currentUser.flatNumber || currentUser.name || currentUser.username}</span>
            <button onClick={handleLogout} className="nav-btn logout-btn">Logout</button>
          </div>
        </nav>
      )}
      
      <div style={{ minHeight: '100vh' }}>
        {renderPage()}
      </div>
    </div>
  )
}

export default Router
