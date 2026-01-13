const mongoose = require('mongoose');

const resultsSchema = new mongoose.Schema({
  electionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Election',
    required: true,
    index: true
  },
  candidateResults: [{
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true
    },
    candidateName: String,
    totalVotes: {
      type: Number,
      default: 0
    },
    votedByFlats: [String], // Array of flat numbers that voted for this candidate
    position: String
  }],
  votingStatistics: {
    totalVoters: Number,
    totalFlats: Number,
    totalVotesCast: Number,
    votingPercentage: Number,
    nonVotingFlats: [String],
    rejectedVotes: {
      type: Number,
      default: 0
    }
  },
  electionStatus: {
    type: String,
    enum: ['ongoing', 'declared', 'finalized', 'cancelled'],
    default: 'ongoing'
  },
  declaredAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
resultsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Results', resultsSchema);
