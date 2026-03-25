const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  advocate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advocate',
    required: true
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['case', 'client', 'general', 'reminder'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  tags: [String],
  isPrivate: {
    type: Boolean,
    default: true
  },
  reminderDate: Date,
  isPinned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for search
noteSchema.index({ title: 'text', content: 'text', tags: 'text' });

module.exports = mongoose.model('Note', noteSchema);
