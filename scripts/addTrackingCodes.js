const mongoose = require('mongoose');
const Case = require('../models/Case');
require('dotenv').config();

const addTrackingCodes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all cases without tracking codes
    const casesWithoutTracking = await Case.find({ trackingCode: { $exists: false } });
    
    if (casesWithoutTracking.length === 0) {
      console.log('All cases already have tracking codes');
      return;
    }

    console.log(`Found ${casesWithoutTracking.length} cases without tracking codes`);

    // Get total count for generating unique codes
    const totalCount = await Case.countDocuments();
    let currentCount = totalCount - casesWithoutTracking.length + 1;

    // Update each case with a tracking code
    for (const caseData of casesWithoutTracking) {
      caseData.trackingCode = `TRK${String(currentCount).padStart(8, '0')}`;
      await caseData.save();
      console.log(`Added tracking code ${caseData.trackingCode} to case ${caseData.caseNumber}`);
      currentCount++;
    }

    console.log('Successfully added tracking codes to all cases');
  } catch (error) {
    console.error('Error adding tracking codes:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// Run the script
addTrackingCodes();
