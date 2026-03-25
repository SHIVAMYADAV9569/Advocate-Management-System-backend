const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole, clientOwnData } = require('../middleware/rbac');
const {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentStats,
  getPendingPayments,
  createOrder,
  verifyPayment
} = require('../controllers/paymentController');

router.use(protect);

// Razorpay payment routes
router.post('/create-order', createOrder);
router.post('/verify-payment', verifyPayment);

router.route('/')
  .get(getPayments)
  .post(checkRole('admin', 'lawyer'), createPayment);

router.route('/stats')
  .get(getPaymentStats);

router.route('/pending')
  .get(getPendingPayments);

router.route('/:id')
  .get(getPayment)
  .put(checkRole('admin', 'lawyer'), updatePayment)
  .delete(checkRole('admin'), deletePayment);

module.exports = router;
