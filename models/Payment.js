const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  },
  invoiceNumber: {
    type: String,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentType: {
    type: String,
    enum: ['consultation', 'case_fee', 'hearing_fee', 'documentation', 'other'],
    default: 'case_fee'
  },
  description: String,
  paymentDate: {
    type: Date,
    default: Date.now
  },
  dueDate: Date,
  status: {
    type: String,
    enum: ['paid', 'pending', 'partial', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'check', 'bank_transfer', 'upi', 'online', 'other'],
    default: 'cash'
  },
  transactionId: String,
  isActive: {
    type: Boolean,
    default: true
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  receiptUrl: String,
  notes: String,
  isInvoiceGenerated: {
    type: Boolean,
    default: false
  },
  invoiceUrl: String
}, {
  timestamps: true
});

// Generate invoice number before saving
paymentSchema.pre('save', async function() {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Payment').countDocuments();
    this.invoiceNumber = `INV${String(count + 1).padStart(6, '0')}`;
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
