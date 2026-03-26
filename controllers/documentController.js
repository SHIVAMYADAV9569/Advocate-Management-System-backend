const { Document, Case, Client } = require('../models');
const { uploadToCloudinary, cloudinary, upload } = require('../config/cloudinary');
const { deleteFromCloudinary, generateSignedUrl } = require('../utils/cloudinaryHelper');
const path = require('path');
const fs = require('fs');

// Upload Document
exports.uploadDocument = async (req, res) => {
  try {
    console.log('📤 Upload request received');
    console.log('   User:', req.user ? req.user._id : 'Not authenticated');
    console.log('   File:', req.file ? req.file.originalname : 'No file');
    console.log('   Body:', req.body);

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

    // Upload file to Cloudinary
    console.log('⬆️ Uploading file to Cloudinary...');
    const cloudinaryResourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer, req.file.originalname, cloudinaryResourceType);
    console.log('✅ File uploaded to Cloudinary:', cloudinaryResult.secure_url);

    // Get file info from Cloudinary
    const fileUrl = cloudinaryResult.secure_url;
    const publicId = cloudinaryResult.public_id;
    const fileSize = cloudinaryResult.bytes || req.file.size;
    const fileFormat = path.extname(req.file.originalname).substring(1);
    const resourceType = cloudinaryResourceType;

    console.log('📄 File details:', {
      url: fileUrl,
      publicId: publicId,
      size: fileSize,
      format: fileFormat,
      resourceType: resourceType
    });

    // Create document record in separate Document collection
    const document = new Document({
      advocate: req.user._id,
      client: clientId || null,
      case: caseId || null,
      name: name || req.file.originalname,
      type: type || 'other',
      category: category || 'general',
      url: fileUrl,
      publicId: publicId,
      format: fileFormat,
      size: fileSize,
      resourceType: resourceType,
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
            publicId: publicId, // IMPORTANT: Store publicId for deletion
            uploadedAt: new Date()
          }
        }
      });
      console.log(`📄 Document added to case ${caseId} documents array`);
    }

    console.log('✅ Document saved to database:', document._id);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully to Cloudinary',
      data: document
    });
  } catch (error) {
    console.error('❌ Error uploading document:', error);
    console.error('Stack trace:', error.stack);
    
    // If Cloudinary upload failed, delete the uploaded file
    if (req.file && req.file.filename) {
      try {
        const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
        await cloudinary.uploader.destroy(req.file.filename, { resource_type: resourceType });
        console.log('🗑️ Cleaned up failed upload from Cloudinary');
      } catch (deleteError) {
        console.error('Error deleting failed upload:', deleteError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed. Please try again.'
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

    // Generate signed URL for secure download (optional, for private files)
    let downloadUrl = document.url;
    
    // If document is confidential, generate a signed URL with expiration
    if (document.isConfidential) {
      const resourceType = document.resourceType || 'raw';
      const signedUrl = cloudinary.url(document.publicId, {
        resource_type: resourceType,
        secure: true,
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
        sign_url: true
      });
      downloadUrl = signedUrl;
    }

    res.status(200).json({
      success: true,
      data: {
        url: downloadUrl,
        name: document.name,
        format: document.format,
        size: document.size,
        isConfidential: document.isConfidential
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

    // Delete file from Cloudinary
    try {
      const resourceType = document.resourceType || 'raw';
      await cloudinary.uploader.destroy(document.publicId, { resource_type: resourceType });
      console.log(`Deleted ${resourceType} from Cloudinary: ${document.publicId}`);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Remove from case's embedded documents array if associated with a case
    if (document.case) {
      console.log(`🗑️ Attempting to remove document from case: ${document.case}`);
      console.log(`   Document publicId: ${document.publicId}`);
      
      const updateResult = await Case.findByIdAndUpdate(document.case, {
        $pull: {
          documents: { publicId: document.publicId }
        }
      });
      
      console.log(`✅ Case update result:`, updateResult ? 'Success' : 'Failed');
      console.log(`Removed document from case tracking: ${document.case}`);
    }

    // Delete from database
    await document.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully from Cloudinary and database'
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

// Get Document Preview/Thumbnail
exports.getDocumentPreview = async (req, res) => {
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

    // Generate preview URL based on resource type
    let previewUrl = document.url;
    
    if (document.resourceType === 'image') {
      // For images, return a resized thumbnail
      previewUrl = cloudinary.url(document.publicId, {
        resource_type: 'image',
        secure: true,
        width: 300,
        height: 200,
        crop: 'fill',
        quality: 'auto'
      });
    } else if (document.format === 'pdf') {
      // For PDFs, return the first page as image
      previewUrl = cloudinary.url(document.publicId, {
        resource_type: 'image',
        secure: true,
        format: 'jpg',
        width: 300,
        height: 400,
        crop: 'fill',
        quality: 'auto',
        page: 1
      });
    } else {
      // For other documents, return a generic icon or the original if small
      previewUrl = cloudinary.url(document.publicId, {
        resource_type: document.resourceType || 'raw',
        secure: true
      });
    }

    res.status(200).json({
      success: true,
      data: {
        previewUrl,
        name: document.name,
        format: document.format,
        resourceType: document.resourceType
      }
    });
  } catch (error) {
    console.error('Error getting document preview:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Export upload middleware for use in routes
exports.upload = upload;
