const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advocate',
    required: true
  },
  type: {
    type: String,
    enum: ['hearing', 'payment', 'case_update', 'client', 'document', 'reminder', 'system'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedTo: {
    model: {
      type: String,
      enum: ['Case', 'Client', 'Hearing', 'Payment', 'Document']
    },
    id: mongoose.Schema.Types.ObjectId
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  actionUrl: String,
  sentVia: [{
    type: String,
    enum: ['app', 'email', 'sms']
  }]
}, {
  timestamps: true
});

// Index for unread notifications
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
