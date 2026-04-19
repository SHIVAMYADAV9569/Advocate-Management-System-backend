const { Client, Case, Payment, Notification } = require('../models');

// Get all clients
exports.getClients = async (req, res) => {
  try {
    const { search, status, caseType, sortBy } = req.query;
    let query = { advocate: req.user.id };

    // Filter by status
    if (status) query.status = status;
    if (caseType) query.caseType = caseType;

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { clientId: { $regex: search, $options: 'i' } }
      ];
    }

    // Sorting
    let sort = {};
    if (sortBy === 'name') sort.name = 1;
    else if (sortBy === 'recent') sort.createdAt = -1;
    else if (sortBy === 'pending') sort.pendingAmount = -1;
    else sort.createdAt = -1;

    const clients = await Client.find(query)
      .sort(sort)
      .populate('totalCases');

    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single client
exports.getClient = async (req, res) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      advocate: req.user.id
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get client's cases
    const cases = await Case.find({ client: client._id })
      .select('caseNumber title status nextHearingDate fee');

    // Get client's payments
    const payments = await Payment.find({ client: client._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        client,
        cases,
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

// Create client
exports.createClient = async (req, res) => {
  try {
    req.body.advocate = req.user.id;

    const client = await Client.create(req.body);

    // Add to history
    client.history.push({
      action: 'created',
      description: 'Client profile created',
      user: req.user.id
    });
    await client.save();

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: client
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update client
exports.updateClient = async (req, res) => {
  try {
    let client = await Client.findOne({
      _id: req.params.id,
      advocate: req.user.id
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Add update to history
    client.history.push({
      action: 'updated',
      description: 'Client profile updated',
      user: req.user.id
    });

    client = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Client updated successfully',
      data: client
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete client
exports.deleteClient = async (req, res) => {
  try {
    console.log('🗑️ Delete client request:', req.params.id);
    console.log('👤 User:', req.user.id);
    
    const client = await Client.findOne({
      _id: req.params.id,
      advocate: req.user.id
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if client has active cases
    const activeCases = await Case.countDocuments({
      client: client._id,
      status: { $nin: ['won', 'lost', 'settled', 'dismissed'] }
    });

    if (activeCases > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete client with active cases. Please close or reassign cases first.'
      });
    }

    const clientName = client.name;
    
    // Delete the client
    await client.deleteOne();
    console.log('✅ Client deleted successfully:', clientName);

    // Create notification
    try {
      await Notification.create({
        recipient: req.user.id,
        type: 'client',
        title: 'Client Deleted',
        message: `Client "${clientName}" has been deleted successfully`,
        relatedTo: { model: 'Client', id: client._id },
        priority: 'medium'
      });
      console.log('✅ Notification created');
    } catch (notifError) {
      console.log('⚠️ Warning: Could not create notification:', notifError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete client error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete client'
    });
  }
};

// Get client statistics
exports.getClientStats = async (req, res) => {
  try {
    const stats = await Client.aggregate([
      { $match: { advocate: req.user._id } },
      {
        $group: {
          _id: null,
          totalClients: { $sum: 1 },
          activeClients: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          totalRevenue: { $sum: '$totalPayments' },
          pendingAmount: { $sum: '$pendingAmount' }
        }
      }
    ]);

    const caseTypeStats = await Client.aggregate([
      { $match: { advocate: req.user._id } },
      {
        $group: {
          _id: '$caseType',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {},
        caseTypes: caseTypeStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
