const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getHearings,
  getHearing,
  createHearing,
  updateHearing,
  deleteHearing,
  getTodaysHearings,
  getUpcomingHearings
} = require('../controllers/hearingController');

router.use(protect);

router.route('/')
  .get(getHearings)
  .post(createHearing);

router.route('/today')
  .get(getTodaysHearings);

router.route('/upcoming')
  .get(getUpcomingHearings);

router.route('/:id')
  .get(getHearing)
  .put(updateHearing)
  .delete(deleteHearing);

module.exports = router;
