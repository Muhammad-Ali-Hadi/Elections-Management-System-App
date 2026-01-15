import { useState, useMemo, useEffect } from 'react'
import { attendanceAPI, voteAPI, candidateAPI, resultsAPI, adminAPI } from '../services/api'

const ENV_ELECTION_ID = import.meta.env.VITE_ELECTION_ID
const DEFAULT_ELECTION_ID = '69657a9d6767a0bc1e83ec02'

// Available positions from the schema
const DEFAULT_POSITIONS = ['President', 'Vice President', 'General Secretary', 'Joint Secretary', 'Finance Secretary']

function AdminPanel({ electionData = { candidates: [] }, setElectionData, onNavigate }) {
  const ELECTION_ID = ENV_ELECTION_ID
    || electionData?._id
    || electionData?.electionId
    || electionData?.candidates?.[0]?.electionId
    || DEFAULT_ELECTION_ID
  const [newCandidate, setNewCandidate] = useState({ 
    name: '', 
    position: '', 
    flatNumber: '', 
    wing: '', 
    description: '' 
  })
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('adminActiveTab')
    return saved || 'control'
  })
  const [resultsFinalized, setResultsFinalized] = useState(() => {
    const saved = localStorage.getItem('resultsFinalized')
    return saved === 'true' ? true : false
  })
  const [isOpenLocal, setIsOpenLocal] = useState(() => {
    const saved = localStorage.getItem('electionIsOpen')
    if (saved === 'false') return false
    if (saved === 'true') return true
    return electionData?.isOpen !== undefined ? electionData.isOpen : false
  })
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)
  const [liveAttendance, setLiveAttendance] = useState({})
  const [liveResults, setLiveResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectedVotes, setRejectedVotes] = useState(0)
  const [resultsStatus, setResultsStatus] = useState('ongoing')
  const [scheduleStart, setScheduleStart] = useState('')
  const [scheduleEnd, setScheduleEnd] = useState('')
  const [autoOpenEnabled, setAutoOpenEnabled] = useState(false)
  const [scheduleEditedAt, setScheduleEditedAt] = useState(0)
  const [scheduleDirty, setScheduleDirty] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [votedFlats, setVotedFlats] = useState([])
  const [selectedFlats, setSelectedFlats] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab)
  }, [activeTab])

  // Save resultsFinalized to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('resultsFinalized', resultsFinalized.toString())
  }, [resultsFinalized])

  // Sync local open state to storage and upstream electionData
  useEffect(() => {
    if (electionData?.isOpen !== undefined) {
      setIsOpenLocal(electionData.isOpen)
      localStorage.setItem('electionIsOpen', electionData.isOpen.toString())
    }
  }, [electionData?.isOpen])

  // Fetch real-time data from backend
  // useEffect(() => {
  //   const fetchRealtimeData = async () => {
  //     try {
  //       console.log('📊 AdminPanel: Fetching real-time admin data...')
  //       setError('')
  //       const scheduleLocked = scheduleDirty || (scheduleEditedAt && (Date.now() - scheduleEditedAt < 4000))
        
  //       // Fetch latest election status
  //       try {
  //         const statusResp = await adminAPI.getElectionStatus(ELECTION_ID)
  //         if (statusResp?.election) {
  //           const { isOpen, startDate, endDate, autoOpenEnabled: autoMode } = statusResp.election
  //           const sched = statusResp.schedule || {}
  //           if (isOpen !== undefined) {
  //             setIsOpenLocal(isOpen)
  //             localStorage.setItem('electionIsOpen', isOpen.toString())
  //             setElectionData(prev => ({ ...prev, isOpen }))
  //           }
  //           // If user is editing schedule right now, avoid overwriting their inputs with stale poll
  //           if (scheduleDirty) {
  //             return
  //           }
  //           const startVal = sched.startDate || startDate
  //           const endVal = sched.endDate || endDate
  //           if (!scheduleLocked) {
  //             const nextStart = startVal ? new Date(startVal).toISOString().slice(0, 16) : ''
  //             const nextEnd = endVal ? new Date(endVal).toISOString().slice(0, 16) : ''
  //             setScheduleStart(prev => prev === nextStart ? prev : nextStart)
  //             setScheduleEnd(prev => prev === nextEnd ? prev : nextEnd)
  //             setAutoOpenEnabled(Boolean(sched.autoOpenEnabled ?? autoMode))
  //           } else {
  //             // Keep local edits but still refresh open status display
  //             if (isOpen !== undefined) {
  //               setIsOpenLocal(isOpen)
  //               localStorage.setItem('electionIsOpen', isOpen.toString())
  //               setElectionData(prev => ({ ...prev, isOpen }))
  //             }
  //           }
  //         }
  //       } catch (statusErr) {
  //         console.warn('Could not fetch election status:', statusErr.message)
  //       }

  //       // Fetch candidates from API to ensure we have latest data
  //       const candidatesData = await candidateAPI.getCandidates(ELECTION_ID)
  //       console.log('📋 Candidates fetched:', candidatesData)
  //       if (candidatesData && candidatesData.length > 0) {
  //         setElectionData(prev => ({
  //           ...prev,
  //           candidates: candidatesData
  //         }))
  //       }
        
  //       // Fetch attendance report
  //       const attendanceReport = await attendanceAPI.getAttendanceReport(ELECTION_ID)
  //       console.log('📋 Attendance Report:', attendanceReport)
        
  //       const attendanceMap = {}
  //       if (attendanceReport.report?.attendanceList) {
  //         attendanceReport.report.attendanceList.forEach(record => {
  //           attendanceMap[record.flatNumber] = {
  //             flatNumber: record.flatNumber,
  //             name: record.name,
  //             loginTime: new Date(record.loginTime).toLocaleTimeString(),
  //             voteTime: record.voteTime ? new Date(record.voteTime).toLocaleTimeString() : null,
  //             voted: record.voted,
  //             rejected: Boolean(record.rejected),
  //             rejectedAt: record.rejectedAt ? new Date(record.rejectedAt).toLocaleTimeString() : null
  //           }
  //         })
  //       }
  //       setLiveAttendance(attendanceMap)
        
  //       // Fetch election results
  //       const results = await voteAPI.getResults(ELECTION_ID)
  //       console.log('📊 Election Results:', results)
  //       setLiveResults(results.results || {})

  //       // Fetch finalized/cancelled stats if available
  //       try {
  //         const finalized = await resultsAPI.getFinalizedResults(ELECTION_ID)
  //         if (finalized?.results?.statistics) {
  //           setRejectedVotes(finalized.results.statistics.rejectedVotes || 0)
  //           setResultsStatus(finalized.results.electionStatus || 'declared')
  //         }
  //       } catch (finalErr) {
  //         setResultsStatus('ongoing')
  //         setRejectedVotes(0)
  //       }
        
  //       setLoading(false)
  //     } catch (error) {
  //       console.error('❌ Error fetching real-time data:', error)
  //       setError(`Error loading data: ${error.message}`)
  //       setLoading(false)
  //     }
  //   }

  //   // Initial fetch
  //   fetchRealtimeData()

  //   // Set up polling to refresh data every 5 seconds
  //   const pollInterval = setInterval(fetchRealtimeData, 5000)
    
  //   return () => clearInterval(pollInterval)
  // }, [setElectionData, ELECTION_ID, refreshKey, scheduleEditedAt, scheduleDirty])
  useEffect(() => {
    const fetchRealtimeData = async () => {
      try {
        console.log('📊 AdminPanel: Fetching real-time admin data...');
        setError('');

        const scheduleLocked =
          scheduleDirty || (scheduleEditedAt && Date.now() - scheduleEditedAt < 4000);

        // Helper: convert ISO/UTC to PKT string "YYYY-MM-DDTHH:mm"
        const toPKTInputFormat = (isoDateStr) => {
          if (!isoDateStr) return '';
          const date = new Date(isoDateStr);
          // Convert to PKT using Intl API
          const pktStr = date.toLocaleString('en-CA', {
            timeZone: 'Asia/Karachi',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          // Replace "/" with "-" for input[type=datetime-local]
          return pktStr.replace(/\//g, '-').replace(', ', 'T');
        };

        // Fetch latest election status
        try {
          const statusResp = await adminAPI.getElectionStatus(ELECTION_ID);
          if (statusResp?.election) {
            const { isOpen, startDate, endDate, autoOpenEnabled: autoMode } =
              statusResp.election;
            const sched = statusResp.schedule || {};

            if (isOpen !== undefined) {
              setIsOpenLocal(isOpen);
              localStorage.setItem('electionIsOpen', isOpen.toString());
              setElectionData((prev) => ({ ...prev, isOpen }));
            }

            // Avoid overwriting user edits
            if (!scheduleDirty) {
              const startVal = sched.startDate || startDate;
              const endVal = sched.endDate || endDate;

              const nextStart = toPKTInputFormat(startVal);
              const nextEnd = toPKTInputFormat(endVal);

              setScheduleStart((prev) => (prev === nextStart ? prev : nextStart));
              setScheduleEnd((prev) => (prev === nextEnd ? prev : nextEnd));
              setAutoOpenEnabled(Boolean(sched.autoOpenEnabled ?? autoMode));
            }
          }
        } catch (statusErr) {
          console.warn('Could not fetch election status:', statusErr.message);
        }

        // Fetch candidates
        const candidatesData = await candidateAPI.getCandidates(ELECTION_ID);
        console.log('📋 Candidates fetched:', candidatesData);
        if (candidatesData && candidatesData.length > 0) {
          setElectionData((prev) => ({ ...prev, candidates: candidatesData }));
        }

        // Fetch attendance report
        const attendanceReport = await attendanceAPI.getAttendanceReport(ELECTION_ID);
        console.log('📋 Attendance Report:', attendanceReport);

        const attendanceMap = {};
        if (attendanceReport.report?.attendanceList) {
          attendanceReport.report.attendanceList.forEach((record) => {
            const pktLoginTime = record.loginTime
              ? new Date(record.loginTime).toLocaleTimeString('en-US', {
                  timeZone: 'Asia/Karachi',
                  hour12: false,
                })
              : null;

            const pktVoteTime = record.voteTime
              ? new Date(record.voteTime).toLocaleTimeString('en-US', {
                  timeZone: 'Asia/Karachi',
                  hour12: false,
                })
              : null;

            const pktRejectedAt = record.rejectedAt
              ? new Date(record.rejectedAt).toLocaleTimeString('en-US', {
                  timeZone: 'Asia/Karachi',
                  hour12: false,
                })
              : null;

            attendanceMap[record.flatNumber] = {
              flatNumber: record.flatNumber,
              name: record.name,
              loginTime: pktLoginTime,
              voteTime: pktVoteTime,
              voted: record.voted,
              rejected: Boolean(record.rejected),
              rejectedAt: pktRejectedAt,
            };
          });
        }
        setLiveAttendance(attendanceMap);

        // Fetch election results
        const results = await voteAPI.getResults(ELECTION_ID);
        console.log('📊 Election Results:', results);
        setLiveResults(results.results || {});

        // Fetch finalized/cancelled stats
        try {
          const finalized = await resultsAPI.getFinalizedResults(ELECTION_ID);
          if (finalized?.results?.statistics) {
            setRejectedVotes(finalized.results.statistics.rejectedVotes || 0);
            setResultsStatus(finalized.results.electionStatus || 'declared');
          }
        } catch (finalErr) {
          setResultsStatus('ongoing');
          setRejectedVotes(0);
        }

        setLoading(false);
      } catch (error) {
        console.error('❌ Error fetching real-time data:', error);
        setError(`Error loading data: ${error.message}`);
        setLoading(false);
      }
    };

    // Initial fetch
    fetchRealtimeData();

    // Poll every 5 seconds
    const pollInterval = setInterval(fetchRealtimeData, 5000);
    return () => clearInterval(pollInterval);
  }, [setElectionData, ELECTION_ID, refreshKey, scheduleEditedAt, scheduleDirty]);

  const handleAddCandidate = async () => {
    if (!newCandidate.name?.trim() || !newCandidate.position?.trim()) {
      setError('Please enter candidate name and position')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      console.log('📝 Adding candidate to database:', newCandidate)
      
      const candidateData = {
        name: newCandidate.name.trim(),
        position: newCandidate.position.trim(),
        flatNumber: newCandidate.flatNumber?.trim() || '',
        wing: newCandidate.wing || '',
        description: newCandidate.description?.trim() || '',
        electionId: ELECTION_ID
      }

      const response = await candidateAPI.createCandidate(candidateData)
      console.log('✅ Candidate created:', response)

      if (!response.success) {
        throw new Error(response.message || 'Failed to create candidate')
      }

      // Refresh candidates from API
      const updatedCandidates = await candidateAPI.getCandidates(ELECTION_ID)
      setElectionData(prev => ({
        ...prev,
        candidates: Array.isArray(updatedCandidates) ? updatedCandidates : updatedCandidates.candidates || prev.candidates
      }))

      setNewCandidate({ name: '', position: '', flatNumber: '', wing: '', description: '' })
      setShowAddForm(false)
    } catch (error) {
      console.error('❌ Error adding candidate:', error)
      setError(error.message || 'Failed to add candidate')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateCandidate = async () => {
    if (!editingCandidate || !editingCandidate.name?.trim()) {
      setError('Please enter candidate name')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const candidateId = editingCandidate._id || editingCandidate.id
      console.log('📝 Updating candidate:', candidateId)

      const response = await candidateAPI.updateCandidate(candidateId, {
        name: editingCandidate.name.trim(),
        position: editingCandidate.position,
        flatNumber: editingCandidate.flatNumber?.trim() || '',
        wing: editingCandidate.wing || '',
        description: editingCandidate.description?.trim() || ''
      })

      if (!response.success) {
        throw new Error(response.message || 'Failed to update candidate')
      }

      console.log('✅ Candidate updated:', response)

      // Refresh candidates from API
      const updatedCandidates = await candidateAPI.getCandidates(ELECTION_ID)
      setElectionData(prev => ({
        ...prev,
        candidates: Array.isArray(updatedCandidates) ? updatedCandidates : updatedCandidates.candidates || prev.candidates
      }))

      setEditingCandidate(null)
    } catch (error) {
      console.error('❌ Error updating candidate:', error)
      setError(error.message || 'Failed to update candidate')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteCandidate = async (candidateId) => {
    if (!window.confirm('Are you sure you want to delete this candidate?')) {
      return
    }

    setActionLoading(true)
    setError('')

    try {
      console.log('🗑️ Deleting candidate:', candidateId)
      
      const response = await candidateAPI.deleteCandidate(candidateId)
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete candidate')
      }

      console.log('✅ Candidate deleted')

      // Refresh candidates from API
      const updatedCandidates = await candidateAPI.getCandidates(ELECTION_ID)
      setElectionData(prev => ({
        ...prev,
        candidates: Array.isArray(updatedCandidates) ? updatedCandidates : updatedCandidates.candidates || prev.candidates
      }))
    } catch (error) {
      console.error('❌ Error deleting candidate:', error)
      setError(error.message || 'Failed to delete candidate')
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleElection = async () => {
    const next = !isOpenLocal
    setActionLoading(true)
    setError('')
    try {
      const response = await adminAPI.setElectionStatus(ELECTION_ID, next)
      if (!response.success && response.election?.isOpen === undefined) {
        throw new Error(response.message || 'Failed to update election status')
      }
      const newState = response.election?.isOpen ?? next
      setIsOpenLocal(newState)
      localStorage.setItem('electionIsOpen', newState.toString())
      setAutoOpenEnabled(Boolean(response.election?.autoOpenEnabled))
      setElectionData(prevState => ({ ...prevState, isOpen: newState }))
    } catch (err) {
      console.error('Error toggling election:', err)
      setError(err.message || 'Failed to toggle election')
    } finally {
      setActionLoading(false)
    }
  }

  const onScheduleStartChange = (e) => {
    setScheduleStart(e.target.value)
    setScheduleEditedAt(Date.now())
    setScheduleDirty(true)
  }

  const onScheduleEndChange = (e) => {
    setScheduleEnd(e.target.value)
    setScheduleEditedAt(Date.now())
    setScheduleDirty(true)
  }

  const onAutoToggleChange = (e) => {
    setAutoOpenEnabled(e.target.checked)
    setScheduleEditedAt(Date.now())
    setScheduleDirty(true)
  }

  const handleScheduleSave = async () => {
    if (!scheduleStart || !scheduleEnd) {
      setError('Please select both start and end date/time for the schedule')
      return
    }

    const startISO = new Date(scheduleStart)
    const endISO = new Date(scheduleEnd)

    if (startISO >= endISO) {
      setError('Schedule start must be before end')
      return
    }

    setActionLoading(true)
    setError('')
    try {
      const response = await adminAPI.updateElectionSchedule(ELECTION_ID, {
        startDate: startISO,
        endDate: endISO,
        autoOpenEnabled
      })
      if (!response.success) {
        throw new Error(response.message || 'Failed to update schedule')
      }
      const updated = response.election
      const schedule = response.schedule || {}
      setIsOpenLocal(updated.isOpen)
      localStorage.setItem('electionIsOpen', updated.isOpen.toString())
      const startVal = schedule.startDate || updated.startDate
      const endVal = schedule.endDate || updated.endDate
      if (startVal) setScheduleStart(new Date(startVal).toISOString().slice(0, 16))
      if (endVal) setScheduleEnd(new Date(endVal).toISOString().slice(0, 16))
      setAutoOpenEnabled(Boolean(schedule.autoOpenEnabled ?? updated.autoOpenEnabled))
      setElectionData(prev => ({ ...prev, isOpen: updated.isOpen }))
      setScheduleEditedAt(0)
      setScheduleDirty(false)
    } catch (err) {
      console.error('Schedule update error:', err)
      setError(err.message || 'Failed to update schedule')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetElection = async () => {
    if (!window.confirm('This will clear all votes, results, attendance, and candidates for the next election. Continue?')) {
      return
    }
    setActionLoading(true)
    setError('')
    try {
      const response = await adminAPI.resetElection(ELECTION_ID, {
        startDate: scheduleStart ? new Date(scheduleStart) : undefined,
        endDate: scheduleEnd ? new Date(scheduleEnd) : undefined
      })
      if (!response.success) {
        throw new Error(response.message || 'Failed to reset election')
      }
      setIsOpenLocal(false)
      localStorage.setItem('electionIsOpen', 'false')
      setResultsFinalized(false)
      setResultsStatus('ongoing')
      setRejectedVotes(0)
      setLiveResults({})
      setLiveAttendance({})
      setVotedFlats([])
      setSelectedFlats([])
      setShowRejectModal(false)
      setElectionData(prev => ({ ...prev, candidates: [], isOpen: false }))
      setScheduleEditedAt(0)
      setScheduleDirty(false)
      alert('Election reset successfully. You can now set schedule and add candidates for the next election.')
    } catch (err) {
      console.error('Reset election error:', err)
      setError(err.message || 'Failed to reset election')
    } finally {
      setActionLoading(false)
    }
  }

  const positions = useMemo(() => {
    const fromData = [...new Set(electionData.candidates.map(c => c.position))].filter(Boolean)
    return fromData.length ? fromData : DEFAULT_POSITIONS
  }, [electionData.candidates])

  const voteStats = useMemo(() => {
    // Build stats from live results or fallback to electionData
    const stats = {}
    const positions_list = positions
    
    positions_list.forEach(position => {
      stats[position] = {}
      
      // Get candidates from either live results or electionData
      let candidates = []
      if (liveResults?.candidateResults?.[position]) {
        candidates = liveResults.candidateResults[position]
      } else {
        candidates = electionData.candidates.filter(c => c.position === position)
      }
      
      candidates.forEach(candidate => {
        const candidateId = candidate._id || candidate.id
        const votes = candidate.votes || 0
        stats[position][candidateId] = {
          name: candidate.name,
          votes: votes,
          percentage: 0
        }
      })
    })

    const totalVoters = liveResults?.totalVotes || Object.keys(liveAttendance).filter(k => liveAttendance[k].voted).length || 0

    positions_list.forEach(position => {
      Object.keys(stats[position]).forEach(candidateId => {
        if (totalVoters > 0) {
          stats[position][candidateId].percentage = 
            ((stats[position][candidateId].votes / totalVoters) * 100).toFixed(1)
        }
      })
    })

    return { stats, totalVoters }
  }, [liveResults, liveAttendance, electionData.candidates, positions])

  const totalFlats = 105 // A-1 to A-45 (45) + B-1 to B-60 (60)
  const participationRate = ((voteStats.totalVoters / totalFlats) * 100).toFixed(1)
  const votedCount = Object.values(liveAttendance).filter(a => a.voted).length
  const rejectedCount = Object.values(liveAttendance).filter(a => a.rejected).length
  const remainingApts = Math.max(totalFlats - votedCount, 0)
  
  const winners = useMemo(() => {
    const winnerList = {}
    Object.keys(voteStats.stats).forEach(position => {
      const positionResults = Object.entries(voteStats.stats[position])
        .sort((a, b) => b[1].votes - a[1].votes)
      if (positionResults.length > 0) {
        const [, data] = positionResults[0]
        winnerList[position] = data.name
      }
    })
    return winnerList
  }, [voteStats.stats])

  const handleFinalizeResults = async () => {
    try {
      console.log('📊 Finalizing results...')
      const response = await resultsAPI.declareResults(ELECTION_ID)
      console.log('✅ Results finalized:', response)
      
      setResultsFinalized(true)
      setShowFinalizeConfirm(false)
      setIsOpenLocal(false)
      localStorage.setItem('electionIsOpen', 'false')
      setElectionData(prev => ({
        ...prev,
        isOpen: false
      }))
      
      alert('✅ Election results have been officially declared and finalized!')
    } catch (error) {
      console.error('❌ Error finalizing results:', error)
      alert(`Error finalizing results: ${error.message}`)
    }
  }

  const handlePrintResults = () => {
    window.print()
  }

  const openRejectVotes = async () => {
    setActionLoading(true)
    setError('')
    try {
      const flats = await resultsAPI.getVotedFlats(ELECTION_ID)
      setVotedFlats(flats)
      setSelectedFlats(flats.map(f => f.flatNumber))
      setShowRejectModal(true)
    } catch (err) {
      console.error('Failed to load voted flats:', err)
      setError(err.message || 'Failed to load voted flats')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectVotes = async () => {
    if (!selectedFlats.length) {
      setError('Select at least one flat to reject votes')
      return
    }
    setActionLoading(true)
    setError('')
    try {
      const response = await resultsAPI.rejectVotes(ELECTION_ID, selectedFlats, true)
      if (!response.success) {
        throw new Error(response.message || 'Failed to reject votes')
      }
      setRejectedVotes(response.results?.votingStatistics?.rejectedVotes || rejectedVotes)
      setIsOpenLocal(false)
      localStorage.setItem('electionIsOpen', 'false')
      setElectionData(prev => ({ ...prev, isOpen: false }))
      setResultsStatus(response.results?.status || 'cancelled')
      setShowRejectModal(false)
      setRefreshKey(prev => prev + 1)

      // Refresh rejected flats state locally
      setVotedFlats(prev => prev.filter(f => !selectedFlats.includes(f.flatNumber)))
      setSelectedFlats([])

      alert('🚫 Selected votes have been rejected and the election is closed.')
    } catch (err) {
      console.error('Reject votes error:', err)
      setError(err.message || 'Failed to reject votes')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <div className="admin-container">
        <div className="admin-card">
        <h2>👤 Admin Dashboard</h2>
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
          <p>✅ Admin authenticated and dashboard loaded successfully</p>
        </div>

        {error && (
          <div style={{ 
            padding: '15px', 
            marginBottom: '20px', 
            backgroundColor: '#fee2e2', 
            color: '#991b1b', 
            borderRadius: '4px',
            border: '1px solid #fca5a5'
          }}>
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div style={{ 
            padding: '15px', 
            textAlign: 'center',
            color: '#666'
          }}>
            ⏳ Loading admin data from API...
          </div>
        )}

        <div className="admin-section">
          <h3>Election Control</h3>
          <div className="control-panel">
            <div className="status-info">
              <p>Election Status: <strong>{isOpenLocal ? '🔓 Open' : '🔒 Closed'}</strong></p>
              <p>Total Votes: <strong>{voteStats.totalVoters}</strong></p>
              <p>Total Candidates: <strong>{electionData.candidates.length}</strong></p>
              <p>Present Residents: <strong>{Object.keys(liveAttendance).length}</strong></p>
              <p>Residents Voted: <strong>{Object.values(liveAttendance).filter(a => a.voted).length}</strong></p>
              <p>Remaining Apartments: <strong>{remainingApts}</strong></p>
            </div>
            <button 
              className={`btn-${isOpenLocal ? 'danger' : 'primary'}`}
              onClick={handleToggleElection}
            >
              {isOpenLocal ? 'Close Election' : 'Open Election'}
            </button>
          </div>

          <div className="schedule-panel" style={{ marginTop: '14px', padding: '14px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb' }}>
            <h4 style={{ marginBottom: '10px' }}>Schedule & Auto Control</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', alignItems: 'center' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span>Voting Start (date & time)</span>
                <input type="datetime-local" value={scheduleStart} onChange={onScheduleStartChange} className="form-input" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span>Voting End (date & time)</span>
                <input type="datetime-local" value={scheduleEnd} onChange={onScheduleEndChange} className="form-input" />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <input type="checkbox" checked={autoOpenEnabled} onChange={onAutoToggleChange} />
                <span>Auto open/close within schedule</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
              <button className="btn-primary" onClick={handleScheduleSave} disabled={actionLoading}>Save Schedule</button>
              <button className="btn-secondary" onClick={handleResetElection} disabled={actionLoading}>Reset for Next Election</button>
            </div>
            <div style={{ marginTop: '6px', color: '#4b5563', fontSize: '0.9rem' }}>
              Auto mode opens voting between the scheduled start/end and closes it afterward. Manual toggle stays available.
            </div>
          </div>
        </div>

        <div className="admin-tabs">
          <button 
            className={`tab-btn ${activeTab === 'control' ? 'active' : ''}`}
            onClick={() => setActiveTab('control')}
          >
            Candidates
          </button>
          <button 
            className={`tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            Attendance ({Object.keys(liveAttendance).length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'finalize' ? 'active' : ''}`}
            onClick={() => setActiveTab('finalize')}
          >
            📊 Finalize Results
          </button>
        </div>

        {activeTab === 'control' && (
          <>
            <div className="admin-section">
              <h3>Manage Candidates</h3>
              
              {!showAddForm && !editingCandidate ? (
                <button 
                  className="btn-primary"
                  onClick={() => setShowAddForm(true)}
                  disabled={actionLoading}
                >
                  + Add New Candidate
                </button>
              ) : showAddForm ? (
                <div className="form-group" style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '15px' }}>Add New Candidate</h4>
                  <input
                    type="text"
                    placeholder="Candidate Name *"
                    value={newCandidate.name}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input"
                    style={{ marginBottom: '10px' }}
                  />
                  <select
                    value={newCandidate.position}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, position: e.target.value }))}
                    className="form-input"
                    style={{ marginBottom: '10px' }}
                  >
                    <option value="">Select Position *</option>
                    {DEFAULT_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Flat Number (e.g., A-5)"
                    value={newCandidate.flatNumber}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, flatNumber: e.target.value.toUpperCase() }))}
                    className="form-input"
                    style={{ marginBottom: '10px' }}
                  />
                  <select
                    value={newCandidate.wing}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, wing: e.target.value }))}
                    className="form-input"
                    style={{ marginBottom: '10px' }}
                  >
                    <option value="">Select Wing</option>
                    <option value="A">Wing A</option>
                    <option value="B">Wing B</option>
                  </select>
                  <textarea
                    placeholder="Description (optional)"
                    value={newCandidate.description}
                    onChange={(e) => setNewCandidate(prev => ({ ...prev, description: e.target.value }))}
                    className="form-input"
                    style={{ marginBottom: '10px', minHeight: '60px' }}
                  />
                  <div className="form-actions" style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-primary" onClick={handleAddCandidate} disabled={actionLoading}>
                      {actionLoading ? 'Adding...' : 'Add Candidate'}
                    </button>
                    <button className="btn-secondary" onClick={() => {
                      setShowAddForm(false)
                      setNewCandidate({ name: '', position: '', flatNumber: '', wing: '', description: '' })
                      setError('')
                    }} disabled={actionLoading}>Cancel</button>
                  </div>
                </div>
              ) : editingCandidate && (
                <div className="form-group" style={{ backgroundColor: '#fef3c7', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '15px' }}>Edit Candidate</h4>
                  <input
                    type="text"
                    placeholder="Candidate Name *"
                    value={editingCandidate.name}
                    onChange={(e) => setEditingCandidate(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input"
                    style={{ marginBottom: '10px' }}
                  />
                  <select
                    value={editingCandidate.position}
                    onChange={(e) => setEditingCandidate(prev => ({ ...prev, position: e.target.value }))}
                    className="form-input"
                    style={{ marginBottom: '10px' }}
                  >
                    {DEFAULT_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Flat Number"
                    value={editingCandidate.flatNumber || ''}
                    onChange={(e) => setEditingCandidate(prev => ({ ...prev, flatNumber: e.target.value.toUpperCase() }))}
                    className="form-input"
                    style={{ marginBottom: '10px' }}
                  />
                  <select
                    value={editingCandidate.wing || ''}
                    onChange={(e) => setEditingCandidate(prev => ({ ...prev, wing: e.target.value }))}
                    className="form-input"
                    style={{ marginBottom: '10px' }}
                  >
                    <option value="">Select Wing</option>
                    <option value="A">Wing A</option>
                    <option value="B">Wing B</option>
                  </select>
                  <textarea
                    placeholder="Description"
                    value={editingCandidate.description || ''}
                    onChange={(e) => setEditingCandidate(prev => ({ ...prev, description: e.target.value }))}
                    className="form-input"
                    style={{ marginBottom: '10px', minHeight: '60px' }}
                  />
                  <div className="form-actions" style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-primary" onClick={handleUpdateCandidate} disabled={actionLoading}>
                      {actionLoading ? 'Updating...' : 'Update Candidate'}
                    </button>
                    <button className="btn-secondary" onClick={() => {
                      setEditingCandidate(null)
                      setError('')
                    }} disabled={actionLoading}>Cancel</button>
                  </div>
                </div>
              )}

              <div className="candidates-table">
                {positions.map(position => (
                  <div key={position} className="position-section">
                    <h4>{position}</h4>
                    <div className="candidates-list">
                      {electionData.candidates
                        .filter(c => c.position === position)
                        .map(candidate => {
                          const candidateId = candidate._id || candidate.id
                          return (
                            <div key={candidateId} className="candidate-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#fff', borderRadius: '4px', marginBottom: '8px', border: '1px solid #e5e7eb' }}>
                              <div className="candidate-details">
                                <div className="candidate-name" style={{ fontWeight: 'bold' }}>{candidate.name}</div>
                                {candidate.flatNumber && <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Flat: {candidate.flatNumber}</div>}
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  className="btn-secondary"
                                  onClick={() => setEditingCandidate({ ...candidate })}
                                  disabled={actionLoading}
                                  style={{ padding: '5px 12px', fontSize: '0.85rem' }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn-delete"
                                  onClick={() => handleDeleteCandidate(candidateId)}
                                  disabled={actionLoading}
                                  style={{ padding: '5px 12px', fontSize: '0.85rem' }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      {electionData.candidates.filter(c => c.position === position).length === 0 && (
                        <div style={{ padding: '10px', color: '#9ca3af', fontStyle: 'italic' }}>No candidates for this position</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Results navigation removed per request */}
          </>
        )}

        {activeTab === 'attendance' && (
          <div className="admin-section">
            <h3>📋 Attendance Report</h3>
            <div className="attendance-stats">
              <div className="stat-box">
                <h4>Total Present</h4>
                <p className="stat-number">{Object.keys(liveAttendance).length}</p>
              </div>
              <div className="stat-box">
                <h4>Already Voted</h4>
                <p className="stat-number voted">{Object.values(liveAttendance).filter(a => a.voted).length}</p>
              </div>
              <div className="stat-box">
                <h4>Not Yet Voted</h4>
                <p className="stat-number pending">{Object.values(liveAttendance).filter(a => !a.voted).length}</p>
              </div>
              <div className="stat-box">
                <h4>Remaining Apartments</h4>
                <p className="stat-number">{remainingApts}</p>
              </div>
              <div className="stat-box">
                <h4>Rejected Votes</h4>
                <p className="stat-number" style={{ color: '#b91c1c' }}>{rejectedCount}</p>
              </div>
            </div>

            <div className="attendance-table">
              <table>
                <thead>
                  <tr>
                    <th>Flat No.</th>
                    <th>Resident Name</th>
                    <th>Login Time</th>
                    <th>Vote Status</th>
                    <th>Vote Time</th>
                    <th>Rejection</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(liveAttendance).length > 0 ? (
                    Object.values(liveAttendance)
                      .sort((a, b) => a.flatNumber.localeCompare(b.flatNumber))
                      .map((record, idx) => (
                        <tr key={idx} className={record.voted ? 'voted' : record.rejected ? 'rejected' : 'pending'}>
                          <td className="flat-number"><strong>{record.flatNumber}</strong></td>
                          <td>{record.name}</td>
                          <td>{record.loginTime}</td>
                          <td>
                            <span className={`status-badge ${record.voted ? 'voted' : record.rejected ? 'rejected' : 'pending'}`}>
                              {record.rejected ? '🚫 Rejected' : record.voted ? '✓ Voted' : '⏳ Pending'}
                            </span>
                          </td>
                          <td>{record.voteTime || '-'}</td>
                          <td>
                            {record.rejected ? (
                              <span className="status-badge rejected">
                                Rejected {record.rejectedAt ? `@ ${record.rejectedAt}` : ''}
                              </span>
                            ) : (
                              <span className="status-badge muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>
                        No attendance records yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'finalize' && (
          <div className="admin-section">
            <div className="finalize-header">
              <h3>🏛️ ELECTION COMMITTEE OF ALLAH NOOR</h3>
              <div className="committee-subtitle">Results remain confidential during voting</div>
              <div className="muted-text" style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Shareable final results link (after declaration):</span>
                <span style={{ fontWeight: 600 }}>{window.location.origin}/#/final-results</span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/#/final-results`).catch(() => {})
                  }}
                >
                  Copy Link
                </button>
              </div>
            </div>

            {!resultsFinalized ? (
              <>
                <div style={{ padding: '12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', marginBottom: '16px' }}>
                  <strong>Confidential:</strong> Live results are hidden until compilation. Close voting, then click "Compile & Reveal Results" to finalize.
                </div>

                <div className="finalize-actions" style={{ marginTop: '10px' }}>
                  {!showFinalizeConfirm ? (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button 
                        className="btn-finalize"
                        onClick={() => setShowFinalizeConfirm(true)}
                        disabled={electionData.isOpen}
                      >
                        🔒 Compile & Reveal Results
                      </button>
                      <button
                        className="btn-danger"
                        onClick={openRejectVotes}
                        disabled={actionLoading}
                      >
                        🚫 Reject / Cancel Votes
                      </button>
                    </div>
                  ) : (
                    <div className="confirm-dialog">
                      <p>⚠️ Once compiled, results are revealed. Continue?</p>
                      <div className="confirm-actions">
                        <button 
                          className="btn-primary"
                          onClick={handleFinalizeResults}
                        >
                          Yes, Compile Results
                        </button>
                        <button 
                          className="btn-secondary"
                          onClick={() => setShowFinalizeConfirm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {electionData.isOpen && (
                    <div style={{ marginTop: '8px', color: '#b45309', fontSize: '0.9rem' }}>
                      Close the election first to enable compilation.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Election Statistics */}
                <div className="election-stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">🗳️</div>
                    <h4>Total Votes Cast</h4>
                    <p className="stat-value">{voteStats.totalVoters}</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🏢</div>
                    <h4>Total Flats</h4>
                    <p className="stat-value">{totalFlats}</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <h4>Participation Rate</h4>
                    <p className="stat-value">{participationRate}%</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">✓</div>
                    <h4>Present Residents</h4>
                    <p className="stat-value">{Object.keys(liveAttendance).length}</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🚫</div>
                    <h4>Rejected Votes</h4>
                    <p className="stat-value">{rejectedVotes}</p>
                  </div>
                </div>

                {/* Winners Section */}
                <div className="winners-section">
                  <h4>🏆 ELECTED MEMBERS</h4>
                  <div className="winners-list">
                    {Object.entries(winners).map(([position, name]) => (
                      <div key={position} className="winner-card">
                        <div className="winner-position">{position}</div>
                        <div className="winner-name">✓ {name}</div>
                        <div className="winner-votes">
                          {voteStats.stats[position] && 
                            Object.entries(voteStats.stats[position])
                              .find(([, data]) => data.name === name)?.[1].votes} votes
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detailed Results */}
                <div className="detailed-results">
                  <h4>📋 DETAILED VOTE COUNT BY POSITION</h4>
                  {positions.map(position => (
                    <div key={position} className="position-detailed">
                      <h5>{position}</h5>
                      <div className="detailed-votes-list">
                        {Object.entries(voteStats.stats[position] || {})
                          .sort((a, b) => b[1].votes - a[1].votes)
                          .map(([candidateId, data]) => (
                            <div key={candidateId} className="detailed-vote-row">
                              <span className="vote-name">{data.name}</span>
                              <span className="vote-count">{data.votes} votes ({data.percentage}%)</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="finalize-actions">
                  <div className="finalized-badge">
                    ✓ Results Officially Finalized
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn-print"
                      onClick={handlePrintResults}
                    >
                      🖨️ Print Official Results
                    </button>
                    <button
                      className="btn-danger"
                      onClick={openRejectVotes}
                      disabled={actionLoading}
                    >
                      🚫 Reject / Cancel Votes
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        </div>
      </div>

      {showRejectModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="modal-card" style={{ background: '#fff', padding: '20px', borderRadius: '8px', width: 'min(720px, 96vw)', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginBottom: '10px' }}>Select Flats to Reject Votes</h3>
            <p style={{ marginBottom: '10px', color: '#4b5563' }}>Only the selected flats will have their recorded votes removed. Election will be marked cancelled and closed.</p>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px' }}>
                      <input
                        type="checkbox"
                        checked={selectedFlats.length === votedFlats.length && votedFlats.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFlats(votedFlats.map(f => f.flatNumber))
                          } else {
                            setSelectedFlats([])
                          }
                        }}
                      />
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Flat</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Vote Time</th>
                  </tr>
                </thead>
                <tbody>
                  {votedFlats.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '12px', textAlign: 'center', color: '#9ca3af' }}>No voted flats to display</td>
                    </tr>
                  ) : (
                    votedFlats.map((flat, idx) => {
                      const checked = selectedFlats.includes(flat.flatNumber)
                      return (
                        <tr key={`${flat.flatNumber}-${idx}`} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '10px' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedFlats(prev => {
                                  if (e.target.checked) return [...new Set([...prev, flat.flatNumber])]
                                  return prev.filter(f => f !== flat.flatNumber)
                                })
                              }}
                            />
                          </td>
                          <td style={{ padding: '10px', fontWeight: 600 }}>{flat.flatNumber}</td>
                          <td style={{ padding: '10px' }}>{flat.name || 'Resident'}</td>
                          <td style={{ padding: '10px' }}>{flat.voteTime ? new Date(flat.voteTime).toLocaleString() : '-'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button className="btn-secondary" onClick={() => setShowRejectModal(false)} disabled={actionLoading}>Cancel</button>
              <button className="btn-danger" onClick={handleRejectVotes} disabled={actionLoading || selectedFlats.length === 0}>
                {actionLoading ? 'Rejecting...' : `Reject Selected (${selectedFlats.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default AdminPanel
