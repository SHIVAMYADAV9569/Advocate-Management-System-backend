const { Advocate } = require('../models');

// Enhanced role-based access control middleware
exports.checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} is not authorized to access this resource`
      });
    }

    next();
  };
};

// Admin only access
exports.adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Lawyer or Admin access
exports.lawyerOrAdmin = (req, res, next) => {
  if (!req.user || !['lawyer', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Lawyer or Admin access required'
    });
  }
  next();
};

// Client can only access their own data
exports.clientOwnData = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Admin and Lawyer can access all data
  if (['admin', 'lawyer'].includes(req.user.role)) {
    return next();
  }

  // Client can only access their own data
  if (req.user.role === 'client') {
    const clientId = req.params.clientId || req.params.id || req.body.clientId;
    
    // Check if the client is trying to access their own data
    if (clientId && clientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Clients can only access their own data'
      });
    }
  }

  next();
};

// Check if user can access case data
exports.caseAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin can access all cases
    if (req.user.role === 'admin') {
      return next();
    }

    const Case = require('../models/Case');
    const caseId = req.params.caseId || req.params.id;
    
    if (!caseId) {
      return res.status(400).json({
        success: false,
        message: 'Case ID is required'
      });
    }

    const caseData = await Case.findById(caseId).populate('client');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Lawyer can access cases they are assigned to
    if (req.user.role === 'lawyer') {
      if (caseData.lawyer && caseData.lawyer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Lawyer can only access assigned cases'
        });
      }
    }

    // Client can only access their own cases
    if (req.user.role === 'client') {
      if (caseData.client && caseData.client._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Client can only access their own cases'
        });
      }
    }

    req.caseData = caseData;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
