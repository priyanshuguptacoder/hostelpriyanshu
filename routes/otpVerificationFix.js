const express = require('express');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const router = express.Router();

const publicUser = user => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  collegeId: user.collegeId,
  role: user.role,
  approvalStatus: user.approvalStatus,
  emailVerified: user.emailVerified,
  avatar: user.avatar,
  roomNumber: user.roomNumber,
  hostelBlock: user.hostelBlock,
  department: user.department,
  year: user.year,
  phoneNumber: user.phoneNumber
});

router.post('/verify-email-otp', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Email and a valid 6-digit OTP are required.'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.'
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified. You can sign in.'
      });
    }

    if (!user.verifyEmailOTP(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Request a new OTP and try again.'
      });
    }

    user.emailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpires = undefined;
    await user.save();

    if (user.approvalStatus === 'pending') {
      return res.json({
        success: true,
        message: 'Email verified successfully. Your account is waiting for approval.',
        requiresVerification: false,
        token: generateToken(user._id),
        user: publicUser(user),
        approvalStatus: 'pending'
      });
    }

    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        message: user.rejectionReason || 'Your account was rejected. Please contact the administrator.',
        approvalStatus: 'rejected'
      });
    }

    return res.json({
      success: true,
      message: 'Email verified successfully. You are now signed in.',
      token: generateToken(user._id),
      user: publicUser(user)
    });
  } catch (error) {
    console.error('OTP verification fix error:', error);
    return res.status(500).json({
      success: false,
      message: 'Email verification failed. Please try again.'
    });
  }
});

module.exports = router;
