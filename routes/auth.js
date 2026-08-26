const express = require('express');
const router = express.Router();
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { protect } = require('../middleware/auth');
const sendEmail = require('../utils/email');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, collegeId, email, password, role, roomNumber, hostelBlock, department, year, phoneNumber } = req.body;

    if (!name || !collegeId || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, college ID, email, and password'
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { collegeId }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase()
          ? 'Email already registered'
          : 'College ID already registered'
      });
    }

    if (role === 'student' && !roomNumber) {
      return res.status(400).json({
        success: false,
        message: 'Room number is required for students'
      });
    }

    let approvalStatus = 'pending';

    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin accounts can only be created by existing admins'
      });
    }

    if (role === 'student') {
      approvalStatus = 'approved';
    }

    const user = await User.create({
      name,
      collegeId,
      email: email.toLowerCase(),
      password,
      role: role || 'student',
      approvalStatus,
      roomNumber,
      hostelBlock,
      department,
      year,
      phoneNumber,
      emailVerified: false
    });

    const otp = user.generateEmailOTP();
    await user.save();

    try {
      await sendEmail({
        email: user.email,
        subject: 'Verify Your Hostel Management Account - OTP',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f4f4f4;">
            <div style="background:white;padding:30px;border-radius:12px;">
              <h2 style="color:#667eea;text-align:center;">Hostel Management</h2>
              <h3>Welcome ${user.name}!</h3>
              <p>Use the OTP below to verify your email address.</p>
              <div style="background:#667eea;color:white;text-align:center;padding:25px;border-radius:10px;margin:20px 0;">
                <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your OTP</div>
                <div style="font-size:44px;font-weight:700;letter-spacing:10px;margin-top:8px;">${otp}</div>
              </div>
              <p><strong>This OTP is valid for 10 minutes.</strong></p>
              <p>If you did not create this account, you can ignore this email.</p>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Registration OTP email error:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Account created, but OTP email could not be sent. Please try again.'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! An OTP has been sent to your email.',
      requiresVerification: true,
      user: {
        id: user._id,
        name: user.name,
        collegeId: user.collegeId,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, collegeId, password } = req.body;

    if ((!email && !collegeId) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/college ID and password'
      });
    }

    const user = await User.findOne({
      $or: [
        { email: email?.toLowerCase() },
        { collegeId: collegeId?.toUpperCase() }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact admin.'
      });
    }

    const testAccounts = [
      'adminpriyanshu@hostel.com',
      'wardenpriyanshu@hostel.com',
      'studentpriyanshu@hostel.com'
    ];

    if (!user.emailVerified && !testAccounts.includes(user.email.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: user.email
      });
    }

    if (user.approvalStatus === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please wait for admin approval.',
        approvalStatus: 'pending'
      });
    }

    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        message: user.rejectionReason || 'Your account has been rejected. Please contact administration.',
        approvalStatus: 'rejected'
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        collegeId: user.collegeId,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
        roomNumber: user.roomNumber,
        hostelBlock: user.hostelBlock,
        department: user.department,
        year: user.year
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        collegeId: user.collegeId,
        email: user.email,
        role: user.role,
        roomNumber: user.roomNumber,
        hostelBlock: user.hostelBlock,
        department: user.department,
        year: user.year,
        phoneNumber: user.phoneNumber
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/update-profile
router.put('/update-profile', protect, async (req, res) => {
  try {
    const { name, phoneNumber, roomNumber } = req.body;
    const updateFields = {};

    if (name) updateFields.name = name;
    if (phoneNumber) updateFields.phoneNumber = phoneNumber;
    if (roomNumber && req.user.role === 'student') updateFields.roomNumber = roomNumber;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/change-password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
});

// @route   GET /api/auth/google
router.get('/google', (req, res) => {
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&response_type=code&scope=profile%20email`;
  res.json({ success: true, url: googleAuthUrl });
});

// @route   POST /api/auth/google/callback
router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
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
        message: tokenData.error_description || 'Failed to get access token'
      });
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const googleUser = await userInfoResponse.json();

    if (!userInfoResponse.ok || !googleUser.email) {
      return res.status(400).json({
        success: false,
        message: 'Failed to get Google account information'
      });
    }

    const email = googleUser.email.toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      const emailPrefix = email.split('@')[0];
      const collegeId = emailPrefix
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 10) + Date.now().toString().slice(-4);

      user = await User.create({
        name: googleUser.name || emailPrefix,
        email,
        collegeId,
        password: 'google-oauth-' + Math.random().toString(36).substring(7),
        role: 'student',
        googleId: googleUser.id,
        avatar: googleUser.picture,
        isActive: true,
        approvalStatus: 'approved',
        emailVerified: true
      });
    } else {
      user.googleId = googleUser.id;
      user.avatar = googleUser.picture;
      user.emailVerified = true;
      if (!user.approvalStatus) user.approvalStatus = 'approved';
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: {
        _id: user._id,
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
      }
    });
  } catch (error) {
    console.error('Google OAuth Error:', error);
    res.status(500).json({
      success: false,
      message: 'Google authentication failed',
      error: error.message
    });
  }
});

// @route   GET /api/auth/users
router.get('/users', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this resource'
      });
    }

    const { role, approvalStatus, search } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (approvalStatus) filter.approvalStatus = approvalStatus;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { collegeId: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// @route   POST /api/auth/send-verification-otp
router.post('/send-verification-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email. Please register first.'
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified. You can login now.'
      });
    }

    const otp = user.generateEmailOTP();
    await user.save();

    try {
      await sendEmail({
        email: user.email,
        subject: 'Verify Your Hostel Management Account - OTP',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f4f4f4;">
            <div style="background:white;padding:30px;border-radius:12px;">
              <h2 style="color:#667eea;text-align:center;">Hostel Management</h2>
              <h3>Email Verification</h3>
              <p>Hello ${user.name},</p>
              <p>Your OTP for email verification is:</p>
              <div style="background:#667eea;color:white;text-align:center;padding:25px;border-radius:10px;margin:20px 0;">
                <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your OTP</div>
                <div style="font-size:44px;font-weight:700;letter-spacing:10px;margin-top:8px;">${otp}</div>
              </div>
              <p><strong>This OTP is valid for 10 minutes.</strong></p>
            </div>
          </div>
        `
      });

      return res.json({
        success: true,
        message: 'OTP sent to your email. Please check your inbox.'
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again later.',
        error: emailError.message
      });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending OTP',
      error: error.message
    });
  }
});

// @route   POST /api/auth/verify-email-otp
router.post('/verify-email-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    if (!user.verifyEmailOTP(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    user.emailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully! You can now login.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed',
      error: error.message
    });
  }
});

module.exports = router;
