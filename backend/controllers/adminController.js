const Admin = require('../models/Admin');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const Vote = require('../models/Vote');
const Attendance = require('../models/Attendance');
const Results = require('../models/Results');
const Voter = require('../models/Voter');
const Schedule = require('../models/Schedule');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Login admin - optimized with lean query
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Use lean() for faster query - returns plain JS object
    const admin = await Admin.findOne({ username }).lean();
    if (!admin) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Generate JWT token with admin role
    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: 'admin' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('✅ Admin login successful:', { username: admin.username, token: token.substring(0, 20) + '...' });

    res.json({
      success: true,
      token,
      user: {
        id: admin._id,
        username: admin.username,
        name: admin.name,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
};

// Get admin profile
exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.userId).select('-password');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.json({
      success: true,
      admin
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper: compute and optionally persist effective open state when auto scheduling is enabled
const syncElectionOpenState = async (electionDoc) => {
  if (!electionDoc) return null;

  if (!electionDoc.autoOpenEnabled) {
    return electionDoc;
  }

  // Prefer persisted Schedule dates to avoid stale election fields
  const schedule = await Schedule.findOne({ electionId: electionDoc._id }).lean();
  const startSource = schedule?.startDate || electionDoc.startDate;
  const endSource = schedule?.endDate || electionDoc.endDate;

  // If schedule is missing or invalid, do not flip state
  if (!startSource || !endSource) {
    return electionDoc;
  }

  const start = new Date(startSource);
  const end = new Date(endSource);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return electionDoc;
  }

  const now = new Date();
  const withinWindow = now >= start && now <= end;

  let dirty = false;

  // Keep election document in sync with the latest schedule dates
  if (schedule) {
    if (!electionDoc.startDate || electionDoc.startDate.getTime() !== start.getTime()) {
      electionDoc.startDate = start;
      dirty = true;
    }
    if (!electionDoc.endDate || electionDoc.endDate.getTime() !== end.getTime()) {
      electionDoc.endDate = end;
      dirty = true;
    }
  }

  if (electionDoc.isOpen !== withinWindow) {
    electionDoc.isOpen = withinWindow;
    dirty = true;
  }

  if (dirty) {
    electionDoc.updatedAt = new Date();
    await electionDoc.save();
  }

  return electionDoc;
};

// Update election open/close status (manual override disables auto scheduling)
exports.setElectionStatus = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { isOpen, autoOpenEnabled } = req.body;

    if (typeof isOpen !== 'boolean' && typeof autoOpenEnabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isOpen (boolean) or autoOpenEnabled (boolean) is required' });
    }

    const update = { updatedAt: new Date() };

    if (typeof isOpen === 'boolean') {
      update.isOpen = isOpen;
      // Manual toggle turns off auto mode unless explicitly provided
      if (typeof autoOpenEnabled !== 'boolean') {
        update.autoOpenEnabled = false;
      }
    }

    if (typeof autoOpenEnabled === 'boolean') {
      update.autoOpenEnabled = autoOpenEnabled;
    }

    let election = await Election.findByIdAndUpdate(
      electionId,
      update,
      { new: true }
    );

    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    election = await syncElectionOpenState(election);

    res.json({ success: true, election });
  } catch (error) {
    console.error('Error setting election status:', error);
    res.status(500).json({ success: false, message: 'Failed to update election status' });
  }
};

// Update election schedule and auto open/close behaviour
exports.updateElectionSchedule = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { startDate, endDate, autoOpenEnabled = true } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate or endDate' });
    }

    if (start >= end) {
      return res.status(400).json({ success: false, message: 'startDate must be before endDate' });
    }

    const now = new Date();
    const withinWindow = autoOpenEnabled && now >= start && now <= end;

    let election = await Election.findByIdAndUpdate(
      electionId,
      { startDate: start, endDate: end, autoOpenEnabled, isOpen: withinWindow, updatedAt: new Date() },
      { new: true }
    );

    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    // Persist schedule separately for stability
    await Schedule.findOneAndUpdate(
      { electionId },
      { startDate: start, endDate: end, autoOpenEnabled, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    // Ensure results document exists and statistics align with voter count
    const voterCount = await Voter.countDocuments();
    const totalFlats = voterCount || ((election.totalFlats?.wingA || 0) + (election.totalFlats?.wingB || 0));

    await Results.findOneAndUpdate(
      { electionId },
      {
        $setOnInsert: {
          candidateResults: [],
          electionStatus: 'ongoing',
          declaredAt: null,
          createdAt: new Date()
        },
        $set: {
          votingStatistics: {
            totalVoters: voterCount,
            totalFlats,
            totalVotesCast: 0,
            votingPercentage: 0,
            nonVotingFlats: [],
            rejectedVotes: 0
          },
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    election = await syncElectionOpenState(election);

    res.json({ success: true, election, schedule: { startDate: start, endDate: end, autoOpenEnabled } });
  } catch (error) {
    console.error('Error updating election schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to update schedule' });
  }
};

// Reset election data for next cycle
exports.resetElection = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { startDate, endDate } = req.body || {};

    const election = await Election.findById(electionId);
    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    // Also clear schedule for next setup
    await Schedule.deleteOne({ electionId });

    const voterCount = await Voter.countDocuments();
    const totalFlats = voterCount || ((election.totalFlats?.wingA || 0) + (election.totalFlats?.wingB || 0));

    // Remove all election-linked data
    await Promise.all([
      Vote.deleteMany({ electionId }),
      Attendance.deleteMany({ electionId }),
      Results.deleteMany({ electionId }),
      Candidate.deleteMany({ electionId })
    ]);

    // Optionally set new schedule dates for next election
    if (startDate) {
      election.startDate = new Date(startDate);
    }
    if (endDate) {
      election.endDate = new Date(endDate);
    }

    election.isOpen = false;
    election.autoOpenEnabled = false;
    election.updatedAt = new Date();

    await election.save();

    // Seed a fresh empty results doc to avoid frontend 404s before first vote
    await Results.create({
      electionId,
      candidateResults: [],
      votingStatistics: {
        totalVoters: voterCount,
        totalFlats,
        totalVotesCast: 0,
        votingPercentage: 0,
        nonVotingFlats: [],
        rejectedVotes: 0
      },
      electionStatus: 'ongoing'
    });

    res.json({ success: true, message: 'Election reset successfully', election });
  } catch (error) {
    console.error('Error resetting election:', error);
    res.status(500).json({ success: false, message: 'Failed to reset election' });
  }
};

// Get election status
exports.getElectionStatus = async (req, res) => {
  try {
    const { electionId } = req.params;
    let election = await Election.findById(electionId);

    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    const schedule = await Schedule.findOne({ electionId }).lean();

    election = await syncElectionOpenState(election);

    const startDate = schedule?.startDate || election.startDate;
    const endDate = schedule?.endDate || election.endDate;

    // Compute effective open using latest schedule data
    let effectiveOpen = election.isOpen;
    if (election.autoOpenEnabled && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        const now = new Date();
        effectiveOpen = now >= start && now <= end;
        if (effectiveOpen !== election.isOpen) {
          election.isOpen = effectiveOpen;
          await election.save();
        }
      }
    }

    res.json({ success: true, election: {
      _id: election._id,
      name: election.name,
      isOpen: effectiveOpen,
      startDate,
      endDate,
      autoOpenEnabled: election.autoOpenEnabled
    }, schedule: schedule ? {
      startDate,
      endDate,
      autoOpenEnabled: schedule.autoOpenEnabled
    } : null });
  } catch (error) {
    console.error('Error fetching election status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch election status' });
  }
};
