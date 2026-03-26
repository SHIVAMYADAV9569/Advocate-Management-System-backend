const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  advocate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advocate',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['petition', 'affidavit', 'contract', 'agreement', 'evidence', 'judgment', 'notice', 'power_of_attorney', 'id_proof', 'address_proof', 'other'],
    default: 'other'
  },
  category: {
    type: String,
    enum: ['client', 'case', 'general'],
    default: 'general'
  },
  url: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  format: String,
  size: Number,
  resourceType: {
    type: String,
    enum: ['image', 'raw', 'video', 'auto'],
    default: 'raw'
  },
  tags: [String],
  description: String,
  isConfidential: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  }],
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloaded: Date
}, {
  timestamps: true
});

// Index for search
documentSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Document', documentSchema);
