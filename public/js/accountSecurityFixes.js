(() => {
  function clearStoredSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.updateAuthState?.(null, null);
  }

  function goToLogin() {
    clearStoredSession();
    window.location.assign('/');
  }

  window.goToLoginFromWindow = goToLogin;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function authShell(content) {
    return `
      <div class="particles-bg">
        <div class="particle"></div><div class="particle"></div><div class="particle"></div>
        <div class="particle"></div><div class="particle"></div><div class="particle"></div>
        <div class="particle"></div><div class="particle"></div><div class="particle"></div>
        <div class="particle"></div>
      </div>
      <div class="auth-container">
        <h1>Hostel Management</h1>
        <p class="auth-subtitle">Manage your hostel life with ease</p>
        ${content}
      </div>
      <footer class="auth-footer">
        <div class="footer-divider"></div>
        <p class="copyright">© 2026 Hostel Management System • All Rights Reserved</p>
        <p class="creator">Crafted with <span class="heart">❤️</span> by <strong>Priyanshu</strong></p>
      </footer>
    `;
  }

  function renderAuthPage(content) {
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');

    if (dashboardSection) dashboardSection.style.display = 'none';
    if (authSection) {
      authSection.style.display = 'block';
      authSection.innerHTML = authShell(content);
    }
  }

  async function handleForgotPasswordSecurity(event) {
    event.preventDefault();

    const email = document.getElementById('forgot-email')?.value.trim().toLowerCase();
    if (!email) {
      window.showAlert('Please enter your email address.', 'error');
      return false;
    }

    try {
      const result = await window.apiCall('/account/forgot-password', 'POST', { email });
      window.showAlert(result.message || 'Password reset link sent successfully. Check your email.', 'success');
      document.getElementById('forgot-password-form-element')?.reset();
    } catch (error) {
      console.error('Forgot password error:', error);
      window.showAlert(error.message || 'Unable to send reset link.', 'error');
    }

    return false;
  }

  function getResetToken() {
    const match = window.location.pathname.match(/^\/reset-password\/([^/]+)$/);
    if (match) return decodeURIComponent(match[1]);
    return new URLSearchParams(window.location.search).get('resetToken');
  }

  function showResetPasswordSecurity(token) {
    if (!token) return;

    renderAuthPage(`
      <div class="auth-form">
        <h2>Reset Password</h2>
        <form id="reset-password-security-form">
          <div class="form-input-wrapper" data-icon="🔒">
            <input type="password" id="reset-password-security" placeholder="New Password (min 6 characters)" minlength="6" required autocomplete="new-password">
          </div>
          <div class="form-input-wrapper" data-icon="✅">
            <input type="password" id="reset-password-security-confirm" placeholder="Confirm New Password" minlength="6" required autocomplete="new-password">
          </div>
          <button type="submit">Reset Password <span>→</span></button>
        </form>
        <p><a href="#" onclick="goToLoginFromWindow(); return false;">Back to Sign In</a></p>
      </div>
    `);

    document.getElementById('reset-password-security-form').addEventListener('submit', async (event) => {
      event.preventDefault();

      const password = document.getElementById('reset-password-security').value;
      const confirmPassword = document.getElementById('reset-password-security-confirm').value;

      if (password.length < 6) {
        window.showAlert('Password must be at least 6 characters.', 'error');
        return;
      }

      if (password !== confirmPassword) {
        window.showAlert('Passwords do not match.', 'error');
        return;
      }

      try {
        const result = await window.apiCall('/account/reset-password', 'POST', {
          token,
          newPassword: password
        });

        window.history.replaceState({}, document.title, '/');
        clearStoredSession();
        window.showAlert(result.message || 'Password reset successfully.', 'success');
        setTimeout(() => window.location.assign('/'), 500);
      } catch (error) {
        console.error('Reset password error:', error);
        window.showAlert(error.message || 'Reset link is invalid or expired.', 'error');
      }
    });
  }

  async function resendDeleteOtp(email) {
    try {
      window.showAlert('Sending deletion OTP to your email...', 'info');
      const result = await window.apiCall('/account/request-delete-otp', 'POST', { email });
      window.showAlert(result.message || 'Deletion OTP sent successfully.', 'success');
    } catch (error) {
      console.error('Delete OTP resend error:', error);
      window.showAlert(error.message || 'Unable to send deletion OTP.', 'error');
    }
  }

  function showDeleteAccountSecurity() {
    renderAuthPage(`
      <div class="auth-form">
        <h2>Delete My Account</h2>
        <p style="text-align:center;color:var(--text-light);margin-bottom:20px;">Verify your email before permanently deleting your account.</p>
        <div class="alert alert-error" style="margin-bottom:20px;">
          This action cannot be undone. Your account will be permanently removed.
        </div>
        <form id="delete-account-request-form">
          <div class="form-input-wrapper" data-icon="📧">
            <input type="email" id="delete-account-email-security" placeholder="Email Address" required autocomplete="email">
          </div>
          <button type="submit" style="background:linear-gradient(135deg,var(--danger),#dc2626);">Send Deletion OTP <span>→</span></button>
        </form>
        <p><a href="#" onclick="goToLoginFromWindow(); return false;">Back to Sign In</a></p>
      </div>
    `);

    document.getElementById('delete-account-request-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('delete-account-email-security').value.trim().toLowerCase();

      try {
        const result = await window.apiCall('/account/request-delete-otp', 'POST', { email });
        window.showAlert(result.message || 'Deletion OTP sent successfully.', 'success');
        setTimeout(() => showDeleteOtpStep(email), 250);
      } catch (error) {
        console.error('Delete OTP request error:', error);
        window.showAlert(error.message || 'Unable to send deletion OTP.', 'error');
      }
    });
  }

  function showDeleteOtpStep(email) {
    const safeEmail = escapeHtml(email);

    renderAuthPage(`
      <div class="auth-form">
        <h2>Confirm Account Deletion</h2>
        <p style="text-align:center;color:var(--text-light);margin-bottom:20px;">Enter the 6-digit OTP sent to <strong>${safeEmail}</strong></p>
        <div class="alert alert-error" style="margin-bottom:20px;">
          Your account will be permanently deleted after successful verification.
        </div>
        <form id="delete-account-confirm-form">
          <div class="form-input-wrapper" data-icon="🔢">
            <input type="text" id="delete-account-otp-security" placeholder="6-digit OTP" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required>
          </div>
          <button type="submit" style="background:linear-gradient(135deg,var(--danger),#dc2626);">Confirm Delete Account <span>→</span></button>
        </form>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="resendDeleteOtpFromWindow(); return false;" style="padding:10px 18px;">Resend OTP</button>
          <a href="#" onclick="showDeleteAccountSecurity(); return false;" style="display:inline-flex;align-items:center;padding:10px 18px;color:var(--primary);font-weight:600;">Back</a>
        </div>
      </div>
    `);

    window.resendDeleteOtpFromWindow = () => resendDeleteOtp(email);

    const otpInput = document.getElementById('delete-account-otp-security');
    otpInput?.focus();
    otpInput?.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').slice(0, 6);
    });

    document.getElementById('delete-account-confirm-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const otp = document.getElementById('delete-account-otp-security').value.trim();

      if (!/^\d{6}$/.test(otp)) {
        window.showAlert('Enter the 6-digit OTP.', 'error');
        return;
      }

      if (!confirm('Delete this account permanently? This cannot be undone.')) return;

      try {
        const result = await window.apiCall('/account/confirm-delete-otp', 'POST', { email, otp });
        clearStoredSession();
        alert(result.message || 'Account deleted successfully.');
        window.location.assign('/');
      } catch (error) {
        console.error('Delete OTP confirmation error:', error);
        window.showAlert(error.message || 'Invalid or expired deletion OTP.', 'error');
      }
    });
  }

  function showSpamHelpSecurity() {
    window.showAlert(
      'Check Spam/Junk, Gmail Promotions and Updates, then search for "Hostel Management". You can also use Resend OTP.',
      'info'
    );
  }

  async function resendVerificationOtp(email) {
    try {
      window.showAlert('Sending OTP to your email...', 'info');
      const result = await window.apiCall('/auth/send-verification-otp', 'POST', { email });
      window.showAlert(result.message || 'OTP sent successfully. Check your email.', 'success');
    } catch (error) {
      console.error('Verification OTP resend error:', error);
      window.showAlert(error.message || 'Failed to resend OTP.', 'error');
    }
  }

  function showEmailVerificationSecurity(email) {
    const safeEmail = escapeHtml(email);

    renderAuthPage(`
      <div class="auth-form">
        <h2>Verify Your Email</h2>
        <p class="auth-subtitle">We've sent a 6-digit OTP to</p>
        <p style="text-align:center;color:var(--primary);font-weight:700;font-size:16px;margin-bottom:18px;">${safeEmail}</p>

        <div style="background:linear-gradient(135deg,#FFA500 0%,#FF8C00 100%);color:white;padding:16px;border-radius:var(--radius);margin-bottom:24px;">
          <strong>⚠️ Check your Spam/Junk folder if needed.</strong>
          <p style="margin:8px 0 0;font-size:14px;">Also check Promotions and Updates tabs in Gmail.</p>
        </div>

        <form id="verify-email-security-form">
          <input type="hidden" id="verify-email-security" value="${safeEmail}">
          <div class="form-group" style="margin-bottom:24px;">
            <label for="verify-otp-security" style="display:block;text-align:center;margin-bottom:12px;font-size:14px;color:var(--text-secondary);">Enter OTP</label>
            <input type="text" id="verify-otp-security" placeholder="000000" maxlength="6" inputmode="numeric" autocomplete="one-time-code" style="width:100%;padding:18px;font-size:32px;text-align:center;letter-spacing:12px;font-weight:700;border:2px solid var(--border);border-radius:var(--radius);" required>
            <small style="display:block;text-align:center;margin-top:8px;color:var(--text-secondary);">⏱️ OTP is valid for 10 minutes</small>
          </div>

          <button type="submit" class="btn btn-primary" style="width:100%;padding:16px;font-size:16px;margin-bottom:16px;">✅ Verify Email</button>

          <div style="background:#f8f9fa;border:2px solid #e9ecef;border-radius:var(--radius);padding:16px;margin-bottom:16px;">
            <p style="margin:0 0 12px;text-align:center;color:#495057;font-size:14px;font-weight:600;">📧 Still didn't receive the OTP?</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
              <button type="button" onclick="resendVerificationOtpFromWindow(); return false;" class="btn btn-secondary" style="padding:10px 20px;font-size:14px;flex:1;min-width:140px;">📨 Resend OTP</button>
              <button type="button" onclick="showSpamHelpSecurityFromWindow(); return false;" class="btn" style="padding:10px 20px;font-size:14px;background:#6c757d;color:white;flex:1;min-width:140px;">❓ Help</button>
            </div>
          </div>

          <p style="text-align:center;margin-top:16px;">
            <a href="#" onclick="goToLoginFromWindow(); return false;" style="color:var(--primary);text-decoration:none;font-weight:600;">← Back to Login</a>
          </p>
        </form>
      </div>
    `);

    window.resendVerificationOtpFromWindow = () => resendVerificationOtp(email);
    window.showSpamHelpSecurityFromWindow = showSpamHelpSecurity;

    const otpInput = document.getElementById('verify-otp-security');
    otpInput?.focus();
    otpInput?.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').slice(0, 6);
    });
  }

  async function handleEmailVerificationSecurity(event) {
    event.preventDefault();

    const email = document.getElementById('verify-email-security')?.value.trim().toLowerCase();
    const otp = document.getElementById('verify-otp-security')?.value.trim();

    if (!email || !/^\d{6}$/.test(otp || '')) {
      window.showAlert('Please enter a valid 6-digit OTP.', 'error');
      return false;
    }

    try {
      const result = await window.apiCall('/auth/verify-email-otp', 'POST', { email, otp });
      clearStoredSession();
      window.showAlert(result.message || 'Email verified successfully!', 'success');
      setTimeout(() => window.location.assign('/'), 500);
    } catch (error) {
      console.error('Email verification error:', error);
      window.showAlert(error.message || 'Verification failed.', 'error');
    }

    return false;
  }

  async function validateExistingSession() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const result = await window.apiCall('/auth/me', 'GET');
      if (result?.user) {
        localStorage.setItem('user', JSON.stringify(result.user));
        window.updateAuthState?.(token, result.user);
      }
    } catch (error) {
      console.warn('Stored session is no longer valid:', error);
      clearStoredSession();
    }
  }

  window.handleForgotPassword = handleForgotPasswordSecurity;
  window.showResetPassword = showResetPasswordSecurity;
  window.showDeleteAccount = showDeleteAccountSecurity;
  window.showEmailVerification = showEmailVerificationSecurity;
  window.handleEmailVerification = handleEmailVerificationSecurity;
  window.showSpamHelp = showSpamHelpSecurity;
  window.resendOTP = resendVerificationOtp;

  document.addEventListener('DOMContentLoaded', () => {
    const resetToken = getResetToken();
    if (resetToken) setTimeout(() => showResetPasswordSecurity(resetToken), 100);
    setTimeout(validateExistingSession, 300);
  });
})();
