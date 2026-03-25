const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Advocate } = require('../models');
const { sendEmail } = require('../utils/email');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Register new advocate
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, barNumber, specialization } = req.body;

    // Check if advocate exists
    const existingAdvocate = await Advocate.findOne({ email });
    if (existingAdvocate) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Create advocate
    const advocate = await Advocate.create({
      name,
      email,
      password,
      phone,
      barNumber,
      specialization: specialization || [],
      verificationToken,
      verificationTokenExpiry
    });

    // Try to send verification email (don't fail if email is not configured)
    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
      await sendEmail({
        to: advocate.email,
        subject: 'Email Verification - Advocate Management System',
        html: `
          <h2>Welcome to Advocate Management System</h2>
          <p>Hello ${advocate.name},</p>
          <p>Please verify your email by clicking the link below:</p>
          <a href="${verificationUrl}" style="padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
          <p>Or copy this link: ${verificationUrl}</p>
          <p>This link expires in 24 hours.</p>
        `
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          id: advocate._id,
          name: advocate.name,
          email: advocate.email,
          isVerified: advocate.isVerified
        }
      });
    } catch (emailError) {
      // If email fails, still register but auto-verify the user
      console.log('Email sending failed, auto-verifying user:', emailError.message);
      advocate.isVerified = true;
      advocate.verificationToken = undefined;
      advocate.verificationTokenExpiry = undefined;
      await advocate.save();

      res.status(201).json({
        success: true,
        message: 'Registration successful. You can now login.',
        data: {
          id: advocate._id,
          name: advocate.name,
          email: advocate.email,
          isVerified: true
        }
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
};

// Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const advocate = await Advocate.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: Date.now() }
    });

    if (!advocate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    advocate.isVerified = true;
    advocate.verificationToken = undefined;
    advocate.verificationTokenExpiry = undefined;
    await advocate.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now login.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if advocate exists
    const advocate = await Advocate.findOne({ email });
    if (!advocate) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!advocate.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check if email is verified (skip if email service is not configured)
    if (!advocate.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    // Check password
    const isMatch = await advocate.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    advocate.lastLogin = Date.now();
    await advocate.save();

    // Generate token
    const token = generateToken(advocate._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        id: advocate._id,
        name: advocate.name,
        email: advocate.email,
        role: advocate.role,
        isVerified: advocate.isVerified,
        profileImage: advocate.profileImage
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const advocate = await Advocate.findOne({ email });
    if (!advocate) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

    advocate.resetPasswordToken = resetToken;
    advocate.resetPasswordExpiry = resetPasswordExpiry;
    await advocate.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendEmail({
      to: advocate.email,
      subject: 'Password Reset - Advocate Management System',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${advocate.name},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>Or copy this link: ${resetUrl}</p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const advocate = await Advocate.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() }
    });

    if (!advocate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    advocate.password = password;
    advocate.resetPasswordToken = undefined;
    advocate.resetPasswordExpiry = undefined;
    await advocate.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get current user
exports.getMe = async (req, res) => {
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
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password; // Don't allow password update here
    delete updates.role; // Don't allow role update

    const advocate = await Advocate.findByIdAndUpdate(
      req.user.id,
      updates,
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
};
