const express = require('express');
const router = express.Router();
const { trackCase, updateCaseStatus, getCasesForStatusManagement } = require('../controllers/trackingController');
const { protect } = require('../middleware/auth');

// Public route - no authentication required
router.get('/track/:trackingCode', trackCase);

// Protected routes - require authentication
router.get('/status-management', protect, getCasesForStatusManagement);
router.put('/status/:caseId', protect, updateCaseStatus);

module.exports = router;
