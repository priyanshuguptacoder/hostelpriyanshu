const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/email');

const router = express.Router();

const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

function publicOrigin(req) {
  return (process.env.FRONTEND_URL || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

router.post('/forgot-password', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email. Please check the address or register first.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hash(rawToken);
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const resetUrl = `${publicOrigin(req)}/reset-password/${encodeURIComponent(rawToken)}`;
    const safeName = escapeHtml(user.name || 'there');

    try {
      await sendEmail({
        email: user.email,
        subject: 'Reset Your Hostel Management Password',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f4f4f4;">
            <div style="background:#fff;padding:30px;border-radius:12px;">
              <h2 style="color:#667eea;text-align:center;">Password Reset</h2>
              <p>Hello ${safeName},</p>
              <p>We received a request to reset your Hostel Management account password.</p>
              <p style="text-align:center;margin:30px 0;">
                <a href="${resetUrl}" style="display:inline-block;padding:14px 24px;background:#667eea;color:white;text-decoration:none;border-radius:8px;font-weight:700;">Reset Password</a>
              </p>
              <p>This link expires in <strong>15 minutes</strong>.</p>
              <p>If you did not request this, you can safely ignore this email.</p>
            </div>
          </div>
        `,
        text: `Reset your Hostel Management password: ${resetUrl}`
      });
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      console.error('Password reset email error:', emailError);
      return res.status(502).json({ success: false, message: `Password reset email could not be sent: ${emailError.message}` });
    }

    return res.json({ success: true, message: 'Password reset link sent successfully. Check your email, including Spam/Junk.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Unable to process the password reset request.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({
      passwordResetToken: hash(token),
      passwordResetExpires: { $gt: new Date() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or expired. Please request a new one.' });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({ success: true, message: 'Password reset successfully. You can now login with the new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Unable to reset the password.' });
  }
});

router.post('/request-delete-otp', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email.' });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    user.deleteAccountOTP = hash(otp);
    user.deleteAccountOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const safeName = escapeHtml(user.name || 'there');

    try {
      await sendEmail({
        email: user.email,
        subject: 'Delete Your Hostel Management Account - OTP',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f4f4f4;">
            <div style="background:#fff;padding:30px;border-radius:12px;">
              <h2 style="color:#dc3545;text-align:center;">Account Deletion</h2>
              <p>Hello ${safeName},</p>
              <p>Use the OTP below to permanently delete your Hostel Management account.</p>
              <div style="background:#dc3545;color:white;text-align:center;padding:25px;border-radius:10px;margin:20px 0;">
                <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;">Deletion OTP</div>
                <div style="font-size:44px;font-weight:700;letter-spacing:10px;margin-top:8px;">${otp}</div>
              </div>
              <p><strong>This OTP is valid for 10 minutes.</strong></p>
              <p>If you did not request account deletion, ignore this email.</p>
            </div>
          </div>
        `,
        text: `Your account deletion OTP is ${otp}. It expires in 10 minutes.`
      });
    } catch (emailError) {
      user.deleteAccountOTP = undefined;
      user.deleteAccountOTPExpires = undefined;
      await user.save();
      console.error('Delete OTP email error:', emailError);
      return res.status(502).json({ success: false, message: `Deletion OTP email could not be sent: ${emailError.message}` });
    }

    return res.json({ success: true, message: 'Deletion OTP sent successfully. Check your email, including Spam/Junk.' });
  } catch (error) {
    console.error('Request delete OTP error:', error);
    return res.status(500).json({ success: false, message: 'Unable to process the account deletion request.' });
  }
});

router.post('/confirm-delete-otp', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Email and a valid 6-digit OTP are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });

    const valid = user.deleteAccountOTP && user.deleteAccountOTPExpires &&
      Date.now() <= new Date(user.deleteAccountOTPExpires).getTime() &&
      user.deleteAccountOTP === hash(otp);

    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired deletion OTP. Request a new OTP and try again.' });
    }

    await User.deleteOne({ _id: user._id });
    return res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Confirm delete OTP error:', error);
    return res.status(500).json({ success: false, message: 'Unable to delete the account.' });
  }
});

module.exports = router;
