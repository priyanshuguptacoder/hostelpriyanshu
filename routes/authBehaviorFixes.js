const express = require('express');
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

const otpHtml = (name, otp) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f4f4f4;">
    <div style="background:#fff;padding:30px;border-radius:12px;">
      <h2 style="color:#667eea;text-align:center;">Hostel Management</h2>
      <p>Hello ${name || 'there'},</p>
      <p>Use the OTP below to verify your email address.</p>
      <div style="background:#667eea;color:white;text-align:center;padding:25px;border-radius:10px;margin:20px 0;">
        <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;">Verification OTP</div>
        <div style="font-size:44px;font-weight:700;letter-spacing:10px;margin-top:8px;">${otp}</div>
      </div>
      <p><strong>This OTP is valid for 10 minutes.</strong></p>
    </div>
  </div>
`;

router.post('/login', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const collegeId = req.body.collegeId?.trim().toUpperCase();
    const password = req.body.password || '';

    if ((!email && !collegeId) || !password) {
      return res.status(400).json({ success: false, message: 'Please provide your email/college ID and password.' });
    }

    const query = email ? { email } : { collegeId };
    const user = await User.findOne(query).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'No account found with that email or college ID. Please check your details or create an account.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account is deactivated. Please contact the administrator.' });
    }

    if (!user.password || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your email is not verified. We can send a fresh OTP to verify it.',
        requiresVerification: true,
        email: user.email
      });
    }

    if (user.approvalStatus === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is waiting for approval. Please wait for the administrator to review it.',
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
      message: 'Login successful.',
      token: generateToken(user._id),
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Authentication behavior login error:', error);
    return res.status(500).json({ success: false, message: 'Unable to sign in right now. Please try again.' });
  }
});

router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Authorization code is required.' });

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
      return res.status(400).json({ success: false, message: tokenData.error_description || 'Google authorization failed.' });
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const googleUser = await userInfoResponse.json();

    if (!userInfoResponse.ok || !googleUser.email) {
      return res.status(400).json({ success: false, message: 'Could not read the Google account information.' });
    }

    const email = googleUser.email.toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      const emailPrefix = email.split('@')[0];
      const collegeId = emailPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10) + Date.now().toString().slice(-4);

      user = new User({
        name: googleUser.name || emailPrefix,
        email,
        collegeId,
        password: `google-oauth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        role: 'student',
        googleId: googleUser.id,
        avatar: googleUser.picture,
        isActive: true,
        approvalStatus: 'approved',
        emailVerified: false
      });

      const otp = user.generateEmailOTP();
      try {
        await sendEmail({
          email: user.email,
          subject: 'Verify Your Hostel Management Account - Google Signup OTP',
          html: otpHtml(user.name, otp),
          text: `Your Hostel Management verification OTP is ${otp}. It expires in 10 minutes.`
        });
        await user.save();
      } catch (emailError) {
        console.error('Google signup OTP email error:', emailError);
        return res.status(502).json({ success: false, message: `Google signup could not send the verification email: ${emailError.message}` });
      }

      return res.json({
        success: true,
        message: 'Google signup successful. Verify your email with the OTP sent to you.',
        requiresVerification: true,
        user: publicUser(user)
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account is deactivated. Please contact the administrator.' });
    }

    if (!user.emailVerified) {
      const otp = user.generateEmailOTP();
      try {
        await sendEmail({
          email: user.email,
          subject: 'Verify Your Hostel Management Account - Google Login OTP',
          html: otpHtml(user.name, otp),
          text: `Your Hostel Management verification OTP is ${otp}. It expires in 10 minutes.`
        });
        user.googleId = googleUser.id;
        user.avatar = googleUser.picture;
        await user.save();
      } catch (emailError) {
        console.error('Existing Google user OTP email error:', emailError);
        return res.status(502).json({ success: false, message: `Verification email could not be sent: ${emailError.message}` });
      }

      return res.status(403).json({
        success: false,
        message: 'Your account email is not verified. A new OTP was sent.',
        requiresVerification: true,
        email: user.email
      });
    }

    if (user.approvalStatus === 'pending') {
      return res.status(403).json({ success: false, message: 'Your account is waiting for approval.', approvalStatus: 'pending' });
    }

    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({ success: false, message: user.rejectionReason || 'Your account was rejected.', approvalStatus: 'rejected' });
    }

    user.googleId = googleUser.id;
    user.avatar = googleUser.picture;
    await user.save();

    return res.json({
      success: true,
      message: 'Google login successful.',
      token: generateToken(user._id),
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Authentication behavior Google error:', error);
    return res.status(500).json({ success: false, message: 'Google authentication failed. Please try again.' });
  }
});

module.exports = router;
