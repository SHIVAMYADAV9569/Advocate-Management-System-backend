const { Payment, Client, Case, Notification } = require('../models');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Get all payments
exports.getPayments = async (req, res) => {
  try {
    const { client, case: caseId, status, from, to } = req.query;
    let query = { advocate: req.user.id };

    if (client) query.client = client;
    if (caseId) query.case = caseId;
    if (status) query.status = status;
    if (from || to) {
      query.paymentDate = {};
      if (from) query.paymentDate.$gte = new Date(from);
      if (to) query.paymentDate.$lte = new Date(to);
    }

    const payments = await Payment.find(query)
      .populate('client', 'name phone')
      .populate('case', 'caseNumber title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single payment
exports.getPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      advocate: req.user.id
    })
    .populate('client', 'name phone email')
    .populate('case', 'caseNumber title');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create payment
exports.createPayment = async (req, res) => {
  try {
    req.body.advocate = req.user.id;

    const payment = await Payment.create(req.body);

    // Update client payment stats
    if (req.body.status === 'paid') {
      await Client.findByIdAndUpdate(req.body.client, {
        $inc: { totalPayments: req.body.amount }
      });
    }

    // Update case fee stats if linked to case
    if (req.body.case) {
      const caseData = await Case.findById(req.body.case);
      if (caseData) {
        caseData.fee.paid += req.body.status === 'paid' ? req.body.amount : 0;
        caseData.fee.pending = caseData.fee.total - caseData.fee.paid;
        await caseData.save();
      }
    }

    // Create notification
    await Notification.create({
      recipient: req.user.id,
      type: 'payment',
      title: req.body.status === 'paid' ? 'Payment Received' : 'Payment Recorded',
      message: `Payment of ₹${req.body.amount} ${req.body.status === 'paid' ? 'received' : 'recorded'}`,
      relatedTo: { model: 'Payment', id: payment._id }
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update payment
exports.updatePayment = async (req, res) => {
  try {
    let payment = await Payment.findOne({
      _id: req.params.id,
      advocate: req.user.id
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Get the case to update its timeline
    const caseData = await Case.findById(payment.case);

    // Add timeline entry for significant payment updates
    const updates = [];
    
    if (req.body.status && req.body.status !== payment.status) {
      updates.push({
        date: new Date(),
        title: 'Payment Status Updated',
        description: `Payment status changed from ${payment.status} to ${req.body.status}`,
        type: 'payment',
        user: req.user.id
      });
    }

    if (req.body.amount && req.body.amount !== payment.amount) {
      updates.push({
        date: new Date(),
        title: 'Payment Amount Updated',
        description: `Payment amount updated from ₹${payment.amount} to ₹${req.body.amount}`,
        type: 'payment',
        user: req.user.id
      });
    }

    if (req.body.method && req.body.method !== payment.method) {
      updates.push({
        date: new Date(),
        title: 'Payment Method Updated',
        description: `Payment method changed to ${req.body.method}`,
        type: 'payment',
        user: req.user.id
      });
    }

    // Update the payment
    payment = await Payment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    // Add updates to case timeline if any
    if (updates.length > 0 && caseData) {
      await Case.findByIdAndUpdate(payment.case, {
        $push: { timeline: { $each: updates } }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete payment
exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      advocate: req.user.id
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    await payment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get payment statistics
exports.getPaymentStats = async (req, res) => {
  try {
    const stats = await Payment.aggregate([
      { $match: { advocate: req.user._id } },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          paidAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
          },
          pendingAmount: {
            $sum: { $cond: [{ $in: ['$status', ['pending', 'overdue']] }, '$amount', 0] }
          }
        }
      }
    ]);

    const monthlyStats = await Payment.aggregate([
      { $match: { advocate: req.user._id, status: 'paid' } },
      {
        $group: {
          _id: { $month: '$paymentDate' },
          amount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {},
        monthly: monthlyStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get pending payments
exports.getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.find({
      advocate: req.user.id,
      status: { $in: ['pending', 'overdue'] }
    })
    .populate('client', 'name phone')
    .populate('case', 'caseNumber title')
    .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create Razorpay Order
exports.createOrder = async (req, res) => {
  try {
    const { amount, caseId, paymentType } = req.body;

    if (!amount || !caseId) {
      return res.status(400).json({
        success: false,
        message: 'Amount and Case ID are required'
      });
    }

    // Verify case exists and user has access
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Create Razorpay order
    const options = {
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `receipt_${caseId}_${Date.now()}`,
      notes: {
        caseId: caseId,
        userId: req.user._id,
        paymentType: paymentType || 'case_fee'
      }
    };

    const order = await razorpay.orders.create(options);

    // Create payment record with pending status
    const payment = new Payment({
      advocate: caseData.advocate,
      client: caseData.client,
      case: caseId,
      amount: amount,
      paymentType: paymentType || 'case_fee',
      paymentMethod: 'online',
      razorpayOrderId: order.id,
      status: 'pending',
      description: `Online payment for case ${caseId}`
    });

    await payment.save();

    res.status(200).json({
      success: true,
      data: {
        order: order,
        paymentId: payment._id
      }
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Verify Payment
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'All payment verification details are required'
      });
    }

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // Update payment record
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.transactionId = razorpay_payment_id;
    payment.status = 'paid';
    payment.paymentDate = new Date();

    await payment.save();

    // Update case payment status if fully paid
    const caseData = await Case.findById(payment.case);
    if (caseData) {
      const totalPaid = await Payment.aggregate([
        { $match: { case: caseData._id, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const totalAmount = totalPaid[0]?.total || 0;
      if (totalAmount >= caseData.fees) {
        caseData.paymentStatus = 'paid';
      } else {
        caseData.paymentStatus = 'partial';
      }
      await caseData.save();
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
