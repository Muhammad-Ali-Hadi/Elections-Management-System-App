const Attendance = require('../models/Attendance');
const Voter = require('../models/Voter');
const mongoose = require('mongoose');

// Record attendance (when voter logs in) - optimized
exports.recordAttendance = async (req, res) => {
  try {
    const { electionId } = req.body;
    const voterId = req.userId;
    const flatNumber = req.userFlatNumber;

    if (!electionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Election ID is required' 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(electionId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid election ID format' 
      });
    }

    // Use findOneAndUpdate with upsert for atomic operation
    const voter = await Voter.findById(voterId).select('name').lean();
    
    const attendance = await Attendance.findOneAndUpdate(
      { voterId, electionId },
      { 
        $setOnInsert: {
          voterId,
          flatNumber,
          name: voter?.name || 'Unknown',
          electionId,
          loginTime: new Date(),
          voted: false,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Attendance recorded',
      attendance: {
        id: attendance._id,
        flatNumber: attendance.flatNumber,
        name: attendance.name,
        loginTime: attendance.loginTime,
        voted: attendance.voted
      }
    });
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to record attendance' 
    });
  }
};

// Get attendance report (Admin only) - optimized with aggregation
exports.getAttendanceReport = async (req, res) => {
  try {
    const { electionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(electionId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid election ID format' 
      });
    }

    // Use Promise.all for parallel queries
    const [attendance, totalRegistered] = await Promise.all([
      Attendance.find({ electionId })
        .select('voterId flatNumber name loginTime voteTime voted rejected rejectedAt')
        .sort({ flatNumber: 1 })
        .lean(),
      Voter.countDocuments()
    ]);

    // Calculate stats
    const totalPresent = attendance.length;
    const totalVoted = attendance.filter(a => a.voted).length;
    const presentButNotVoted = totalPresent - totalVoted;

    res.json({
      success: true,
      report: {
        totalRegistered,
        totalPresent,
        totalVoted,
        presentButNotVoted,
        votingPercentage: totalPresent > 0 ? ((totalVoted / totalPresent) * 100).toFixed(1) : 0,
        attendanceList: attendance
      }
    });
  } catch (error) {
    console.error('Error fetching attendance report:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch attendance report' 
    });
  }
};

// Get attendance by flat number - optimized
exports.getAttendanceByFlat = async (req, res) => {
  try {
    const { flatNumber, electionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(electionId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid election ID format' 
      });
    }

    const attendance = await Attendance.findOne({ flatNumber, electionId })
      .select('flatNumber name loginTime voteTime voted rejected rejectedAt')
      .lean();

    if (!attendance) {
      return res.status(404).json({ 
        success: false,
        message: 'Attendance record not found' 
      });
    }

    res.json({
      success: true,
      attendance
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch attendance' 
    });
  }
};

// Update vote status - optimized
exports.updateVoteStatus = async (req, res) => {
  try {
    const { attendanceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid attendance ID format' 
      });
    }

    const attendance = await Attendance.findByIdAndUpdate(
      attendanceId,
      { 
        voted: true, 
        voteTime: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    ).lean();

    if (!attendance) {
      return res.status(404).json({ 
        success: false,
        message: 'Attendance record not found' 
      });
    }

    res.json({
      success: true,
      message: 'Vote status updated',
      attendance
    });
  } catch (error) {
    console.error('Error updating vote status:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update vote status' 
    });
  }
};
