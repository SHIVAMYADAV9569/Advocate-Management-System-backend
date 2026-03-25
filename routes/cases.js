const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole, caseAccess } = require('../middleware/rbac');
const {
  getCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  addTimeline,
  getCaseStats
} = require('../controllers/caseController');

router.use(protect);

router.route('/')
  .get(getCases)
  .post(checkRole('admin', 'lawyer'), createCase);

router.route('/stats')
  .get(getCaseStats);

router.route('/:id')
  .get(caseAccess, getCase)
  .put(checkRole('admin', 'lawyer'), updateCase)
  .delete(checkRole('admin'), deleteCase);

router.route('/:id/timeline')
  .post(caseAccess, addTimeline);

module.exports = router;
