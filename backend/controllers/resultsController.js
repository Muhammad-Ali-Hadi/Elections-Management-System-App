const Results = require('../models/Results');
const Voter = require('../models/Voter');
const Candidate = require('../models/Candidate');
const Attendance = require('../models/Attendance');
const Election = require('../models/Election');
const mongoose = require('mongoose');
const Vote = require('../models/Vote');

// Get current results (ongoing) - optimized
exports.getCurrentResults = async (req, res) => {
  try {
    const { electionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(electionId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid election ID format' 
      });
    }

    const results = await Results.findOne({ electionId })
      .populate('candidateResults.candidateId', 'name position votes')
      .lean();
    
    if (!results) {
      return res.status(404).json({ 
        success: false,
        message: 'No results found for this election' 
      });
    }

    res.json({
      success: true,
      results,
      status: results.electionStatus
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch results' 
    });
  }
};

// Declare/Finalize results
exports.declareResults = async (req, res) => {
  try {
    const { electionId } = req.params;

    // Get all voters for this election
    const election = await Election.findById(electionId);
    const allVoters = await Voter.find({ electionId });
    const attendanceRecords = await Attendance.find({ electionId });

    // Calculate voting statistics
    const totalFlats = allVoters.length;
    const votersWhoVoted = attendanceRecords.filter(a => a.voted).length;
    const votingPercentage = totalFlats > 0 ? ((votersWhoVoted / totalFlats) * 100).toFixed(2) : 0;

    // Get non-voting flat numbers
    const votedFlatNumbers = attendanceRecords
      .filter(a => a.voted)
      .map(a => a.flatNumber);
    const nonVotingFlats = allVoters
      .map(v => v.flatNumber)
      .filter(flat => !votedFlatNumbers.includes(flat));

    // Update results document
    let results = await Results.findOne({ electionId });
    
    if (!results) {
      return res.status(404).json({ message: 'No results found' });
    }

    // Calculate winner and loser for each candidate
    const candidateStats = results.candidateResults.map(result => {
      const percentage = votersWhoVoted > 0 
        ? ((result.totalVotes / votersWhoVoted) * 100).toFixed(2) 
        : 0;
      return {
        ...result,
        votePercentage: percentage
      };
    });

    results.votingStatistics = {
      totalVoters: allVoters.length,
      totalFlats,
      totalVotesCast: votersWhoVoted,
      votingPercentage: parseFloat(votingPercentage),
      nonVotingFlats,
      rejectedVotes: results.votingStatistics?.rejectedVotes || 0
    };
    
    results.candidateResults = candidateStats;
    results.electionStatus = 'declared';
    results.declaredAt = new Date();

    await results.save();

    // Lock election for further voting once results are declared
    await Election.findByIdAndUpdate(electionId, { isOpen: false, autoOpenEnabled: false, updatedAt: new Date() });

    res.json({
      success: true,
      message: 'Results declared successfully',
      results,
      statistics: {
        totalFlats,
        totalVotesCast: votersWhoVoted,
        votingPercentage: parseFloat(votingPercentage),
        nonVotingCount: nonVotingFlats.length,
        nonVotingFlats,
        rejectedVotes: results.votingStatistics.rejectedVotes || 0
      }
    });
  } catch (error) {
    console.error('Error declaring results:', error);
    res.status(500).json({ message: error.message });
  }
};

// List flats that have recorded votes for an election
exports.getVotedFlats = async (req, res) => {
  try {
    const { electionId } = req.params;
    const votedRecords = await Attendance.find({ electionId, voted: true })
      .select('flatNumber name voteTime voterId')
      .sort({ flatNumber: 1 })
      .lean();

    res.json({
      success: true,
      flats: votedRecords.map(r => ({
        flatNumber: r.flatNumber,
        name: r.name,
        voteTime: r.voteTime,
        voterId: r.voterId
      }))
    });
  } catch (error) {
    console.error('Error fetching voted flats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch voted flats' });
  }
};

// Cancel/reject votes (admin) with per-flat selection
exports.rejectVotes = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { flats = [], cancelElection = true } = req.body || {};

    if (!Array.isArray(flats) || flats.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one flat to reject votes' });
    }

    const voteDocs = await Vote.find({ electionId, flatNumber: { $in: flats } }).lean();

    if (!voteDocs.length) {
      return res.status(404).json({ success: false, message: 'No votes found for the selected flats' });
    }

    const results = await Results.findOne({ electionId });
    if (!results) {
      return res.status(404).json({ success: false, message: 'No results found' });
    }

    // Aggregate vote impact per candidate and total rejected count
    const candidateImpact = {};
    let rejectedCount = 0;

    voteDocs.forEach(vote => {
      rejectedCount += 1;
      const candidateIds = vote.votes instanceof Map
        ? Array.from(vote.votes.values())
        : Object.values(vote.votes || {});

      candidateIds.forEach((candidateId) => {
        if (!candidateId) return;
        const key = candidateId.toString();
        candidateImpact[key] = (candidateImpact[key] || 0) + 1;
      });
    });

    // Delete votes and reset attendance for selected flats
    await Promise.all([
      Vote.deleteMany({ electionId, flatNumber: { $in: flats } }),
      Attendance.updateMany(
        { electionId, flatNumber: { $in: flats } },
        {
          $set: { voted: false, voteTime: null, rejected: true, rejectedAt: new Date() },
          $currentDate: { updatedAt: true }
        }
      )
    ]);

    // Decrement candidate tallies and remove flat references in results
    const candidateUpdatePromises = [];

    Object.entries(candidateImpact).forEach(([candidateId, count]) => {
      candidateUpdatePromises.push(
        Candidate.findByIdAndUpdate(candidateId, { $inc: { votes: -count } })
      );

      const candidateResult = results.candidateResults.find(cr => cr.candidateId.toString() === candidateId);
      if (candidateResult) {
        candidateResult.totalVotes = Math.max(0, (candidateResult.totalVotes || 0) - count);
        candidateResult.votedByFlats = (candidateResult.votedByFlats || []).filter(fn => !flats.includes(fn));
      }
    });

    // Update aggregate statistics
    const stats = results.votingStatistics || {};
    const currentTotal = stats.totalVotesCast || 0;
    const newTotal = Math.max(0, currentTotal - rejectedCount);

    results.votingStatistics = {
      ...stats,
      totalVotesCast: newTotal,
      rejectedVotes: (stats.rejectedVotes || 0) + rejectedCount
    };

    if (cancelElection) {
      results.electionStatus = 'cancelled';
    }

    await Promise.all(candidateUpdatePromises);
    await results.save();

    if (cancelElection) {
      await Election.findByIdAndUpdate(electionId, { isOpen: false, autoOpenEnabled: false, updatedAt: new Date() });
    }

    res.json({
      success: true,
      message: cancelElection ? 'Selected votes rejected and election closed' : 'Selected votes rejected',
      results: {
        status: results.electionStatus,
        votingStatistics: results.votingStatistics,
        rejectedFlats: flats
      }
    });
  } catch (error) {
    console.error('Error rejecting votes:', error);
    res.status(500).json({ success: false, message: 'Failed to reject votes' });
  }
};

// Get public election schedule status (no auth required)
exports.getElectionScheduleStatus = async (req, res) => {
  try {
    const { electionId } = req.params;
    const Election = require('../models/Election');
    const Schedule = require('../models/Schedule');

    const election = await Election.findById(electionId).select('isOpen name startDate endDate autoOpenEnabled').lean();
    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    const schedule = await Schedule.findOne({ electionId }).lean();
    const results = await Results.findOne({ electionId }).select('electionStatus declaredAt').lean();

    const startDate = schedule?.startDate || election.startDate;
    const endDate = schedule?.endDate || election.endDate;
    const now = new Date();

    let phase = 'not_started';
    if (results?.electionStatus === 'declared') {
      phase = 'declared';
    } else if (results?.electionStatus === 'cancelled') {
      phase = 'cancelled';
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (now < start) {
        phase = 'not_started';
      } else if (now >= start && now <= end) {
        phase = 'ongoing';
      } else {
        phase = 'ended';
      }
    } else if (election.isOpen) {
      phase = 'ongoing';
    }

    res.json({
      success: true,
      election: {
        name: election.name,
        isOpen: election.isOpen,
        startDate,
        endDate,
        phase,
        declaredAt: results?.declaredAt || null
      }
    });
  } catch (error) {
    console.error('Error fetching election schedule status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch election status' });
  }
};

// Get finalized results
exports.getFinalizedResults = async (req, res) => {
  try {
    const { electionId } = req.params;

    const results = await Results.findOne({ 
      electionId, 
      electionStatus: { $in: ['declared', 'cancelled'] }
    }).populate('candidateResults.candidateId');

    if (!results) {
      return res.status(404).json({ message: 'Results have not been declared yet' });
    }

    // Sort candidates by votes to identify winners and losers
    const sortedCandidates = [...results.candidateResults].sort((a, b) => b.totalVotes - a.totalVotes);
    
    // Group by position to find winners
    const positionGroups = {};
    sortedCandidates.forEach(candidate => {
      const position = candidate.position;
      if (!positionGroups[position]) {
        positionGroups[position] = [];
      }
      positionGroups[position].push(candidate);
    });

    const winners = [];
    const losers = [];

    Object.values(positionGroups).forEach(group => {
      if (group.length > 0) {
        winners.push(group[0]); // First is winner
        losers.push(...group.slice(1)); // Rest are losers
      }
    });

    res.json({
      success: true,
      results: {
        statistics: results.votingStatistics,
        winners: winners.map(w => ({
          candidateName: w.candidateName,
          position: w.position,
          totalVotes: w.totalVotes,
          votePercentage: w.votePercentage,
          votedBy: w.votedByFlats
        })),
        losers: losers.map(l => ({
          candidateName: l.candidateName,
          position: l.position,
          totalVotes: l.totalVotes,
          votePercentage: l.votePercentage,
          votedBy: l.votedByFlats
        })),
        allCandidates: sortedCandidates.map(c => ({
          candidateName: c.candidateName,
          position: c.position,
          totalVotes: c.totalVotes,
          votePercentage: c.votePercentage,
          votedByCount: c.votedByFlats.length
        })),
        declaredAt: results.declaredAt,
        electionStatus: results.electionStatus
      }
    });
  } catch (error) {
    console.error('Error fetching finalized results:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get results by position
exports.getResultsByPosition = async (req, res) => {
  try {
    const { electionId, position } = req.params;

    const results = await Results.findOne({ electionId });
    
    if (!results) {
      return res.status(404).json({ message: 'No results found' });
    }

    const positionResults = results.candidateResults.filter(r => r.position === position);

    res.json({
      success: true,
      position,
      statistics: results.votingStatistics,
      candidates: positionResults
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
