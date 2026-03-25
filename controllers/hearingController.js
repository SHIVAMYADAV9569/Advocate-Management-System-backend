const { Hearing, Case, Notification } = require('../models');

// Get all hearings
exports.getHearings = async (req, res) => {
  try {
    const { case: caseId, status, from, to } = req.query;
    let query = { advocate: req.user.id };

    if (caseId) query.case = caseId;
    if (status) query.status = status;
    if (from || to) {
      query.hearingDate = {};
      if (from) query.hearingDate.$gte = new Date(from);
      if (to) query.hearingDate.$lte = new Date(to);
    }

    const hearings = await Hearing.find(query)
      .populate('client', 'name phone')
      .populate('case', 'caseNumber title')
      .sort({ hearingDate: 1 });

    res.status(200).json({
      success: true,
      count: hearings.length,
      data: hearings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single hearing
exports.getHearing = async (req, res) => {
  try {
    const hearing = await Hearing.findOne({
      _id: req.params.id,
      advocate: req.user.id
    })
    .populate('client', 'name phone email')
    .populate('case', 'caseNumber title courtName');

    if (!hearing) {
      return res.status(404).json({
        success: false,
        message: 'Hearing not found'
      });
    }

    res.status(200).json({
      success: true,
      data: hearing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create hearing
exports.createHearing = async (req, res) => {
  try {
    req.body.advocate = req.user.id;

    const hearing = await Hearing.create(req.body);

    // Update case with next hearing date
    await Case.findByIdAndUpdate(req.body.case, {
      nextHearingDate: req.body.hearingDate
    });

    // Add to case timeline
    await Case.findByIdAndUpdate(req.body.case, {
      $push: {
        timeline: {
          date: new Date(),
          title: 'Hearing Scheduled',
          description: `Hearing scheduled on ${new Date(req.body.hearingDate).toLocaleDateString()} at ${req.body.hearingTime}`,
          type: 'hearing',
          user: req.user.id
        }
      }
    });

    // Create notification
    await Notification.create({
      recipient: req.user.id,
      type: 'hearing',
      title: 'New Hearing Scheduled',
      message: `Hearing for case scheduled on ${new Date(req.body.hearingDate).toLocaleDateString()}`,
      relatedTo: { model: 'Hearing', id: hearing._id }
    });

    res.status(201).json({
      success: true,
      message: 'Hearing scheduled successfully',
      data: hearing
    });
  } catch (error) {
    console.error('Create hearing error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update hearing
exports.updateHearing = async (req, res) => {
  try {
    let hearing = await Hearing.findOne({
      _id: req.params.id,
      advocate: req.user.id
    });

    if (!hearing) {
      return res.status(404).json({
        success: false,
        message: 'Hearing not found'
      });
    }

    // Get the case to update its timeline
    const caseData = await Case.findById(hearing.case);

    // Add timeline entry for significant hearing updates
    const updates = [];
    
    if (req.body.status && req.body.status !== hearing.status) {
      updates.push({
        date: new Date(),
        title: 'Hearing Status Updated',
        description: `Hearing status changed from ${hearing.status} to ${req.body.status}`,
        type: 'hearing',
        user: req.user.id
      });
    }

    if (req.body.date && req.body.date !== hearing.date) {
      updates.push({
        date: new Date(),
        title: 'Hearing Date Updated',
        description: `Hearing date updated to ${new Date(req.body.date).toLocaleDateString()}`,
        type: 'hearing',
        user: req.user.id
      });
    }

    if (req.body.outcome && req.body.outcome !== hearing.outcome) {
      updates.push({
        date: new Date(),
        title: 'Hearing Outcome Recorded',
        description: `Hearing outcome: ${req.body.outcome}`,
        type: 'hearing',
        user: req.user.id
      });
    }

    // Update the hearing
    hearing = await Hearing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    // Add updates to case timeline if any
    if (updates.length > 0 && caseData) {
      await Case.findByIdAndUpdate(hearing.case, {
        $push: { timeline: { $each: updates } }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Hearing updated successfully',
      data: hearing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete hearing
exports.deleteHearing = async (req, res) => {
  try {
    const hearing = await Hearing.findOne({
      _id: req.params.id,
      advocate: req.user.id
    });

    if (!hearing) {
      return res.status(404).json({
        success: false,
        message: 'Hearing not found'
      });
    }

    await hearing.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Hearing deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get today's hearings
exports.getTodaysHearings = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const hearings = await Hearing.find({
      advocate: req.user.id,
      hearingDate: { $gte: today, $lt: tomorrow },
      status: 'scheduled'
    })
    .populate('client', 'name phone')
    .populate('case', 'caseNumber title')
    .sort({ hearingTime: 1 });

    res.status(200).json({
      success: true,
      count: hearings.length,
      data: hearings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get upcoming hearings (next 7 days)
exports.getUpcomingHearings = async (req, res) => {
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const hearings = await Hearing.find({
      advocate: req.user.id,
      hearingDate: { $gte: today, $lte: nextWeek },
      status: 'scheduled'
    })
    .populate('client', 'name phone')
    .populate('case', 'caseNumber title')
    .sort({ hearingDate: 1 });

    res.status(200).json({
      success: true,
      count: hearings.length,
      data: hearings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
