const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  voterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voter',
    required: true,
    index: true
  },
  flatNumber: {
    type: String,
    required: true,
    index: true
  },
  name: String,
  electionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Election',
    required: true,
    index: true
  },
  loginTime: {
    type: Date,
    default: Date.now
  },
  voteTime: Date,
  voted: {
    type: Boolean,
    default: false,
    index: true
  },
  rejected: {
    type: Boolean,
    default: false,
    index: true
  },
  rejectedAt: Date,
  ipAddress: String,
  userAgent: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for faster queries
AttendanceSchema.index({ voterId: 1, electionId: 1 }, { unique: true });
AttendanceSchema.index({ electionId: 1, voted: 1 });
AttendanceSchema.index({ electionId: 1, rejected: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
