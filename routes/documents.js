const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole, clientOwnData } = require('../middleware/rbac');
const {
  uploadDocument,
  getDocuments,
  getDocument,
  downloadDocument,
  updateDocument,
  deleteDocument,
  shareDocument,
  upload
} = require('../controllers/documentController');

router.use(protect);

// Upload document (Admin and Lawyer only)
router.post('/upload', 
  checkRole('admin', 'lawyer'),
  upload.single('file'),
  uploadDocument
);

// Get all documents with filters
router.get('/', getDocuments);

// Get single document
router.get('/:id', getDocument);

// Download document
router.get('/:id/download', downloadDocument);

// Update document (Admin and Lawyer only)
router.put('/:id', 
  checkRole('admin', 'lawyer'),
  updateDocument
);

// Delete document (Admin and Lawyer only)
router.delete('/:id', 
  checkRole('admin', 'lawyer'),
  deleteDocument
);

// Share document with client (Admin and Lawyer only)
router.post('/:id/share', 
  checkRole('admin', 'lawyer'),
  shareDocument
);

module.exports = router;
