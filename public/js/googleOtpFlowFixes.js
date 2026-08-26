(() => {
  let googlePopup = null;
  let googleMessageHandler = null;

  const clearGoogleListener = () => {
    if (googleMessageHandler) {
      window.removeEventListener('message', googleMessageHandler);
      googleMessageHandler = null;
    }
  };

  const isSignupMode = () => {
    const register = document.getElementById('register-form');
    if (!register) return false;
    return window.getComputedStyle(register).display !== 'none';
  };

  async function handleGoogleLoginFixed() {
    const mode = isSignupMode() ? 'signup' : 'login';

    try {
      window.showLoading?.();
      const start = await window.apiCall('/auth/google', 'GET');
      if (!start?.url) throw new Error('Google authentication is not configured correctly.');

      const width = 520;
      const height = 680;
      const left = Math.max(0, (window.screen.width - width) / 2);
      const top = Math.max(0, (window.screen.height - height) / 2);

      googlePopup = window.open(
        start.url,
        'Google Sign In',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!googlePopup) {
        window.hideLoading?.();
        window.showAlert?.('Popup blocked. Please allow popups for this site and try again.', 'error');
        return false;
      }

      clearGoogleListener();

      googleMessageHandler = async event => {
        if (!event.data || !['GOOGLE_AUTH_SUCCESS', 'GOOGLE_AUTH_ERROR'].includes(event.data.type)) return;
        if (event.source !== googlePopup) return;

        clearGoogleListener();
        try { googlePopup.close(); } catch (_) {}
        googlePopup = null;

        if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          window.hideLoading?.();
          window.showAlert?.('Google authentication was cancelled or failed.', 'error');
          return;
        }

        if (!event.data.code) {
          window.hideLoading?.();
          window.showAlert?.('Google did not return an authorization code.', 'error');
          return;
        }

        try {
          const result = await window.apiCall('/auth/google/callback', 'POST', {
            code: event.data.code,
            mode
          });

          window.hideLoading?.();

          if (result.requiresVerification) {
            window.showAlert?.(
              mode === 'signup'
                ? 'Google signup started. Check your email for the OTP.'
                : 'Your Google email needs verification. A fresh OTP was sent.',
              'warning'
            );
            setTimeout(() => window.showEmailVerification?.(result.user.email), 250);
            return;
          }

          startAuthenticatedSession(result);
        } catch (error) {
          window.hideLoading?.();
          window.showAlert?.(error.message || 'Google authentication failed.', 'error');
        }
      };

      window.addEventListener('message', googleMessageHandler);
    } catch (error) {
      window.hideLoading?.();
      console.error('Google flow error:', error);
      window.showAlert?.(error.message || 'Unable to start Google authentication.', 'error');
    }

    return false;
  }

  function startAuthenticatedSession(result) {
    if (!result?.token || !result?.user) {
      window.showAlert?.('Authentication succeeded but no session was returned. Please try again.', 'error');
      return;
    }

    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    window.updateAuthState?.(result.token, result.user);

    if (result.user.approvalStatus === 'pending' || result.user.approvalStatus === 'rejected') {
      window.showApprovalPortal?.(result.user);
      return;
    }

    window.showAlert?.('Login successful.', 'success');
    setTimeout(() => window.showDashboard?.(), 200);
  }

  const originalShowEmailVerification = window.showEmailVerification;

  function showEmailVerificationFixed(email) {
    if (typeof originalShowEmailVerification === 'function') {
      originalShowEmailVerification(email);
    } else {
      return;
    }

    setTimeout(() => {
      const form = document.getElementById('verify-email-security-form');
      if (!form || form.dataset.bound === 'true') return;

      form.dataset.bound = 'true';
      form.addEventListener('submit', window.handleEmailVerificationFixed);
    }, 0);
  }

  async function handleEmailVerificationFixed(event) {
    event.preventDefault();

    const email = document.getElementById('verify-email-security')?.value.trim().toLowerCase();
    const otp = document.getElementById('verify-otp-security')?.value.trim();

    if (!email || !/^\d{6}$/.test(otp || '')) {
      window.showAlert?.('Please enter a valid 6-digit OTP.', 'error');
      return false;
    }

    try {
      const result = await window.apiCall('/auth/verify-email-otp', 'POST', { email, otp });
      window.hideLoading?.();
      startAuthenticatedSession(result);
    } catch (error) {
      console.error('OTP verification error:', error);
      window.showAlert?.(error.message || 'Verification failed.', 'error');
    }

    return false;
  }

  window.handleGoogleLogin = handleGoogleLoginFixed;
  window.showEmailVerification = showEmailVerificationFixed;
  window.handleEmailVerificationFixed = handleEmailVerificationFixed;
})();
