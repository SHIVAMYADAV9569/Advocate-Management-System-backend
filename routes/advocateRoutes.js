const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Advocate = require('../models/Advocate');
const bcrypt = require('bcryptjs');

// @route   GET /api/advocates/profile
// @desc    Get advocate profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const advocate = await Advocate.findById(req.user.id).select('-password');
    res.status(200).json({
      success: true,
      data: advocate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/advocates/profile
// @desc    Update advocate profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email, phone, barNumber } = req.body;
    
    const advocate = await Advocate.findByIdAndUpdate(
      req.user.id,
      { name, email, phone, barNumber },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: advocate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/advocates/change-password
// @desc    Change password
// @access  Private
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const advocate = await Advocate.findById(req.user.id);
    
    // Check current password
    const isMatch = await advocate.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    advocate.password = newPassword;
    await advocate.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/advocates/notifications
// @desc    Update notification preferences
// @access  Private
router.put('/notifications', protect, async (req, res) => {
  try {
    const advocate = await Advocate.findByIdAndUpdate(
      req.user.id,
      { notificationPreferences: req.body },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated',
      data: advocate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
