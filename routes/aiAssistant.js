const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  askLegalQuestion,
  getChatHistory,
  getSessionMessages,
  deleteChatSession
} = require('../controllers/aiAssistantController');

// All routes require authentication
router.use((req, res, next) => {
  console.log('🔐 Auth middleware triggered');
  console.log('🔐 Token present:', req.headers.authorization ? 'Yes' : 'No');
  protect(req, res, (err) => {
    if (err) {
      console.error('❌ Auth middleware error:', err);
      return res.status(500).json({
        success: false,
        message: 'Authentication error',
        error: err.message
      });
    }
    next();
  });
});

// Ask a legal question to AI
router.post('/ask', (req, res, next) => {
  console.log('📥 Route hit: POST /api/ai/ask');
  console.log('📥 Request body:', req.body);
  console.log('📥 Request headers:', req.headers);
  next();
}, askLegalQuestion);

// Get chat history (all sessions)
router.get('/history', getChatHistory);

// Get specific session messages
router.get('/history/:sessionId', getSessionMessages);

// Delete a chat session
router.delete('/history/:sessionId', deleteChatSession);

module.exports = router;
