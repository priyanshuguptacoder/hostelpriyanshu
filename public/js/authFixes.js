(() => {
  let googlePopup = null;
  let googleMessageHandler = null;

  function clearGoogleListener() {
    if (googleMessageHandler) {
      window.removeEventListener('message', googleMessageHandler);
      googleMessageHandler = null;
    }
  }

  async function handleLoginFixed(event) {
    event.preventDefault();

    const email = document.getElementById('login-email')?.value.trim().toLowerCase();
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) {
      window.showAlert('Email and password are required.', 'error');
      return false;
    }

    try {
      const result = await window.apiCall('/auth/login', 'POST', { email, password });

      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      window.updateAuthState?.(result.token, result.user);

      if (result.user.approvalStatus === 'pending' || result.user.approvalStatus === 'rejected') {
        window.showApprovalPortal(result.user);
      } else {
        window.showAlert('Login successful!', 'success');
        setTimeout(() => window.showDashboard(), 300);
      }
    } catch (error) {
      console.error('Fixed login error:', error);

      if (error.requiresVerification) {
        const emailToVerify = error.email || email;

        try {
          await window.apiCall('/auth/send-verification-otp', 'POST', { email: emailToVerify });
          window.showAlert('OTP sent. Please verify your email before logging in.', 'warning');
          setTimeout(() => window.showEmailVerification(emailToVerify), 300);
        } catch (otpError) {
          console.error('Login OTP error:', otpError);
          window.showAlert(otpError.message || 'Could not send verification OTP.', 'error');
        }
      } else {
        window.showAlert(error.message || 'Login failed', 'error');
      }
    }

    return false;
  }

  async function handleRegisterFixed(event) {
    event.preventDefault();

    const roleElement = document.getElementById('reg-role');
    const email = document.getElementById('reg-email')?.value.trim().toLowerCase();

    if (!email) {
      window.showAlert('Email is required', 'error');
      return false;
    }

    const data = {
      name: document.getElementById('reg-name').value.trim(),
      collegeId: document.getElementById('reg-college-id').value.trim(),
      email,
      password: document.getElementById('reg-password').value,
      role: roleElement ? roleElement.value : 'student',
      roomNumber: document.getElementById('reg-room').value.trim(),
      hostelBlock: document.getElementById('reg-hostel').value.trim(),
      department: document.getElementById('reg-department').value.trim(),
      year: document.getElementById('reg-year').value ? parseInt(document.getElementById('reg-year').value, 10) : null,
      phoneNumber: document.getElementById('reg-phone').value.trim()
    };

    try {
      window.showAlert('Creating your account and sending OTP...', 'info');
      const result = await window.apiCall('/auth/register', 'POST', data);

      document.getElementById('register-form-element')?.reset();

      if (result.requiresVerification) {
        window.showAlert('OTP sent. Check your email and enter the 6-digit code.', 'success');
        setTimeout(() => window.showEmailVerification(result.user?.email || email), 300);
      } else {
        window.showAlert(result.message || 'Registration successful', 'success');
        setTimeout(() => window.showLogin(), 800);
      }
    } catch (error) {
      console.error('Fixed registration error:', error);
      window.showAlert(error.message || 'Registration failed', 'error');
    }

    return false;
  }

  async function handleGoogleLoginFixed() {
    try {
      window.showLoading?.();
      const result = await window.apiCall('/auth/google', 'GET');

      if (!result.url) throw new Error('Failed to get Google authentication URL');

      const width = 500;
      const height = 600;
      const left = Math.max(0, (window.screen.width - width) / 2);
      const top = Math.max(0, (window.screen.height - height) / 2);

      googlePopup = window.open(
        result.url,
        'Google Sign In',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!googlePopup) {
        window.hideLoading?.();
        window.showAlert('Popup blocked. Please allow popups for this site.', 'error');
        return;
      }

      clearGoogleListener();

      googleMessageHandler = async (event) => {
        if (!event.data || !['GOOGLE_AUTH_SUCCESS', 'GOOGLE_AUTH_ERROR'].includes(event.data.type)) {
          return;
        }

        if (event.source !== googlePopup) return;

        if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          clearGoogleListener();
          googlePopup.close();
          googlePopup = null;
          window.hideLoading?.();
          window.showAlert('Google authentication was cancelled or failed.', 'error');
          return;
        }

        clearGoogleListener();
        googlePopup.close();
        googlePopup = null;

        try {
          const authResult = await window.apiCall('/auth/google/callback', 'POST', {
            code: event.data.code
          });

          window.hideLoading?.();

          if (authResult.requiresVerification) {
            window.showAlert('Google signup successful. Please verify your email with the OTP.', 'warning');
            setTimeout(() => window.showEmailVerification(authResult.user.email), 300);
            return;
          }

          localStorage.setItem('token', authResult.token);
          localStorage.setItem('user', JSON.stringify(authResult.user));
          window.updateAuthState?.(authResult.token, authResult.user);

          if (authResult.user.approvalStatus === 'pending' || authResult.user.approvalStatus === 'rejected') {
            window.showApprovalPortal(authResult.user);
          } else {
            window.showAlert('Google login successful!', 'success');
            setTimeout(() => window.showDashboard(), 300);
          }
        } catch (error) {
          window.hideLoading?.();
          console.error('Fixed Google authentication error:', error);
          window.showAlert(error.message || 'Google authentication failed', 'error');
        }
      };

      window.addEventListener('message', googleMessageHandler);
    } catch (error) {
      window.hideLoading?.();
      console.error('Google login start error:', error);
      window.showAlert(error.message || 'Failed to start Google login', 'error');
    }
  }

  async function handleForgotPasswordFixed(event) {
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
      window.showAlert(error.message || 'Unable to send reset link', 'error');
    }

    return false;
  }

  async function resendOTPFixed(email) {
    try {
      window.showAlert('Sending OTP to your email...', 'info');
      const result = await window.apiCall('/auth/send-verification-otp', 'POST', { email });
      window.showAlert(result.message || 'OTP sent. Check your email.', 'success');
    } catch (error) {
      console.error('Resend OTP error:', error);
      window.showAlert(error.message || 'Failed to resend OTP.', 'error');
    }
  }

  function showResetPassword(token) {
    const authSection = document.getElementById('auth-section');
    if (!authSection || !token) return;

    authSection.innerHTML = `
      <div class="auth-container" style="max-width: 550px;">
        <h1>🔐 Reset Password</h1>
        <p class="auth-subtitle">Create a new password for your account</p>
        <form id="reset-password-form">
          <div class="form-input-wrapper" data-icon="🔒">
            <input type="password" id="reset-password" placeholder="New Password (min 6 characters)" minlength="6" required>
          </div>
          <div class="form-input-wrapper" data-icon="✅">
            <input type="password" id="reset-password-confirm" placeholder="Confirm New Password" minlength="6" required>
          </div>
          <button type="submit">Reset Password</button>
        </form>
        <p style="text-align:center;margin-top:16px;">
          <a href="#" onclick="window.showLogin(); return false;">← Back to Sign In</a>
        </p>
      </div>
    `;

    document.getElementById('reset-password-form').addEventListener('submit', async (event) => {
      event.preventDefault();

      const password = document.getElementById('reset-password').value;
      const confirmPassword = document.getElementById('reset-password-confirm').value;

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

        window.history.replaceState({}, document.title, window.location.pathname);
        window.showAlert(result.message || 'Password reset successfully.', 'success');
        setTimeout(() => window.showLogin(), 800);
      } catch (error) {
        console.error('Reset password error:', error);
        window.showAlert(error.message || 'Unable to reset password', 'error');
      }
    });
  }

  function showDeleteAccountFixed() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;

    authSection.innerHTML = `
      <div class="auth-container" style="max-width: 550px;">
        <h1 style="color:var(--danger);">🗑️ Delete My Account</h1>
        <p class="auth-subtitle">This permanently deletes your account.</p>
        <div class="alert alert-error" style="margin-bottom:20px;">
          This action cannot be undone. Your account will be permanently removed.
        </div>
        <form id="delete-account-form-fixed">
          <div class="form-input-wrapper" data-icon="📧">
            <input type="email" id="delete-account-email" placeholder="Email Address" required>
          </div>
          <div class="form-input-wrapper" data-icon="🔒">
            <input type="password" id="delete-account-password" placeholder="Account Password" required>
          </div>
          <button type="submit" style="background:var(--danger);">Delete Account Permanently</button>
        </form>
        <p style="text-align:center;margin-top:16px;">
          <a href="#" onclick="window.showLogin(); return false;">← Back to Sign In</a>
        </p>
      </div>
    `;

    document.getElementById('delete-account-form-fixed').addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = document.getElementById('delete-account-email').value.trim().toLowerCase();
      const password = document.getElementById('delete-account-password').value;

      if (!confirm('Are you sure you want to permanently delete this account?')) return;

      try {
        const result = await window.apiCall('/account/delete-account', 'POST', { email, password });

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.updateAuthState?.(null, null);

        alert(result.message || 'Account deleted successfully.');
        window.showLogin();
      } catch (error) {
        console.error('Delete account error:', error);
        window.showAlert(error.message || 'Unable to delete account', 'error');
      }
    });
  }

  window.handleLogin = handleLoginFixed;
  window.handleRegister = handleRegisterFixed;
  window.handleGoogleLogin = handleGoogleLoginFixed;
  window.handleForgotPassword = handleForgotPasswordFixed;
  window.resendOTP = resendOTPFixed;
  window.showResetPassword = showResetPassword;
  window.showDeleteAccount = showDeleteAccountFixed;

  document.addEventListener('DOMContentLoaded', () => {
    const token = new URLSearchParams(window.location.search).get('resetToken');
    if (token) {
      setTimeout(() => showResetPassword(token), 100);
    }
  });
})();
