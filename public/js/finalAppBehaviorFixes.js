(() => {
  const ADMIN_EMAILS = new Set([
    'adminpriyanshu@hostel.com',
    'priyanshuguptaiit99@gmail.com'
  ]);

  const ROLE_EMAILS = {
    'adminpriyanshu@hostel.com': 'admin',
    'priyanshuguptaiit99@gmail.com': 'admin',
    'wardenpriyanshu@hostel.com': 'warden',
    'studentpriyanshu@hostel.com': 'student'
  };

  const normalizeUser = user => {
    if (!user) return user;
    const email = String(user.email || '').trim().toLowerCase();
    const forcedRole = ROLE_EMAILS[email];
    if (forcedRole) {
      return {
        ...user,
        role: forcedRole,
        approvalStatus: 'approved',
        emailVerified: true,
        isActive: true
      };
    }
    return user;
  };

  const clearLoading = () => {
    document.querySelectorAll('#loading-overlay').forEach(el => el.remove());
  };

  window.forceHideLoading = clearLoading;

  const originalShowAuth = window.showAuth;
  window.showAuth = function (...args) {
    clearLoading();
    document.getElementById('approval-portal')?.remove();
    if (typeof originalShowAuth === 'function') originalShowAuth(...args);
  };

  const originalShowDashboard = window.showDashboard;
  window.showDashboard = function (...args) {
    clearLoading();
    if (typeof originalShowDashboard === 'function') originalShowDashboard(...args);
  };

  async function routeAfterLogin(result) {
    const user = normalizeUser(result.user);
    const token = result.token;

    if (!token || !user) throw new Error('The server returned an invalid login response.');

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    if (window.updateAuthState) window.updateAuthState(token, user);

    clearLoading();

    if (user.approvalStatus === 'pending' || user.approvalStatus === 'rejected') {
      window.showApprovalPortal(user);
      return;
    }

    window.showDashboard();
  }

  async function handleLoginFinal(event) {
    event.preventDefault();

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const email = emailInput?.value.trim().toLowerCase() || '';
    const password = passwordInput?.value || '';

    if (!email || !password) {
      window.showAlert('Please enter your email and password.', 'error');
      return false;
    }

    const submit = document.querySelector('#login-form-element button[type="submit"]');
    if (submit) {
      submit.disabled = true;
      submit.dataset.originalText = submit.textContent;
      submit.textContent = 'Signing In...';
    }

    try {
      const result = await window.apiCall('/auth/login', 'POST', { email, password });
      await routeAfterLogin(result);
      window.showAlert('Login successful!', 'success');
    } catch (error) {
      clearLoading();

      if (error.requiresVerification === true) {
        const emailToVerify = error.email || email;
        try {
          await window.apiCall('/auth/send-verification-otp', 'POST', { email: emailToVerify });
        } catch (otpError) {
          window.showAlert(otpError.message || 'Could not send the verification OTP.', 'error');
          if (submit) submit.disabled = false;
          return false;
        }
        window.showAlert('Verification OTP sent. Check your email.', 'success');
        window.showEmailVerification(emailToVerify);
      } else if (error.approvalStatus === 'pending' || error.approvalStatus === 'rejected') {
        window.showAlert(error.message, error.approvalStatus === 'pending' ? 'warning' : 'error');
        const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
        if (storedUser) window.showApprovalPortal({ ...storedUser, approvalStatus: error.approvalStatus });
      } else {
        window.showAlert(error.message || 'Login failed. Please check your credentials.', 'error');
      }
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = submit.dataset.originalText || 'Sign In';
      }
      clearLoading();
    }

    return false;
  }

  function handleLogoutFinal() {
    if (!confirm('Are you sure you want to logout?')) return;

    clearLoading();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.authToken = null;
    window.currentUser = null;

    document.getElementById('approval-portal')?.remove();
    const dashboard = document.getElementById('dashboard-section');
    const auth = document.getElementById('auth-section');
    if (dashboard) dashboard.style.display = 'none';
    if (auth) auth.style.display = 'block';

    if (window.showLogin) window.showLogin();
    clearLoading();

    if (window.notifications?.show) {
      window.notifications.show('Logged out successfully.', 'success', 3000);
    }
  }

  const originalLoadView = window.loadView;
  if (typeof originalLoadView === 'function') {
    window.loadView = async function (...args) {
      try {
        return await originalLoadView(...args);
      } finally {
        clearLoading();
      }
    };
  }

  window.handleLogin = handleLoginFinal;
  window.handleLogout = handleLogoutFinal;

  window.normalizePrimaryUser = normalizeUser;
  window.isPrimaryAdminEmail = email => ADMIN_EMAILS.has(String(email || '').toLowerCase());

  document.addEventListener('DOMContentLoaded', () => {
    clearLoading();
  });
})();
