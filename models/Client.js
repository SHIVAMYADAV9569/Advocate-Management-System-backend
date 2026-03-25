const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  advocate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advocate',
    required: true
  },
  clientId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  dateOfBirth: Date,
  occupation: String,
  aadharNumber: String,
  panNumber: String,
  caseType: {
    type: String,
    enum: ['criminal', 'civil', 'family', 'property', 'corporate', 'tax', 'labor', 'other']
  },
  referredBy: String,
  notes: String,
  documents: [{
    name: String,
    url: String,
    publicId: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'blacklisted'],
    default: 'active'
  },
  totalCases: {
    type: Number,
    default: 0
  },
  totalPayments: {
    type: Number,
    default: 0
  },
  pendingAmount: {
    type: Number,
    default: 0
  },
  history: [{
    action: String,
    description: String,
    date: {
      type: Date,
      default: Date.now
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Advocate'
    }
  }]
}, {
  timestamps: true
});

// Generate unique client ID before saving
clientSchema.pre('save', async function() {
  if (!this.clientId) {
    const count = await mongoose.model('Client').countDocuments();
    this.clientId = `CLI${String(count + 1).padStart(5, '0')}`;
  }
});

module.exports = mongoose.model('Client', clientSchema);
