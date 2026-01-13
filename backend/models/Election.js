const mongoose = require('mongoose');

const ElectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  autoOpenEnabled: {
    type: Boolean,
    default: false
  },
  isOpen: {
    type: Boolean,
    default: true,
    index: true
  },
  societyName: {
    type: String,
    default: 'Allah Noor'
  },
  positions: {
    type: [String],
    default: ['President', 'Vice President', 'General Secretary', 'Joint Secretary', 'Finance Secretary']
  },
  totalFlats: {
    wingA: { type: Number, default: 45 },
    wingB: { type: Number, default: 60 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Election', ElectionSchema);
