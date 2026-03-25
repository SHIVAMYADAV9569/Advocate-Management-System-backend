const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const advocateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  barNumber: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  specialization: [{
    type: String,
    enum: ['criminal', 'civil', 'family', 'property', 'corporate', 'tax', 'labor', 'constitutional']
  }],
  experience: {
    type: Number,
    default: 0
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  profileImage: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['admin', 'lawyer', 'client'],
    default: 'lawyer'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpiry: Date,
  resetPasswordToken: String,
  resetPasswordExpiry: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  totalClients: {
    type: Number,
    default: 0
  },
  totalCases: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  notificationPreferences: {
    emailNotifications: { type: Boolean, default: true },
    hearingReminders: { type: Boolean, default: true },
    paymentAlerts: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Hash password before saving
advocateSchema.pre('save', async function() {
  const advocate = this;
  if (!advocate.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(advocate.password, salt);
  advocate.password = hash;
});

// Compare password method
advocateSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Advocate', advocateSchema);
