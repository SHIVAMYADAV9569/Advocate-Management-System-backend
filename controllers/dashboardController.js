const { Advocate, Client, Case, Hearing, Payment, Appointment } = require('../models');

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const advocateId = req.user.id;

    // Get counts
    const totalClients = await Client.countDocuments({ advocate: advocateId });
    const totalCases = await Case.countDocuments({ advocate: advocateId });
    const activeCases = await Case.countDocuments({ 
      advocate: advocateId,
      status: { $in: ['filed', 'pending', 'ongoing', 'hearing'] }
    });

    // Get financial stats
    const paymentStats = await Payment.aggregate([
      { $match: { advocate: advocateId, status: 'paid' } },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$amount' },
          thisMonth: {
            $sum: {
              $cond: [
                { $gte: ['$paymentDate', new Date(new Date().setDate(1))] },
                '$amount',
                0
              ]
            }
          }
        }
      }
    ]);
    
    console.log('Payment stats result:', paymentStats);

    const pendingPayments = await Payment.aggregate([
      { $match: { advocate: advocateId, status: { $in: ['pending', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    console.log('Pending payments result:', pendingPayments);

    // Get upcoming hearings
    const upcomingHearings = await Hearing.find({
      advocate: advocateId,
      hearingDate: { $gte: new Date() },
      status: 'scheduled'
    })
    .populate('client', 'name')
    .populate('case', 'caseNumber title')
    .sort({ hearingDate: 1 })
    .limit(5);

    // Get today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysAppointments = await Appointment.find({
      advocate: advocateId,
      date: { $gte: today, $lt: tomorrow },
      status: 'scheduled'
    })
    .populate('client', 'name')
    .sort({ time: 1 });

    // Get recent clients
    const recentClients = await Client.find({ advocate: advocateId })
      .select('name phone createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get case status distribution
    const caseStatusStats = await Case.aggregate([
      { $match: { advocate: advocateId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Calculate success rate
    const completedCases = await Case.countDocuments({
      advocate: advocateId,
      status: { $in: ['won', 'lost', 'settled'] }
    });
    const wonCases = await Case.countDocuments({
      advocate: advocateId,
      status: 'won'
    });
    const successRate = completedCases > 0 ? Math.round((wonCases / completedCases) * 100) : 0;
    
    console.log('Completed cases:', completedCases, 'Won cases:', wonCases, 'Success rate:', successRate);

    res.status(200).json({
      success: true,
      data: {
        counts: {
          totalClients,
          totalCases,
          activeCases,
          completedCases
        },
        financial: {
          totalEarnings: paymentStats[0]?.totalEarnings || 0,
          thisMonthEarnings: paymentStats[0]?.thisMonth || 0,
          pendingPayments: pendingPayments[0]?.total || 0,
          successRate
        },
        upcomingHearings,
        todaysAppointments,
        recentClients,
        caseStatusStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get monthly earnings chart data
exports.getMonthlyEarnings = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    const monthlyData = await Payment.aggregate([
      {
        $match: {
          advocate: req.user.id,
          status: 'paid',
          paymentDate: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: '$paymentDate' },
          amount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing months with 0
    const result = Array(12).fill(0);
    monthlyData.forEach(item => {
      result[item._id - 1] = item.amount;
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get calendar events
exports.getCalendarEvents = async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get hearings
    const hearings = await Hearing.find({
      advocate: req.user.id,
      hearingDate: { $gte: startDate, $lte: endDate }
    }).select('hearingDate hearingTime purpose courtName case client');

    // Get appointments
    const appointments = await Appointment.find({
      advocate: req.user.id,
      date: { $gte: startDate, $lte: endDate }
    }).select('date time title type location client');

    const events = [
      ...hearings.map(h => ({
        id: h._id,
        title: h.purpose,
        date: h.hearingDate,
        time: h.hearingTime,
        type: 'hearing',
        location: h.courtName
      })),
      ...appointments.map(a => ({
        id: a._id,
        title: a.title,
        date: a.date,
        time: a.time,
        type: a.type,
        location: a.location
      }))
    ];

    res.status(200).json({
      success: true,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
