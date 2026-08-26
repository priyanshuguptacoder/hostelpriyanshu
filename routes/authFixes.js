const express = require('express');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/email');

const router = express.Router();

const buildOtpHtml = (name, otp) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f4f4f4;">
    <div style="background:white;padding:30px;border-radius:12px;">
      <h2 style="color:#667eea;text-align:center;">Hostel Management</h2>
      <h3>Welcome ${name || 'there'}!</h3>
      <p>Use the OTP below to verify your email address.</p>
      <div style="background:#667eea;color:white;text-align:center;padding:25px;border-radius:10px;margin:20px 0;">
        <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your OTP</div>
        <div style="font-size:44px;font-weight:700;letter-spacing:10px;margin-top:8px;">${otp}</div>
      </div>
      <p><strong>This OTP is valid for 10 minutes.</strong></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  </div>
`;

const publicUser = (user) => ({
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

async function deliverOtp(user, otp, subject = 'Verify Your Hostel Management Account - OTP') {
  await sendEmail({
    email: user.email,
    subject,
    html: buildOtpHtml(user.name, otp)
  });
}

router.post('/register', async (req, res) => {
  try {
    const {
      name,
      collegeId,
      email,
      password,
      role,
      roomNumber,
      hostelBlock,
      department,
      year,
      phoneNumber
    } = req.body;

    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedCollegeId = collegeId?.trim();

    if (!name || !normalizedCollegeId || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, college ID, email, and password'
      });
    }

    if (role === 'student' && !roomNumber) {
      return res.status(400).json({
        success: false,
        message: 'Room number is required for students'
      });
    }

    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin accounts can only be created by existing admins'
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { collegeId: normalizedCollegeId }
      ]
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail && !existingUser.emailVerified) {
        const otp = existingUser.generateEmailOTP();

        try {
          await deliverOtp(existingUser, otp);
          await existingUser.save();
        } catch (emailError) {
          console.error('Existing user OTP email error:', emailError);
          return res.status(500).json({
            success: false,
            message: 'Your account exists but the OTP email could not be sent. Please try again.'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Your account is not verified. A new OTP has been sent to your email.',
          requiresVerification: true,
          user: publicUser(existingUser)
        });
      }

      return res.status(400).json({
        success: false,
        message: existingUser.email === normalizedEmail
          ? 'Email already registered'
          : 'College ID already registered'
      });
    }

    const approvalStatus = role === 'student' ? 'approved' : 'pending';

    const user = new User({
      name,
      collegeId: normalizedCollegeId,
      email: normalizedEmail,
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

    try {
      await deliverOtp(user, otp);
      await user.save();
    } catch (emailError) {
      console.error('Registration OTP email error:', emailError);
      return res.status(500).json({
        success: false,
        message: 'OTP email could not be sent. Your account was not created. Please try again.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful! An OTP has been sent to your email.',
      requiresVerification: true,
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Fixed registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

router.post('/send-verification-otp', async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

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

    try {
      await deliverOtp(user, otp);
      await user.save();
    } catch (emailError) {
      console.error('Verification OTP email error:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again later.',
        error: emailError.message
      });
    }

    return res.json({
      success: true,
      message: 'OTP sent to your email. Please check your inbox.'
    });
  } catch (error) {
    console.error('Fixed send OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending OTP',
      error: error.message
    });
  }
});

router.post('/verify-email-otp', async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!normalizedEmail || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

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

    return res.json({
      success: true,
      message: 'Email verified successfully! You can now login.'
    });
  } catch (error) {
    console.error('Fixed email verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Email verification failed',
      error: error.message
    });
  }
});

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
      const collegeId = emailPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10) + Date.now().toString().slice(-4);

      user = new User({
        name: googleUser.name || emailPrefix,
        email,
        collegeId,
        password: 'google-oauth-' + Math.random().toString(36).substring(7),
        role: 'student',
        googleId: googleUser.id,
        avatar: googleUser.picture,
        isActive: true,
        approvalStatus: 'approved',
        emailVerified: false
      });

      const otp = user.generateEmailOTP();

      try {
        await deliverOtp(user, otp, 'Verify Your Hostel Management Account - Google Signup OTP');
        await user.save();
      } catch (emailError) {
        console.error('Google signup OTP email error:', emailError);
        return res.status(500).json({
          success: false,
          message: 'OTP email could not be sent. Google signup was not completed. Please try again.'
        });
      }

      return res.json({
        success: true,
        message: 'Google signup successful! Please verify your email with the OTP.',
        requiresVerification: true,
        user: publicUser(user)
      });
    }

    user.googleId = googleUser.id;
    user.avatar = googleUser.picture;

    if (!user.emailVerified) {
      const otp = user.generateEmailOTP();

      try {
        await deliverOtp(user, otp, 'Verify Your Hostel Management Account - Google Signup OTP');
        await user.save();
      } catch (emailError) {
        console.error('Existing Google user OTP email error:', emailError);
        return res.status(500).json({
          success: false,
          message: 'OTP email could not be sent. Please try again.',
          error: emailError.message
        });
      }

      return res.json({
        success: true,
        message: 'Please verify your email with the OTP sent to you.',
        requiresVerification: true,
        user: publicUser(user)
      });
    }

    await user.save();

    const token = generateToken(user._id);

    return res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Fixed Google OAuth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Google authentication failed',
      error: error.message
    });
  }
});

module.exports = router;
