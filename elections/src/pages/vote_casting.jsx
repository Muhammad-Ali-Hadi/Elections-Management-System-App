import { useState, useEffect, useCallback } from 'react'
import { voteAPI, candidateAPI, attendanceAPI } from '../services/api'

function VoteCasting({ electionData, setElectionData, currentUser, onNavigate, recordVote }) {
  const [selectedCandidates, setSelectedCandidates] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [error, setError] = useState('')
  const [hasVotedFromAPI, setHasVotedFromAPI] = useState(false)
  const [isElectionOpen, setIsElectionOpen] = useState(true)

  const ELECTION_ID = electionData._id || electionData.electionId

  // Check if user has already voted on component mount
  useEffect(() => {
    const checkVoteStatus = async () => {
      if (!ELECTION_ID || !currentUser) {
        setCheckingStatus(false)
        return
      }

      try {
        console.log('🔍 Checking vote status for election:', ELECTION_ID)
        const response = await voteAPI.checkVoterStatus(ELECTION_ID)
        console.log('Vote status response:', response)
        
        if (response?.election) {
          setIsElectionOpen(response.election.isOpen !== false)
          setElectionData(prev => ({
            ...prev,
            isOpen: response.election.isOpen,
            name: response.election.name || prev.name,
            _id: response.election.id || prev._id || ELECTION_ID
          }))
        }

        if (response.hasVoted) {
          console.log('✅ User has already voted')
          setHasVotedFromAPI(true)
          // Update local state
          setElectionData(prev => ({
            ...prev,
            votes: {
              ...prev.votes,
              [currentUser.id]: {
                timestamp: response.vote?.timestamp || new Date().toLocaleString()
              }
            }
          }))
        }
      } catch (err) {
        console.error('Error checking vote status:', err)
      } finally {
        setCheckingStatus(false)
      }
    }

    checkVoteStatus()
  }, [ELECTION_ID, currentUser, setElectionData])

  // Clear selections from localStorage on fresh load (prevent stale data)
  useEffect(() => {
    // Only restore selections if user hasn't voted
    if (!hasVotedFromAPI && !checkingStatus) {
      const saved = localStorage.getItem('selectedCandidates')
      if (saved) {
        try {
          setSelectedCandidates(JSON.parse(saved))
        } catch {
          localStorage.removeItem('selectedCandidates')
        }
      }
    }
  }, [hasVotedFromAPI, checkingStatus])

  // Save selectedCandidates to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(selectedCandidates).length > 0) {
      localStorage.setItem('selectedCandidates', JSON.stringify(selectedCandidates))
    }
  }, [selectedCandidates])

  const hasVoted = hasVotedFromAPI || electionData.votes[currentUser?.id] !== undefined
  const electionClosed = !isElectionOpen
  const positions = [...new Set(electionData.candidates.map(c => c.position))]

  const handleVoteSelect = useCallback((candidateId, position) => {
    setSelectedCandidates(prev => ({
      ...prev,
      [position]: candidateId
    }))
  }, [])

  const handleSubmitVote = async () => {
    if (electionClosed) {
      setError('Voting is closed by the admin for this election.')
      return
    }

    if (hasVoted) {
      setError('You have already voted. You cannot vote again!')
      return
    }

    if (Object.keys(selectedCandidates).length !== positions.length) {
      setError('Please vote for all positions')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Validate that all candidates are valid ObjectIds
      for (const [position, candidateId] of Object.entries(selectedCandidates)) {
        if (!candidateId || typeof candidateId !== 'string' || !candidateId.match(/^[0-9a-f]{24}$/i)) {
          setError(`Invalid candidate selection for ${position}`)
          setLoading(false)
          return
        }
      }

      console.log('🗳️ Casting vote...')
      const response = await voteAPI.castVote(ELECTION_ID, selectedCandidates)
      
      if (!response.success) {
        throw new Error(response.message || 'Vote failed')
      }

      console.log('✅ Vote submitted successfully:', response)

      // Update local state after successful API call
      setElectionData(prev => ({
        ...prev,
        votes: {
          ...prev.votes,
          [currentUser.id]: {
            ...selectedCandidates,
            timestamp: new Date().toLocaleString()
          }
        }
      }))

      // Clear localStorage selections
      localStorage.removeItem('selectedCandidates')

      // Record vote in attendance
      if (recordVote) {
        recordVote(currentUser)
      }

      // Refresh candidates to show updated vote counts
      try {
        const updatedCandidates = await candidateAPI.getCandidates(ELECTION_ID)
        setElectionData(prev => ({
          ...prev,
          candidates: Array.isArray(updatedCandidates) ? updatedCandidates : updatedCandidates.candidates || prev.candidates
        }))
      } catch (refreshError) {
        console.warn('Could not refresh candidates:', refreshError)
      }

      setHasVotedFromAPI(true)
      setSubmitted(true)

      setTimeout(() => {
        onNavigate('profile')
      }, 2000)
    } catch (err) {
      console.error('Vote submission error:', err)
      
      // Check if the error indicates already voted
      if (err.message?.includes('already voted')) {
        setHasVotedFromAPI(true)
        setError('You have already voted in this election.')
      } else {
        setError(err.message || 'Failed to submit vote. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking status
  if (checkingStatus) {
    return (
      <div className="vote-container">
        <div className="vote-card" style={{ textAlign: 'center', padding: '40px' }}>
          <div>⏳ Checking your voting status...</div>
        </div>
      </div>
    )
  }

  if (hasVoted) {
    return (
      <div className="vote-container">
        <div className="success-message">
          <div className="success-icon">✓</div>
          <h2>Thank You for Voting!</h2>
          <p>Your vote has been successfully recorded</p>
          <p>Flat Number: {currentUser.flatNumber}</p>
          <button onClick={() => onNavigate('profile')} className="btn-primary">
            Go to My Profile
          </button>
        </div>
      </div>
    )
  }

  if (electionClosed) {
    return (
      <div className="vote-container">
        <div className="vote-card" style={{ textAlign: 'center', padding: '32px' }}>
          <h2>Voting Closed</h2>
          <p className="voter-info">Voting has been closed by the admin. You cannot cast a vote until it is reopened.</p>
          <button className="btn-secondary" onClick={() => onNavigate('profile')}>Return to Profile</button>
        </div>
      </div>
    )
  }

  return (
    <div className="vote-container">
      <div className="vote-card">
        <h2>Cast Your Vote</h2>
        <p className="voter-info">Voting as: {currentUser.name} ({currentUser.flatNumber})</p>

        {positions.map(position => (
          <div key={position} className="position-group">
            <h3>{position}</h3>
            <div className="candidates-list">
              {electionData.candidates
                .filter(c => c.position === position)
                .map((candidate) => {
                  const candidateId = candidate._id || candidate.id
                  return (
                    <button
                      key={candidateId}
                      className={`candidate-btn ${selectedCandidates[position] === candidateId ? 'selected' : ''}`}
                      onClick={() => handleVoteSelect(candidateId, position)}
                      disabled={loading || electionClosed}
                    >
                      <div className="candidate-radio">
                        {selectedCandidates[position] === candidateId && <div className="radio-inner"></div>}
                      </div>
                      <div className="candidate-info">
                        <div className="candidate-name">{candidate.name}</div>
                        <div className="candidate-position">{position}</div>
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>
        ))}

        <div className="vote-summary">
          <h4>Your Selections:</h4>
          {positions.length > 0 ? (
            <ul>
              {positions.map(position => (
                <li key={position}>
                  <strong>{position}:</strong> {
                    selectedCandidates[position]
                      ? electionData.candidates.find(c => (c._id || c.id) === selectedCandidates[position])?.name
                      : 'Not selected'
                  }
                </li>
              ))}
            </ul>
          ) : (
            <p>No positions available</p>
          )}
        </div>

        {error && <div className="error-message" style={{ marginBottom: '15px' }}>{error}</div>}

        <div className="vote-actions">
          <button
            className="btn-primary"
            onClick={handleSubmitVote}
            disabled={Object.keys(selectedCandidates).length !== positions.length || loading || electionClosed}
          >
            {loading ? 'Submitting...' : 'Submit Vote'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setSelectedCandidates({})
              localStorage.removeItem('selectedCandidates')
            }}
            disabled={loading}
          >
            Clear Selections
          </button>
        </div>

        {submitted && <div className="confirmation">Vote submitted successfully! Redirecting...</div>}
      </div>
    </div>
  )
}

export default VoteCasting
