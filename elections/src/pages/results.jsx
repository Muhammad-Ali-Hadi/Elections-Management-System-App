import { useState, useEffect } from 'react';
import { resultsAPI } from '../services/api';

function Results({ onNavigate, isPublic = false }) {
  const ELECTION_ID = import.meta.env.VITE_ELECTION_ID || '6957030455dee196ac3b31c4';
  const TOTAL_FLATS = 105;

  const [electionInfo, setElectionInfo] = useState(null);
  const [finalizedResults, setFinalizedResults] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading, not_started, ongoing, ended, declared
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        
        // First get election schedule status
        const statusData = await resultsAPI.getElectionScheduleStatus(ELECTION_ID);
        if (statusData?.election) {
          setElectionInfo(statusData.election);
          const electionPhase = statusData.election.phase;
          
          // If declared, fetch full results
          if (electionPhase === 'declared') {
            try {
              const resultsData = await resultsAPI.getFinalizedResults(ELECTION_ID);
              const payload = resultsData.results || resultsData;
              setFinalizedResults(payload);
              setPhase('declared');
            } catch {
              setPhase('ended'); // Results not ready yet
            }
          } else {
            setPhase(electionPhase);
            setFinalizedResults(null);
          }
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

  const renderNotStarted = () => (
    <div className="results-ongoing-card luxury">
      <div className="ongoing-badge">🗓️ Voting Not Started</div>
      <h2>Elections will begin soon</h2>
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
      <p style={{ marginTop: '20px' }}>Please check back when voting opens. The Allah Noor Elections Committee will conduct the election as scheduled.</p>
    </div>
  );

  const renderOngoing = () => (
    <div className="results-ongoing-card luxury">
      <div className="ongoing-badge ongoing-pulse">🗳️ Voting In Progress</div>
      <h2>Elections are currently ongoing</h2>
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
      <p style={{ marginTop: '20px' }}>Results will be published after voting concludes and the Election Committee verifies all votes.</p>
    </div>
  );

  const renderEnded = () => (
    <div className="results-ongoing-card luxury">
      <div className="ongoing-badge ended-badge">⏳ Voting Ended</div>
      <h2>Waiting for results to be declared</h2>
      <p>The voting period has concluded. The Allah Noor Elections Committee is currently verifying and compiling the results.</p>
      <p style={{ marginTop: '16px', color: '#94a3b8' }}>Please check back shortly for the official announcement.</p>
    </div>
  );

  const renderDeclared = () => {
    if (!finalizedResults) return null;

    const statistics = finalizedResults.statistics || {};
    const winners = finalizedResults.winners || [];
    const losers = finalizedResults.losers || [];
    const positions = new Set([...winners, ...losers].map(c => c.position));
    const remainingApartments = Math.max(TOTAL_FLATS - (statistics.totalVotesCast || 0), 0);

    return (
      <div className="luxury-results">
        <header className="luxury-header">
          <div className="header-left">
            <p className="eyebrow">Allah Noor Elections Committee</p>
            <h1>Official Election Results</h1>
            <p className="sub">Declared on {formatDate(finalizedResults.declaredAt)}</p>
          </div>
          <div className="header-right">
            <span className="pill success">✓ Results Declared</span>
          </div>
        </header>

        <section className="luxury-stats">
          <div className="stat-card">
            <div className="label">Total Votes Cast</div>
            <div className="value">{statistics.totalVotesCast ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Flats</div>
            <div className="value">{statistics.totalFlats ?? TOTAL_FLATS}</div>
          </div>
          <div className="stat-card">
            <div className="label">Voting %</div>
            <div className="value">{statistics.votingPercentage ?? 0}%</div>
          </div>
          <div className="stat-card">
            <div className="label">Remaining</div>
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

        {winners.length > 0 && (
          <section className="winners-grid luxury">
            {winners.map((winner, idx) => (
              <div key={`${winner.position}-${idx}`} className="winner-card-luxe">
                <div className="position">{winner.position}</div>
                <div className="name">{winner.candidateName}</div>
                <div className="metrics">
                  <span>🗳️ {winner.totalVotes} votes</span>
                  <span>📊 {winner.votePercentage}%</span>
                </div>
              </div>
            ))}
          </section>
        )}

        {(winners.length > 0 || losers.length > 0) && (
          <section className="luxury-table">
            <h3>📋 Full Candidate Tally</h3>
            <div className="table">
              <div className="row head">
                <div>Position</div>
                <div>Candidate</div>
                <div>Votes</div>
                <div>Vote %</div>
              </div>
              {[...winners, ...losers].map((entry, index) => (
                <div key={`${entry.position}-${index}`} className="row">
                  <div>{entry.position}</div>
                  <div className="strong">{entry.candidateName}</div>
                  <div>{entry.totalVotes}</div>
                  <div>{entry.votePercentage}%</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {statistics.nonVotingFlats?.length > 0 && (
          <section className="nonvoting">
            <h3>Non-Voting Flats ({statistics.nonVotingFlats.length})</h3>
            <div className="pill-list">
              {statistics.nonVotingFlats.map(flat => (
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
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⏳</div>
          Loading election information...
        </div>
      )}

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
