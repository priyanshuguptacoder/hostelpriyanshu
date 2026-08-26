(() => {
  function clearStoredSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.updateAuthState?.(null, null);
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
      window.showAlert(result.message || 'If the account exists, a reset link has been sent.', 'success');
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
    const authSection = document.getElementById('auth-section');
    if (!authSection || !token) return;

    authSection.innerHTML = `
      <div class="auth-container" style="max-width:550px;">
        <h1>🔐 Reset Password</h1>
        <p class="auth-subtitle">Create a new password for your account</p>
        <form id="reset-password-security-form">
          <div class="form-input-wrapper" data-icon="🔒">
            <input type="password" id="reset-password-security" placeholder="New Password (min 6 characters)" minlength="6" required>
          </div>
          <div class="form-input-wrapper" data-icon="✅">
            <input type="password" id="reset-password-security-confirm" placeholder="Confirm New Password" minlength="6" required>
          </div>
          <button type="submit">Reset Password</button>
        </form>
        <p style="text-align:center;margin-top:16px;">
          <a href="#" onclick="window.showLogin(); return false;">← Back to Sign In</a>
        </p>
      </div>
    `;

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
        window.showAlert(result.message || 'Password reset successfully.', 'success');
        setTimeout(() => window.showLogin(), 700);
      } catch (error) {
        console.error('Reset password error:', error);
        window.showAlert(error.message || 'Reset link is invalid or expired.', 'error');
      }
    });
  }

  function showDeleteAccountSecurity() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;

    authSection.innerHTML = `
      <div class="auth-container" style="max-width:550px;">
        <h1 style="color:var(--danger);">🗑️ Delete My Account</h1>
        <p class="auth-subtitle">Verify your email before permanently deleting your account.</p>
        <div class="alert alert-error" style="margin-bottom:20px;">
          This action cannot be undone.
        </div>
        <form id="delete-account-request-form">
          <div class="form-input-wrapper" data-icon="📧">
            <input type="email" id="delete-account-email-security" placeholder="Email Address" required>
          </div>
          <button type="submit" style="background:var(--danger);">Send Deletion OTP</button>
        </form>
        <p style="text-align:center;margin-top:16px;">
          <a href="#" onclick="window.showLogin(); return false;">← Back to Sign In</a>
        </p>
      </div>
    `;

    document.getElementById('delete-account-request-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('delete-account-email-security').value.trim().toLowerCase();

      try {
        const result = await window.apiCall('/account/request-delete-otp', 'POST', { email });
        window.showAlert(result.message || 'If the account exists, a deletion OTP has been sent.', 'success');
        showDeleteOtpStep(email);
      } catch (error) {
        console.error('Delete OTP request error:', error);
        window.showAlert(error.message || 'Unable to send deletion OTP.', 'error');
      }
    });
  }

  function showDeleteOtpStep(email) {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;

    authSection.innerHTML = `
      <div class="auth-container" style="max-width:550px;">
        <h1 style="color:var(--danger);">🗑️ Confirm Account Deletion</h1>
        <p class="auth-subtitle">Enter the OTP sent to <strong>${email}</strong></p>
        <div class="alert alert-error" style="margin-bottom:20px;">
          Your account will be permanently deleted after successful verification.
        </div>
        <form id="delete-account-confirm-form">
          <div class="form-input-wrapper" data-icon="🔢">
            <input type="text" id="delete-account-otp-security" placeholder="6-digit OTP" inputmode="numeric" maxlength="6" required>
          </div>
          <button type="submit" style="background:var(--danger);">Confirm Delete Account</button>
        </form>
        <p style="text-align:center;margin-top:16px;">
          <a href="#" onclick="showDeleteAccountSecurity(); return false;">← Back</a>
        </p>
      </div>
    `;

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
        window.showLogin();
      } catch (error) {
        console.error('Delete OTP confirmation error:', error);
        window.showAlert(error.message || 'Invalid or expired deletion OTP.', 'error');
      }
    });
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
      window.showAuth?.();
    }
  }

  window.handleForgotPassword = handleForgotPasswordSecurity;
  window.showResetPassword = showResetPasswordSecurity;
  window.showDeleteAccount = showDeleteAccountSecurity;

  document.addEventListener('DOMContentLoaded', () => {
    const resetToken = getResetToken();
    if (resetToken) setTimeout(() => showResetPasswordSecurity(resetToken), 100);
    setTimeout(validateExistingSession, 250);
  });
})();
