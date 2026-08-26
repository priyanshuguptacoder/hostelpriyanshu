const express = require('express');
const crypto = require('crypto');
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

const hashOtp = value => crypto.createHash('sha256').update(String(value)).digest('hex');

router.post('/verify-email-otp', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Email and a valid 6-digit OTP are required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified. You can sign in now.' });
    }

    const expiresAt = user.emailVerificationOTPExpires
      ? new Date(user.emailVerificationOTPExpires).getTime()
      : 0;

    const storedHash = user.emailVerificationOTP || '';
    const otpValid = expiresAt > Date.now() && (
      storedHash === hashOtp(otp) || storedHash === otp
    );

    if (!otpValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new OTP.' });
    }

    user.emailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpires = undefined;
    await user.save();

    return res.json({
      success: true,
      message: 'Email verified successfully.',
      token: generateToken(user._id),
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Email verification fix error:', error);
    return res.status(500).json({ success: false, message: 'Email verification failed. Please try again.' });
  }
});

module.exports = router;
