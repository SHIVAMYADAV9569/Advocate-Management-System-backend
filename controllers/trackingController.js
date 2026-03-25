const Case = require('../models/Case');
const Document = require('../models/Document');
const Hearing = require('../models/Hearing');
const Payment = require('../models/Payment');

// Public case tracking - no authentication required
const trackCase = async (req, res) => {
  try {
    const { trackingCode } = req.params;

    if (!trackingCode) {
      return res.status(400).json({
        success: false,
        message: 'Tracking code is required'
      });
    }

    let caseData = null;

    // Try to find by tracking code first
    if (trackingCode.toUpperCase().startsWith('TRK')) {
      caseData = await Case.findOne({ 
        trackingCode: trackingCode.toUpperCase(),
        isActive: true 
      });
    } 
    // If not found or doesn't start with TRK, try by case number
    else {
      caseData = await Case.findOne({ 
        caseNumber: trackingCode.toUpperCase(),
        isActive: true 
      });
    }

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found with this tracking code or case number'
      });
    }

    // If case doesn't have tracking code, generate one
    if (!caseData.trackingCode) {
      const count = await Case.countDocuments();
      caseData.trackingCode = `TRK${String(count + 1).padStart(8, '0')}`;
      await caseData.save();
    }

    // Populate client and advocate info
    caseData = await Case.findOne({ 
      _id: caseData._id,
      isActive: true 
    })
    .populate('client', 'name phone email')
    .populate('advocate', 'name email phone barNumber')
    .select('-timeline -fee -__v');

    // Get hearings for this case
    const hearings = await Hearing.find({ 
      case: caseData._id
      // isActive: true  // Temporarily comment out for debugging
    })
    .populate('advocate', 'name barNumber')
    .sort({ hearingDate: 1 });

    // Get payments for this case
    const payments = await Payment.find({ 
      case: caseData._id
      // isActive: true  // Temporarily comment out for debugging
    })
    .populate('advocate', 'name barNumber')
    .sort({ dueDate: 1 });

    // Return limited public information
    const publicCaseInfo = {
      trackingCode: caseData.trackingCode,
      caseNumber: caseData.caseNumber,
      title: caseData.title,
      status: caseData.status,
      courtName: caseData.courtName,
      courtType: caseData.courtType,
      caseType: caseData.caseType,
      filingDate: caseData.filingDate,
      nextHearingDate: caseData.nextHearingDate,
      judgmentDate: caseData.judgmentDate,
      priority: caseData.priority,
      client: {
        name: caseData.client?.name,
        // Only show partial phone/email for privacy
        phone: caseData.client?.phone ? 
          caseData.client.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : null,
        email: caseData.client?.email ?
          caseData.client.email.replace(/(.{2}).*(@.*)/, '$1****$2') : null
      },
      advocate: {
        name: caseData.advocate?.name,
        barNumber: caseData.advocate?.barNumber
      },
      documents: caseData.documents?.map(doc => ({
        name: doc.name,
        format: doc.type?.toUpperCase() || 'DOC',
        size: 0, // Embedded docs don't have size
        uploadedAt: doc.uploadedAt,
        isConfidential: false, // Embedded docs don't have this flag
        url: doc.url || `/uploads/${doc.name}`, // Ensure URL is properly set
        advocate: {
          name: caseData.advocate?.name,
          barNumber: caseData.advocate?.barNumber
        }
      })) || [],
      hearings: hearings?.map(hearing => ({
        _id: hearing._id,
        date: hearing.hearingDate,
        time: hearing.hearingTime,
        type: hearing.type,
        description: hearing.description,
        location: hearing.location,
        status: hearing.status,
        outcome: hearing.outcome,
        notes: hearing.notes,
        advocate: {
          name: hearing.advocate?.name,
          barNumber: hearing.advocate?.barNumber
        },
        createdAt: hearing.createdAt,
        updatedAt: hearing.updatedAt
      })) || [],
      payments: payments?.map(payment => ({
        _id: payment._id,
        type: payment.type,
        amount: payment.amount,
        dueDate: payment.dueDate,
        status: payment.status,
        description: payment.description,
        method: payment.method,
        transactionId: payment.transactionId,
        advocate: {
          name: payment.advocate?.name,
          barNumber: payment.advocate?.barNumber
        },
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      })) || [],
      createdAt: caseData.createdAt,
      updatedAt: caseData.updatedAt
    };

    res.status(200).json({
      success: true,
      data: publicCaseInfo
    });

  } catch (error) {
    console.error('Error tracking case:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update case status (for advocates only)
const updateCaseStatus = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { status, nextHearingDate, judgmentDate, judgmentSummary } = req.body;

    // Find case and verify it belongs to the logged-in advocate
    const caseData = await Case.findOne({ 
      _id: caseId, 
      advocate: req.user.id,
      isActive: true 
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found or you do not have permission to update it'
      });
    }

    // Validate status
    const validStatuses = ['filed', 'pending', 'ongoing', 'hearing', 'judgment', 'won', 'lost', 'settled', 'dismissed', 'withdrawn'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Update case
    const updateData = { status };
    
    if (nextHearingDate) updateData.nextHearingDate = new Date(nextHearingDate);
    if (judgmentDate) updateData.judgmentDate = new Date(judgmentDate);
    if (judgmentSummary) updateData.judgmentSummary = judgmentSummary;

    // Add status change to timeline
    const timelineEntry = {
      date: new Date(),
      title: `Status changed to ${status}`,
      description: `Case status was updated from ${caseData.status} to ${status}`,
      type: 'status',
      user: req.user.id
    };

    updateData.$push = { timeline: timelineEntry };

    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      updateData,
      { new: true, runValidators: true }
    ).populate('client', 'name email')
     .populate('advocate', 'name email');

    res.status(200).json({
      success: true,
      message: 'Case status updated successfully',
      data: updatedCase
    });

  } catch (error) {
    console.error('Error updating case status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all cases for status management (for advocates)
const getCasesForStatusManagement = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = { 
      advocate: req.user.id,
      isActive: true 
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { caseNumber: { $regex: search, $options: 'i' } },
        { trackingCode: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { courtName: { $regex: search, $options: 'i' } }
      ];
    }

    const cases = await Case.find(query)
      .populate('client', 'name phone email')
      .select('trackingCode caseNumber title status courtName filingDate nextHearingDate priority')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Case.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        cases,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching cases for status management:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  trackCase,
  updateCaseStatus,
  getCasesForStatusManagement
};
