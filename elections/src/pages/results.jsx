import { useState, useEffect, useCallback } from 'react';
import { resultsAPI } from '../services/api';

function Results({ onNavigate, isPublic = false }) {
  const ELECTION_ID = import.meta.env.VITE_ELECTION_ID || '6957030455dee196ac3b31c4';
  const TOTAL_FLATS = 105;

  const [electionInfo, setElectionInfo] = useState(null);
  const [finalizedResults, setFinalizedResults] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading, no_election, not_started, ongoing, ended, declared
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Calculate countdown to target date
  const calculateCountdown = useCallback((targetDate) => {
    if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    const now = new Date().getTime();
    const target = new Date(targetDate).getTime();
    const diff = target - now;
    
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      total: diff
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        
        const statusData = await resultsAPI.getElectionScheduleStatus(ELECTION_ID);
        if (statusData?.election) {
          const info = statusData.election;
          setElectionInfo(info);
          
          // Check for no election scheduled
          if (!info.startDate && !info.endDate && !info.isOpen) {
            setPhase('no_election');
            return;
          }
          
          const electionPhase = info.phase;
          
          // Immediately calculate countdown based on phase
          if (electionPhase === 'not_started' && info.startDate) {
            setCountdown(calculateCountdown(info.startDate));
          } else if (electionPhase === 'ongoing' && info.endDate) {
            setCountdown(calculateCountdown(info.endDate));
          }
          
          if (electionPhase === 'declared') {
            try {
              const resultsData = await resultsAPI.getFinalizedResults(ELECTION_ID);
              console.log('Finalized results:', resultsData);
              // Unwrap the nested results object from API response
              const payload = resultsData.results || resultsData;
              setFinalizedResults(payload);
              setPhase('declared');
            } catch (err) {
              console.log('Results fetch error, showing ended:', err);
              setPhase('ended');
            }
          } else {
            setPhase(electionPhase);
            setFinalizedResults(null);
          }
        } else {
          setPhase('no_election');
        }
      } catch (err) {
        console.error('Error fetching election data:', err);
        setError(err.message || 'Failed to load election information');
        setPhase('error');
      }
    };

    fetchData();
    const poll = setInterval(fetchData, 8000);
    return () => clearInterval(poll);
  }, [ELECTION_ID, calculateCountdown]);

  // Countdown timer effect - runs every second
  useEffect(() => {
    let timer = null;
    
    const updateCountdown = () => {
      if (phase === 'not_started' && electionInfo?.startDate) {
        const newCountdown = calculateCountdown(electionInfo.startDate);
        setCountdown(newCountdown);
        return newCountdown.total > 0;
      } else if (phase === 'ongoing' && electionInfo?.endDate) {
        const newCountdown = calculateCountdown(electionInfo.endDate);
        setCountdown(newCountdown);
        return newCountdown.total > 0;
      }
      return false;
    };
    
    if ((phase === 'not_started' && electionInfo?.startDate) || 
        (phase === 'ongoing' && electionInfo?.endDate)) {
      // Start the interval timer
      timer = setInterval(() => {
        const shouldContinue = updateCountdown();
        if (!shouldContinue && timer) {
          clearInterval(timer);
        }
      }, 1000);
      
      // Run once immediately via timeout to avoid sync setState in effect
      const immediateTimeout = setTimeout(() => {
        updateCountdown();
      }, 0);
      
      return () => {
        if (timer) clearInterval(timer);
        clearTimeout(immediateTimeout);
      };
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [phase, electionInfo, calculateCountdown]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderCountdownBox = (value, label) => (
    <div className="countdown-box">
      <div className="countdown-value">{String(value).padStart(2, '0')}</div>
      <div className="countdown-label">{label}</div>
    </div>
  );

  const renderNoElection = () => (
    <div className="results-ongoing-card luxury no-election">
      <div className="no-election-icon">📋</div>
      <h2>No Active Election</h2>
      <p>There is currently no election scheduled or the election has been reset.</p>
      <p style={{ marginTop: '16px', color: '#94a3b8' }}>Please check back later for upcoming elections from the Allah Noor Elections Committee.</p>
    </div>
  );

  const renderNotStarted = () => (
    <div className="results-ongoing-card luxury">
      <div className="ongoing-badge">🗓️ Election Scheduled</div>
      <h2>Voting begins in</h2>
      
      <div className="countdown-container">
        {renderCountdownBox(countdown.days, 'Days')}
        <span className="countdown-separator">:</span>
        {renderCountdownBox(countdown.hours, 'Hours')}
        <span className="countdown-separator">:</span>
        {renderCountdownBox(countdown.minutes, 'Minutes')}
        <span className="countdown-separator">:</span>
        {renderCountdownBox(countdown.seconds, 'Seconds')}
      </div>

      <div className="schedule-info">
        <div className="schedule-row">
          <span className="schedule-label">📅 Start Time:</span>
          <span className="schedule-value">{formatDate(electionInfo?.startDate)}</span>
        </div>
        <div className="schedule-row">
          <span className="schedule-label">⏰ End Time:</span>
          <span className="schedule-value">{formatDate(electionInfo?.endDate)}</span>
        </div>
      </div>
      <p style={{ marginTop: '20px' }}>The Allah Noor Elections Committee will conduct the election as scheduled.</p>
    </div>
  );

  const renderOngoing = () => (
    <div className="results-ongoing-card luxury ongoing-active">
      <div className="ongoing-badge ongoing-pulse">🗳️ Voting In Progress</div>
      <h2>Time remaining to vote</h2>
      
      <div className="countdown-container">
        {renderCountdownBox(countdown.days, 'Days')}
        <span className="countdown-separator">:</span>
        {renderCountdownBox(countdown.hours, 'Hours')}
        <span className="countdown-separator">:</span>
        {renderCountdownBox(countdown.minutes, 'Minutes')}
        <span className="countdown-separator">:</span>
        {renderCountdownBox(countdown.seconds, 'Seconds')}
      </div>

      <div className="schedule-info">
        <div className="schedule-row">
          <span className="schedule-label">📅 Started:</span>
          <span className="schedule-value">{formatDate(electionInfo?.startDate)}</span>
        </div>
        <div className="schedule-row">
          <span className="schedule-label">⏰ Ends:</span>
          <span className="schedule-value">{formatDate(electionInfo?.endDate)}</span>
        </div>
      </div>
      <p style={{ marginTop: '20px' }}>Cast your vote now! Results will be published after voting concludes.</p>
    </div>
  );

  const renderEnded = () => (
    <div className="results-ongoing-card luxury ended-waiting">
      <div className="waiting-animation">
        <div className="waiting-spinner"></div>
      </div>
      <div className="ongoing-badge ended-badge">⏳ Voting Ended</div>
      <h2>Awaiting Results Declaration</h2>
      <div className="waiting-message">
        <p>The voting period has concluded.</p>
        <p>The Allah Noor Elections Committee is currently:</p>
        <ul className="waiting-steps">
          <li>✓ Collecting all votes</li>
          <li>✓ Verifying voter attendance</li>
          <li className="active">⏳ Compiling final results</li>
          <li className="pending">📊 Preparing official announcement</li>
        </ul>
      </div>
      <p className="waiting-note">Please check back shortly. Results will appear automatically once declared.</p>
    </div>
  );

  const renderDeclared = () => {
    if (!finalizedResults) return null;

    // Access the correct nested structure from API
    const stats = finalizedResults.statistics || {};
    const winnersList = finalizedResults.winners || [];
    const losersList = finalizedResults.losers || [];
    const allCandidates = finalizedResults.allCandidates || [...winnersList, ...losersList];
    const declaredAt = finalizedResults.declaredAt;

    const positions = new Set(allCandidates.map(c => c.position));
    const totalVotes = Number(stats.totalVotesCast ?? stats.totalVotes ?? 0);
    const totalVotesFallback = allCandidates.reduce((sum, c) => sum + Number(c.totalVotes || 0), 0);
    const votesDenominator = totalVotes > 0 ? totalVotes : totalVotesFallback;
    // Always use TOTAL_FLATS constant (105) if stats.totalFlats is 0 or undefined
    const totalFlatsFromStats = (Number(stats.totalFlats) > 0) ? Number(stats.totalFlats) : TOTAL_FLATS;
    const computedVotingPercentage = totalFlatsFromStats > 0 ? (totalVotes / totalFlatsFromStats) * 100 : 0;
    const votingPercentageRaw = stats.votingPercentage != null ? Number(stats.votingPercentage) : computedVotingPercentage;
    const votingPercentage = Number.isFinite(votingPercentageRaw) ? votingPercentageRaw : 0;
    const remainingApartments = Math.max(totalFlatsFromStats - totalVotes, 0);
    const nonVotingFlats = stats.nonVotingFlats || [];
    const rejectedVotes = Number(stats.rejectedVotes ?? 0);

    const computePct = (candidate) => {
      if (candidate.votePercentage != null && Number.isFinite(Number(candidate.votePercentage))) {
        return Number(candidate.votePercentage);
      }
      if (votesDenominator > 0) {
        return Number(((Number(candidate.totalVotes || 0) / votesDenominator) * 100).toFixed(2));
      }
      return 0;
    };

    // Group candidates by position for vs display
    const positionGroups = {};
    allCandidates.forEach(c => {
      if (!positionGroups[c.position]) {
        positionGroups[c.position] = [];
      }
      positionGroups[c.position].push({ ...c, votePercentage: computePct(c) });
    });
    // Sort each group by votes (winner first)
    Object.keys(positionGroups).forEach(pos => {
      positionGroups[pos].sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0));
    });

    const allCandidatesDisplay = allCandidates.map(c => ({ ...c, votePercentage: computePct(c) }));
    const winnerNames = new Set(Object.values(positionGroups).map(group => group[0]?.candidateName));

    console.log('Rendering declared with:', { stats, winnersList, losersList, totalVotes, allCandidates });

    return (
      <div className="luxury-results">
        <header className="luxury-header">
          <div className="header-left">
            <p className="eyebrow">Allah Noor Elections Committee</p>
            <h1>Official Election Results</h1>
            <p className="sub">Declared on {formatDate(declaredAt)}</p>
          </div>
          <div className="header-right">
            <span className="pill success">✓ Results Declared</span>
          </div>
        </header>

        <section className="luxury-stats">
          <div className="stat-card highlight">
            <div className="label">Total Votes Cast</div>
            <div className="value">{totalVotes}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Flats</div>
            <div className="value">{totalFlatsFromStats}</div>
          </div>
          <div className="stat-card highlight">
            <div className="label">Voting %</div>
            <div className="value">{votingPercentage.toFixed(2)}%</div>
          </div>
          <div className="stat-card">
            <div className="label">Did Not Vote</div>
            <div className="value">{remainingApartments}</div>
          </div>
          <div className="stat-card">
            <div className="label">Rejected Votes</div>
            <div className="value">{rejectedVotes}</div>
          </div>
          <div className="stat-card">
            <div className="label">Positions</div>
            <div className="value">{positions.size}</div>
          </div>
        </section>

        <section className="committee-panel">
          <h3>Election Committee</h3>
          <div className="committee-grid">
            <div className="committee-card">
              <div className="role">President</div>
              <div className="name">Daniyal Khan</div>
            </div>
            <div className="committee-card">
              <div className="role">Committee Member-1</div>
              <div className="name">Shahrukh</div>
            </div>
            <div className="committee-card">
              <div className="role">Committee Member-2</div>
              <div className="name">Najam us Sehar</div>
            </div>
          </div>
        </section>

        {/* Position-based Results with VS format */}
        <section className="position-results-section">
          <h3 className="section-title">🏆 Election Results by Position</h3>
          {Object.entries(positionGroups).map(([position, candidates]) => {
            const winner = candidates[0];
            const loser = candidates[1];
            return (
              <div key={position} className="position-battle-card">
                <div className="position-header">{position}</div>
                <div className="battle-container">
                  {/* Winner */}
                  <div className="candidate-side winner-side">
                    <div className="crown-badge">👑</div>
                    <div className="candidate-name">{winner?.candidateName || 'N/A'}</div>
                    <div className="candidate-stats">
                      <span className="votes-count">{winner?.totalVotes || 0} votes</span>
                      <span className="votes-percent">{winner?.votePercentage || 0}%</span>
                    </div>
                    <div className="status-badge winner-badge">WINNER</div>
                  </div>
                  
                  {/* VS Divider */}
                  {loser && (
                    <>
                      <div className="vs-divider">
                        <span className="vs-text">VS</span>
                      </div>
                      
                      {/* Loser */}
                      <div className="candidate-side loser-side">
                        <div className="candidate-name">{loser?.candidateName || 'N/A'}</div>
                        <div className="candidate-stats">
                          <span className="votes-count">{loser?.totalVotes || 0} votes</span>
                          <span className="votes-percent">{loser?.votePercentage || 0}%</span>
                        </div>
                        <div className="status-badge loser-badge">—</div>
                      </div>
                    </>
                  )}
                  
                  {/* Show if running unopposed */}
                  {!loser && (
                    <div className="unopposed-badge">Elected Unopposed</div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {allCandidatesDisplay.length > 0 && (
          <section className="luxury-table">
            <h3>📋 Full Candidate Tally</h3>
            <div className="table">
              <div className="row head">
                <div>Position</div>
                <div>Candidate</div>
                <div>Votes</div>
                <div>Vote %</div>
                <div>Status</div>
              </div>
              {allCandidatesDisplay.map((entry, index) => {
                const isWinner = winnerNames.has(entry.candidateName);
                return (
                  <div key={`tally-${entry.position}-${index}`} className={`row ${isWinner ? 'winner-row' : 'loser-row'}`}>
                    <div>{entry.position}</div>
                    <div className="strong">{entry.candidateName}</div>
                    <div>{entry.totalVotes}</div>
                    <div>{entry.votePercentage || 0}%</div>
                    <div>{isWinner ? '🏆 Winner' : '—'}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {nonVotingFlats.length > 0 && (
          <section className="nonvoting">
            <h3>Non-Voting Flats ({nonVotingFlats.length})</h3>
            <div className="pill-list">
              {nonVotingFlats.map(flat => (
                <span key={flat} className="pill muted">{flat}</span>
              ))}
            </div>
          </section>
        )}

        <footer className="luxury-footer">
          <p>Developed by Muhammad Ali Hadi</p>
        </footer>
      </div>
    );
  };

  return (
    <div className="results-container official-mode luxury-shell">
      {phase === 'loading' && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading election information...</p>
        </div>
      )}

      {phase === 'no_election' && renderNoElection()}
      {phase === 'not_started' && renderNotStarted()}
      {phase === 'ongoing' && renderOngoing()}
      {phase === 'ended' && renderEnded()}
      {phase === 'declared' && renderDeclared()}

      {error && phase === 'error' && (
        <div className="error-message">
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⚠️</div>
          {error}
        </div>
      )}

      {!isPublic && (
        <div className="results-actions" style={{ marginTop: '32px', textAlign: 'center' }}>
          <button 
            onClick={() => onNavigate('vote')} 
            className="btn-secondary"
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            ← Back to Voting
          </button>
        </div>
      )}
    </div>
  );
}

export default Results;
