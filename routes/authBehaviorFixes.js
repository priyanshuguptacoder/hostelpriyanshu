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
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(409).json({
        success: false,
        message: 'Google account is not registered yet. Use the Sign up with Google option to create it.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account is deactivated. Please contact the administrator.' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your account email is not verified. Please verify it first.',
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

    if (!user.googleId || user.googleId !== googleUser.id) {
      user.googleId = googleUser.id;
      user.avatar = googleUser.picture;
      await user.save();
    }

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
