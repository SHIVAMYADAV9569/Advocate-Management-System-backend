const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getDashboardStats,
  getMonthlyEarnings,
  getCalendarEvents
} = require('../controllers/dashboardController');

router.use(protect);

router.route('/stats')
  .get(getDashboardStats);

router.route('/earnings')
  .get(getMonthlyEarnings);

router.route('/calendar')
  .get(getCalendarEvents);

module.exports = router;
