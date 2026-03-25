const mongoose = require('mongoose');

const hearingSchema = new mongoose.Schema({
  advocate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advocate',
    required: true
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  hearingDate: {
    type: Date,
    required: true
  },
  hearingTime: {
    type: String,
    required: true
  },
  courtName: {
    type: String,
    required: true
  },
  judgeName: String,
  purpose: {
    type: String,
    required: true
  },
  description: String,
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'postponed', 'cancelled', 'adjourned'],
    default: 'scheduled'
  },
  outcome: String,
  nextHearingDate: Date,
  nextHearingTime: String,
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderDate: Date,
  notes: String,
  isActive: {
    type: Boolean,
    default: true
  },
  documents: [{
    name: String,
    url: String,
    publicId: String
  }]
}, {
  timestamps: true
});

// Index for efficient date queries
hearingSchema.index({ hearingDate: 1, advocate: 1 });
hearingSchema.index({ case: 1, hearingDate: -1 });

module.exports = mongoose.model('Hearing', hearingSchema);
