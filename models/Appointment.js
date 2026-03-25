const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  advocate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advocate',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    default: 30
  },
  type: {
    type: String,
    enum: ['consultation', 'meeting', 'court', 'documentation', 'other'],
    default: 'consultation'
  },
  location: String,
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrencePattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    endDate: Date
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  notes: String
}, {
  timestamps: true
});

// Index for date queries
appointmentSchema.index({ advocate: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
