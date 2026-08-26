(() => {
  let googlePopup = null;
  let googleMessageHandler = null;

  const clearGoogleListener = () => {
    if (googleMessageHandler) {
      window.removeEventListener('message', googleMessageHandler);
      googleMessageHandler = null;
    }
  };

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

  async function handleLoginBehaviorFix(event) {
    event.preventDefault();

    const email = document.getElementById('login-email')?.value.trim().toLowerCase();
    const password = document.getElementById('login-password')?.value || '';

    if (!email || !password) {
      window.showAlert?.('Enter both your email and password.', 'error');
      return false;
    }

    try {
      const result = await window.apiCall('/auth/login', 'POST', { email, password });

      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      window.updateAuthState?.(result.token, result.user);

      if (result.user.approvalStatus === 'pending' || result.user.approvalStatus === 'rejected') {
        window.showApprovalPortal?.(result.user);
        return false;
      }

      window.showAlert?.('Login successful.', 'success');
      setTimeout(() => window.showDashboard?.(), 250);
    } catch (error) {
      console.error('Authentication error:', error);

      if (error.requiresVerification) {
        const emailToVerify = error.email || email;
        try {
          await window.apiCall('/auth/send-verification-otp', 'POST', { email: emailToVerify });
          window.showAlert?.('Your email is not verified. A new OTP was sent.', 'warning');
          setTimeout(() => window.showEmailVerification?.(emailToVerify), 250);
        } catch (otpError) {
          window.showAlert?.(otpError.message || 'Could not send the verification OTP.', 'error');
        }
        return false;
      }

      window.showAlert?.(error.message || 'Unable to sign in.', 'error');
    }

    return false;
  }

  async function handleGoogleLoginBehaviorFix() {
    try {
      window.showLoading?.();
      const result = await window.apiCall('/auth/google', 'GET');

      if (!result?.url) throw new Error('Google sign-in is not configured correctly.');

      const width = 520;
      const height = 680;
      const left = Math.max(0, (window.screen.width - width) / 2);
      const top = Math.max(0, (window.screen.height - height) / 2);

      googlePopup = window.open(
        result.url,
        'Google Sign In',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!googlePopup) {
        window.hideLoading?.();
        window.showAlert?.('Popup blocked. Allow popups for this site and try again.', 'error');
        return;
      }

      clearGoogleListener();

      googleMessageHandler = async (event) => {
        if (!event.data || !['GOOGLE_AUTH_SUCCESS', 'GOOGLE_AUTH_ERROR'].includes(event.data.type)) return;
        if (event.source !== googlePopup) return;

        if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          clearGoogleListener();
          googlePopup.close();
          googlePopup = null;
          window.hideLoading?.();
          window.showAlert?.('Google authentication was cancelled or failed.', 'error');
          return;
        }

        const code = event.data.code;
        if (!code) {
          clearGoogleListener();
          googlePopup.close();
          googlePopup = null;
          window.hideLoading?.();
          window.showAlert?.('Google did not return an authorization code.', 'error');
          return;
        }

        clearGoogleListener();
        googlePopup.close();
        googlePopup = null;

        try {
          const authResult = await window.apiCall('/auth/google/callback', 'POST', { code });
          window.hideLoading?.();

          if (authResult.requiresVerification) {
            window.showAlert?.('Google signup found an unverified email. Check your email for the OTP.', 'warning');
            setTimeout(() => window.showEmailVerification?.(authResult.user?.email), 250);
            return;
          }

          localStorage.setItem('token', authResult.token);
          localStorage.setItem('user', JSON.stringify(authResult.user));
          window.updateAuthState?.(authResult.token, authResult.user);

          if (authResult.user.approvalStatus === 'pending' || authResult.user.approvalStatus === 'rejected') {
            window.showApprovalPortal?.(authResult.user);
          } else {
            window.showAlert?.('Google login successful.', 'success');
            setTimeout(() => window.showDashboard?.(), 250);
          }
        } catch (error) {
          window.hideLoading?.();
          window.showAlert?.(error.message || 'Google authentication failed.', 'error');
        }
      };

      window.addEventListener('message', googleMessageHandler);
    } catch (error) {
      window.hideLoading?.();
      console.error('Google login start error:', error);
      window.showAlert?.(error.message || 'Unable to start Google sign-in.', 'error');
    }
  }

  window.handleLogin = handleLoginBehaviorFix;
  window.handleGoogleLogin = handleGoogleLoginBehaviorFix;
})();
