const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  advocate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advocate',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  caseNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  trackingCode: {
    type: String,
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  courtName: {
    type: String,
    required: true
  },
  courtType: {
    type: String,
    enum: ['district', 'high', 'supreme', 'tribunal', 'other'],
    default: 'district'
  },
  caseType: {
    type: String,
    enum: ['criminal', 'civil', 'family', 'property', 'corporate', 'tax', 'labor', 'writ', 'appeal', 'other'],
    required: true
  },
  filingDate: {
    type: Date,
    required: true
  },
  registrationNumber: String,
  opponentName: String,
  opponentLawyer: String,
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['filed', 'pending', 'ongoing', 'hearing', 'judgment', 'won', 'lost', 'settled', 'dismissed', 'withdrawn'],
    default: 'filed'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  nextHearingDate: Date,
  judgmentDate: Date,
  judgmentSummary: String,
  fee: {
    total: {
      type: Number,
      default: 0
    },
    paid: {
      type: Number,
      default: 0
    },
    pending: {
      type: Number,
      default: 0
    }
  },
  timeline: [{
    date: {
      type: Date,
      default: Date.now
    },
    title: String,
    description: String,
    type: {
      type: String,
      enum: ['hearing', 'document', 'note', 'payment', 'status', 'other']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Advocate'
    }
  }],
  documents: [{
    name: String,
    type: {
      type: String,
      enum: ['petition', 'affidavit', 'evidence', 'judgment', 'other']
    },
    url: String,
    publicId: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Case', caseSchema);
