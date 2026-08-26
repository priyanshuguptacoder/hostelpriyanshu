const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/email');

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

const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildOtpHtml = (name, otp) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f4f4f4;">
    <div style="background:white;padding:30px;border-radius:12px;">
      <h2 style="color:#667eea;text-align:center;">Hostel Management</h2>
      <h3>Hello ${escapeHtml(name || 'there')}!</h3>
      <p>Use the OTP below to verify your email address.</p>
      <div style="background:#667eea;color:white;text-align:center;padding:25px;border-radius:10px;margin:20px 0;">
        <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your OTP</div>
        <div style="font-size:44px;font-weight:700;letter-spacing:10px;margin-top:8px;">${otp}</div>
      </div>
      <p><strong>This OTP is valid for 10 minutes.</strong></p>
      <p>If you did not request this, ignore this email.</p>
    </div>
  </div>
`;

async function sendGoogleOtp(user) {
  const otp = crypto.randomInt(100000, 1000000).toString();
  user.emailVerificationOTP = crypto.createHash('sha256').update(otp).digest('hex');
  user.emailVerificationOTPExpires = new Date(Date.now() + 10 * 60 * 1000);

  await sendEmail({
    email: user.email,
    subject: 'Verify Your Hostel Management Account - Google OTP',
    html: buildOtpHtml(user.name, otp),
    text: `Your Hostel Management verification OTP is ${otp}. It expires in 10 minutes.`
  });
}

router.post('/google/callback', async (req, res) => {
  try {
    const { code, mode = 'login' } = req.body;
    const normalizedMode = mode === 'signup' ? 'signup' : 'login';

    if (!code) {
      return res.status(400).json({ success: false, message: 'Authorization code is required.' });
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(400).json({
        success: false,
        message: tokenData.error_description || 'Google authorization failed.'
      });
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const googleUser = await userInfoResponse.json();

    if (!userInfoResponse.ok || !googleUser.email) {
      return res.status(400).json({
        success: false,
        message: 'Could not read the Google account information.'
      });
    }

    const email = googleUser.email.trim().toLowerCase();
    let user = await User.findOne({ email });
    let createdNow = false;

    // Continue with Google is intentionally an entry point for both signup and login.
    // If the account was deleted, using the same Google email creates a fresh student account.
    if (!user) {
      const emailPrefix = email.split('@')[0];
      const collegeId = `${emailPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10)}${Date.now().toString().slice(-6)}`;

      user = new User({
        name: googleUser.name || emailPrefix,
        email,
        collegeId,
        password: `google-oauth-${crypto.randomBytes(24).toString('hex')}`,
        role: 'student',
        googleId: googleUser.id,
        avatar: googleUser.picture,
        isActive: true,
        approvalStatus: 'approved',
        emailVerified: false
      });
      createdNow = true;
    } else {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'This account is deactivated. Please contact the administrator.' });
      }
      user.googleId = googleUser.id;
      user.avatar = googleUser.picture;
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account is deactivated. Please contact the administrator.' });
    }

    if (!user.emailVerified) {
      try {
        await sendGoogleOtp(user);
        await user.save();
      } catch (emailError) {
        console.error('Google OTP email error:', emailError);
        return res.status(502).json({
          success: false,
          message: `Google verification email could not be sent: ${emailError.message}`
        });
      }

      return res.json({
        success: true,
        message: createdNow
          ? 'Google signup started. Verify your email with the OTP.'
          : 'Your Google email is not verified. A new OTP has been sent.',
        requiresVerification: true,
        user: publicUser(user),
        authMode: createdNow ? 'signup' : normalizedMode
      });
    }

    if (user.approvalStatus === 'pending') {
      await user.save();
      return res.status(403).json({
        success: false,
        message: 'Your account is waiting for approval.',
        approvalStatus: 'pending'
      });
    }

    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        message: user.rejectionReason || 'Your account was rejected.',
        approvalStatus: 'rejected'
      });
    }

    await user.save();

    return res.json({
      success: true,
      message: normalizedMode === 'signup' ? 'Google signup complete.' : 'Google login successful.',
      token: generateToken(user._id),
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Google auth fix error:', error);
    return res.status(500).json({
      success: false,
      message: 'Google authentication failed. Please try again.'
    });
  }
});

module.exports = router;
