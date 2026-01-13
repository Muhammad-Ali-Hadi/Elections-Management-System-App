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
          
          if (electionPhase === 'declared') {
            try {
              const resultsData = await resultsAPI.getFinalizedResults(ELECTION_ID);
              console.log('Finalized results:', resultsData);
              setFinalizedResults(resultsData);
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
  }, [ELECTION_ID]);

  // Countdown timer effect
  useEffect(() => {
    if (phase === 'not_started' && electionInfo?.startDate) {
      const timer = setInterval(() => {
        setCountdown(calculateCountdown(electionInfo.startDate));
      }, 1000);
      return () => clearInterval(timer);
    } else if (phase === 'ongoing' && electionInfo?.endDate) {
      const timer = setInterval(() => {
        setCountdown(calculateCountdown(electionInfo.endDate));
      }, 1000);
      return () => clearInterval(timer);
    }
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

    // Handle both nested and flat response structures
    const stats = finalizedResults.statistics || finalizedResults.votingStatistics || {};
    const winnersList = finalizedResults.winners || [];
    const losersList = finalizedResults.losers || [];
    const allCandidates = finalizedResults.allCandidates || [...winnersList, ...losersList];
    const declaredAt = finalizedResults.declaredAt;

    const positions = new Set(allCandidates.map(c => c.position));
    const totalVotes = stats.totalVotesCast || stats.totalVotes || 0;
    const votingPercentage = stats.votingPercentage || Math.round((totalVotes / TOTAL_FLATS) * 100);
    const remainingApartments = Math.max(TOTAL_FLATS - totalVotes, 0);
    const nonVotingFlats = stats.nonVotingFlats || [];

    console.log('Rendering declared with:', { stats, winnersList, losersList, totalVotes });

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
            <div className="value">{stats.totalFlats ?? TOTAL_FLATS}</div>
          </div>
          <div className="stat-card highlight">
            <div className="label">Voting %</div>
            <div className="value">{votingPercentage}%</div>
          </div>
          <div className="stat-card">
            <div className="label">Did Not Vote</div>
            <div className="value">{remainingApartments}</div>
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

        {winnersList.length > 0 && (
          <section className="winners-section">
            <h3 className="section-title">🏆 Elected Winners</h3>
            <div className="winners-grid luxury">
              {winnersList.map((winner, idx) => (
                <div key={`${winner.position}-${idx}`} className="winner-card-luxe">
                  <div className="winner-crown">👑</div>
                  <div className="position">{winner.position}</div>
                  <div className="name">{winner.candidateName}</div>
                  <div className="metrics">
                    <span className="votes">🗳️ {winner.totalVotes} votes</span>
                    <span className="percentage">📊 {winner.votePercentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {allCandidates.length > 0 && (
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
              {allCandidates.map((entry, index) => {
                const isWinner = winnersList.some(w => w.candidateName === entry.candidateName && w.position === entry.position);
                return (
                  <div key={`${entry.position}-${index}`} className={`row ${isWinner ? 'winner-row' : ''}`}>
                    <div>{entry.position}</div>
                    <div className="strong">{entry.candidateName}</div>
                    <div>{entry.totalVotes}</div>
                    <div>{entry.votePercentage}%</div>
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
