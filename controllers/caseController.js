const { Case, Client, Hearing, Payment } = require('../models');

// Get all cases
exports.getCases = async (req, res) => {
  try {
    const { search, status, priority, caseType, client } = req.query;
    let query = { advocate: req.user._id };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (caseType) query.caseType = caseType;
    if (client) query.client = client;

    if (search) {
      query.$or = [
        { caseNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { courtName: { $regex: search, $options: 'i' } }
      ];
    }

    const cases = await Case.find(query)
      .populate('client', 'name phone email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: cases.length,
      data: cases
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single case
exports.getCase = async (req, res) => {
  try {
    const caseData = await Case.findOne({
      _id: req.params.id,
      advocate: req.user.id
    }).populate('client', 'name phone email address');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Get related hearings
    const hearings = await Hearing.find({ case: caseData._id })
      .sort({ hearingDate: -1 });

    // Get related payments
    const payments = await Payment.find({ case: caseData._id })
      .sort({ createdAt: -1 });

    // Calculate fee information based on payments
    const paidAmount = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, payment) => sum + payment.amount, 0);
    
    const totalFee = caseData.fee.total;
    const pendingAmount = Math.max(0, totalFee - paidAmount);

    // Update case fee information
    caseData.fee.paid = paidAmount;
    caseData.fee.pending = pendingAmount;

    res.status(200).json({
      success: true,
      data: {
        case: caseData,
        hearings,
        payments
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create case
exports.createCase = async (req, res) => {
  try {
    console.log('Creating case with data:', req.body);
    console.log('User:', req.user);
    
    // Generate case number and tracking code
    const count = await Case.countDocuments();
    const caseNumber = `CASE${String(count + 1).padStart(6, '0')}`;
    const trackingCode = `TRK${String(count + 1).padStart(8, '0')}`;
    
    req.body.advocate = req.user._id;
    req.body.caseNumber = caseNumber;
    req.body.trackingCode = trackingCode;

    const caseData = new Case(req.body);
    
    // Add initial timeline entry
    caseData.timeline = [{
      date: new Date(),
      title: 'Case Created',
      description: 'Case was registered in the system',
      type: 'status',
      user: req.user._id
    }];

    await caseData.save();

    // Update client total cases only if client is provided
    if (req.body.client) {
      await Client.findByIdAndUpdate(req.body.client, {
        $inc: { totalCases: 1 }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Case created successfully',
      data: caseData
    });
  } catch (error) {
    console.error('Create case error:', error);
    console.error('Validation errors:', error.errors);
    res.status(500).json({
      success: false,
      message: error.message,
      details: error.errors
    });
  }
};

// Update case
exports.updateCase = async (req, res) => {
  try {
    let caseData = await Case.findOne({
      _id: req.params.id,
      advocate: req.user._id
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Add timeline entry for significant updates
    const updates = [];
    
    if (req.body.status && req.body.status !== caseData.status) {
      updates.push({
        date: new Date(),
        title: 'Status Updated',
        description: `Case status changed from ${caseData.status} to ${req.body.status}`,
        type: 'status',
        user: req.user._id
      });
    }

    if (req.body.nextHearingDate && req.body.nextHearingDate !== caseData.nextHearingDate) {
      updates.push({
        date: new Date(),
        title: 'Hearing Date Updated',
        description: `Next hearing date updated to ${new Date(req.body.nextHearingDate).toLocaleDateString()}`,
        type: 'hearing',
        user: req.user._id
      });
    }

    if (req.body.judgmentDate && req.body.judgmentDate !== caseData.judgmentDate) {
      updates.push({
        date: new Date(),
        title: 'Judgment Date Set',
        description: `Judgment date set to ${new Date(req.body.judgmentDate).toLocaleDateString()}`,
        type: 'judgment',
        user: req.user._id
      });
    }

    if (req.body.title && req.body.title !== caseData.title) {
      updates.push({
        date: new Date(),
        title: 'Case Title Updated',
        description: `Case title changed from "${caseData.title}" to "${req.body.title}"`,
        type: 'note',
        user: req.user._id
      });
    }

    // Add updates to timeline if any
    if (updates.length > 0) {
      req.body.timeline = [...(caseData.timeline || []), ...updates];
    }

    caseData = await Case.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('client', 'name phone email');

    res.status(200).json({
      success: true,
      message: 'Case updated successfully',
      data: caseData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete case
exports.deleteCase = async (req, res) => {
  try {
    const caseData = await Case.findOne({
      _id: req.params.id,
      advocate: req.user.id
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    await caseData.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Case deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add timeline entry
exports.addTimeline = async (req, res) => {
  try {
    const { title, description, type } = req.body;
    
    const caseData = await Case.findOne({
      _id: req.params.id,
      advocate: req.user.id
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    caseData.timeline.push({
      date: new Date(),
      title,
      description,
      type,
      user: req.user.id
    });

    await caseData.save();

    res.status(200).json({
      success: true,
      message: 'Timeline entry added',
      data: caseData.timeline
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get case statistics
exports.getCaseStats = async (req, res) => {
  try {
    const stats = await Case.aggregate([
      { $match: { advocate: req.user._id } },
      {
        $group: {
          _id: null,
          totalCases: { $sum: 1 },
          activeCases: {
            $sum: { 
              $cond: [{ $in: ['$status', ['filed', 'pending', 'ongoing', 'hearing']] }, 1, 0] 
            }
          },
          wonCases: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
          lostCases: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
          totalFees: { $sum: '$fee.total' },
          collectedFees: { $sum: '$fee.paid' },
          pendingFees: { $sum: '$fee.pending' }
        }
      }
    ]);

    const statusStats = await Case.aggregate([
      { $match: { advocate: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const caseTypeStats = await Case.aggregate([
      { $match: { advocate: req.user._id } },
      { $group: { _id: '$caseType', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {},
        byStatus: statusStats,
        byType: caseTypeStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
