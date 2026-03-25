const { Document, Case, Client } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer for file uploads to local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'));
    }
  },
});

// Upload Document
exports.uploadDocument = async (req, res) => {
  try {
    const { caseId, clientId, name, type, category, description, isConfidential } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Verify case or client exists and user has access
    if (caseId) {
      const caseData = await Case.findById(caseId);
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }
    }

    if (clientId) {
      const clientData = await Client.findById(clientId);
      if (!clientData) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }
    }

    // Get file info
    const fileUrl = `/uploads/${req.file.filename}`;
    const fileSize = req.file.size;
    const fileFormat = path.extname(req.file.originalname).substring(1);

    // Create document record in separate Document collection
    const document = new Document({
      advocate: req.user._id,
      client: clientId || null,
      case: caseId || null,
      name: name || req.file.originalname,
      type: type || 'other',
      category: category || 'general',
      url: fileUrl,
      publicId: req.file.filename, // Use filename as publicId
      format: fileFormat,
      size: fileSize,
      description: description || '',
      isConfidential: isConfidential || false,
    });

    await document.save();

    // Also add to case's embedded documents array for tracking
    if (caseId) {
      await Case.findByIdAndUpdate(caseId, {
        $push: {
          documents: {
            name: name || req.file.originalname,
            type: type || 'other',
            url: fileUrl,
            uploadedAt: new Date()
          }
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: document
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Documents
exports.getDocuments = async (req, res) => {
  try {
    const { caseId, clientId, type, category, page = 1, limit = 10 } = req.query;
    let filter = {};

    // Apply filters
    if (caseId) filter.case = caseId;
    if (clientId) filter.client = clientId;
    if (type) filter.type = type;
    if (category) filter.category = category;

    // Role-based filtering
    if (req.user.role === 'lawyer') {
      filter.advocate = req.user._id;
    } else if (req.user.role === 'client') {
      // Clients can only see documents shared with them or their case documents
      filter.$or = [
        { client: req.user._id },
        { sharedWith: req.user._id }
      ];
    }

    const documents = await Document.find(filter)
      .populate('client', 'name email')
      .populate('case', 'caseNumber title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Document.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Single Document
exports.getDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id)
      .populate('client', 'name email')
      .populate('case', 'caseNumber title');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'client') {
      const hasAccess = document.client && document.client._id.toString() === req.user._id.toString() ||
                       document.sharedWith.includes(req.user._id);
      
      if (!hasAccess && document.isConfidential) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Download Document
exports.downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'client') {
      const hasAccess = document.client && document.client.toString() === req.user._id.toString() ||
                       document.sharedWith.includes(req.user._id);
      
      if (!hasAccess && document.isConfidential) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Increment download count
    document.downloadCount += 1;
    document.lastDownloaded = new Date();
    await document.save();

    // Check if file exists
    const filePath = path.join(__dirname, '..', document.url);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Return file URL for frontend to handle download
    res.status(200).json({
      success: true,
      data: {
        url: document.url,
        name: document.name,
        format: document.format,
        size: document.size
      }
    });
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Document
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, category, description, isConfidential, sharedWith } = req.body;

    let document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check permissions (only admin and lawyer who uploaded can update)
    if (req.user.role === 'client') {
      return res.status(403).json({
        success: false,
        message: 'Clients cannot update documents'
      });
    }

    if (req.user.role === 'lawyer' && document.advocate.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own documents'
      });
    }

    // Update document
    document.name = name || document.name;
    document.type = type || document.type;
    document.category = category || document.category;
    document.description = description || document.description;
    document.isConfidential = isConfidential !== undefined ? isConfidential : document.isConfidential;
    document.sharedWith = sharedWith || document.sharedWith;

    await document.save();

    res.status(200).json({
      success: true,
      message: 'Document updated successfully',
      data: document
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Document
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    let document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check permissions (only admin and lawyer who uploaded can delete)
    if (req.user.role === 'client') {
      return res.status(403).json({
        success: false,
        message: 'Clients cannot delete documents'
      });
    }

    if (req.user.role === 'lawyer' && document.advocate.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own documents'
      });
    }

    // Delete file from local storage
    const filePath = path.join(__dirname, '..', document.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await document.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Share Document with Client
exports.shareDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.body;

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check permissions
    if (req.user.role === 'client') {
      return res.status(403).json({
        success: false,
        message: 'Clients cannot share documents'
      });
    }

    // Verify client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Add client to sharedWith array if not already there
    if (!document.sharedWith.includes(clientId)) {
      document.sharedWith.push(clientId);
      await document.save();
    }

    res.status(200).json({
      success: true,
      message: 'Document shared successfully',
      data: document
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Export upload middleware for use in routes
exports.upload = upload;
