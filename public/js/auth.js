/**
 * Hostel Management System — Authentication Module
 * Handles login, register, Google OAuth, OTP verification, password reset, account deletion.
 */

let isLoggingIn = false;
let isRegistering = false;
let verificationEmail = '';
let googleAuthPopup = null;
let googleAuthListener = null;

// ==================== LOGIN ====================
async function handleLogin(event) {
    event.preventDefault();
    if (isLoggingIn) return false;
    isLoggingIn = true;

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
        submitBtn.textContent = 'Signing in...';
        submitBtn.disabled = true;

        const result = await apiCall('/auth/login', 'POST', { email, password });

        if (result.token) {
            window.updateAuthState(result.user, result.token);
        }
    } catch (error) {
        if (error.requiresVerification) {
            verificationEmail = error.email || email;
            showOtpVerification(verificationEmail, false);
            // Send OTP automatically
            apiCall('/auth/send-verification-otp', 'POST', { email: verificationEmail }, { ignoreAbort: true })
                .catch(e => showAlert(e.message, 'error'));
        } else {
            showAlert(error.message || 'Login failed. Please try again.', 'error');
            const passField = document.getElementById('login-password');
            if (passField) passField.value = '';
        }
    } finally {
        isLoggingIn = false;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
    return false;
}

// ==================== REGISTER ====================
async function handleRegister(event) {
    event.preventDefault();
    if (isRegistering) return false;
    isRegistering = true;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    const data = {
        name: document.getElementById('reg-name').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        password: document.getElementById('reg-password').value,
        role: document.getElementById('reg-role').value,
        collegeId: document.getElementById('reg-college-id').value.trim(),
        roomNumber: document.getElementById('reg-room').value.trim(),
        hostelBlock: document.getElementById('reg-hostel').value.trim(),
        department: document.getElementById('reg-department').value.trim(),
        year: document.getElementById('reg-year').value,
        phoneNumber: document.getElementById('reg-phone').value.trim()
    };

    try {
        submitBtn.textContent = 'Creating account...';
        submitBtn.disabled = true;

        const result = await apiCall('/auth/register', 'POST', data);

        verificationEmail = data.email;

        if (result.requiresVerification || result.message?.includes('OTP') || result.message?.includes('verify')) {
            showOtpVerification(data.email, false);
            showAlert('Account created! Please verify your email.', 'success');
        } else {
            showAlert(result.message || 'Account created!', 'success');
            setTimeout(() => showLogin(), 2000);
        }
    } catch (error) {
        showAlert(error.message || 'Registration failed.', 'error');
    } finally {
        isRegistering = false;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
    return false;
}

function handleGoogleLogin() {
    if (googleAuthListener) {
        window.removeEventListener('message', googleAuthListener);
        googleAuthListener = null;
    }
    // Step 1: Get the Google auth URL from backend
    apiCall('/auth/google', 'GET', null, { ignoreAbort: true })
        .then(result => {
            if (!result.url) {
                showAlert('Google sign-in is not configured. Please use email login.', 'error');
                return;
            }

            // Close any existing popup
            if (googleAuthPopup && !googleAuthPopup.closed) {
                googleAuthPopup.close();
            }

            // Remove any existing listener
            if (googleAuthListener) {
                window.removeEventListener('message', googleAuthListener);
            }

            // Step 2: Open Google OAuth in popup
            const popupWidth = 500, popupHeight = 600;
            const left = (window.screen.width - popupWidth) / 2;
            const top = (window.screen.height - popupHeight) / 2;
            googleAuthPopup = window.open(
                result.url,
                'googleAuth',
                `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
            );

            if (!googleAuthPopup) {
                showAlert('Popup blocked. Please allow popups for this site and try again.', 'error');
                return;
            }

            // Step 3: Listen for message from google-callback.html
            googleAuthListener = async function(event) {
                if (event.origin !== window.location.origin) return;

                window.removeEventListener('message', googleAuthListener);
                googleAuthListener = null;

                if (googleAuthPopup && !googleAuthPopup.closed) {
                    googleAuthPopup.close();
                }

                if (event.data.type === 'GOOGLE_AUTH_ERROR') {
                    showAlert('Google sign-in was cancelled or failed.', 'error');
                    return;
                }

                if (event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.code) {
                    showLoading(true);
                    try {
                        const authResult = await apiCall('/auth/google/callback', 'POST', { code: event.data.code }, { ignoreAbort: true });

                        if (authResult.requiresVerification) {
                            verificationEmail = authResult.email;
                            hideLoading(true);
                            showOtpVerification(authResult.email, true);
                        } else if (authResult.token) {
                            hideLoading(true);
                            window.updateAuthState(authResult.user, authResult.token);
                        } else {
                            hideLoading(true);
                            showAlert('Google sign-in failed. Please try again.', 'error');
                        }
                    } catch (err) {
                        hideLoading(true);
                        showAlert(err.message || 'Google sign-in failed.', 'error');
                    }
                }
            };

            window.addEventListener('message', googleAuthListener);

            // Fallback: detect if popup closed without sending message
            const popupChecker = setInterval(() => {
                if (googleAuthPopup && googleAuthPopup.closed) {
                    clearInterval(popupChecker);
                    if (googleAuthListener) {
                        window.removeEventListener('message', googleAuthListener);
                        googleAuthListener = null;
                    }
                }
            }, 500);
        })
        .catch(err => {
            showAlert('Could not initiate Google sign-in. Please try again.', 'error');
        });
}

// ==================== OTP VERIFICATION ====================
function showOtpVerification(email, isGoogle = false) {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    let f = document.getElementById('otp-form');
    if (!f) {
        f = document.createElement('div');
        f.id = 'otp-form';
        f.className = 'auth-form';
        document.querySelector('.auth-container').appendChild(f);
    }

    f.dataset.isGoogle = isGoogle ? 'true' : 'false';
    f.innerHTML = `
        <h2>✉️ Verify Your Email</h2>
        <p style="color:var(--text-muted);margin-bottom:20px;font-size:14px;">
            We've sent a 6-digit code to <strong>${email}</strong>. Check your inbox and spam folder.
        </p>
        <form id="otp-form-element" onsubmit="return handleOtpVerification(event)">
            <div class="form-input-wrapper" data-icon="🔑">
                <input type="text" id="otp-input" placeholder="Enter 6-digit code" required
                    maxlength="6" pattern="[0-9]{6}" autocomplete="one-time-code"
                    inputmode="numeric"
                    style="letter-spacing:6px;text-align:center;font-size:22px;font-weight:700;">
            </div>
            <button type="submit" id="verify-otp-btn">Verify Code</button>
        </form>
        <p style="margin-top:16px;">
            Didn't receive it?
            <a href="#" id="resend-otp-link" onclick="resendOtp();return false;">Resend Code</a>
            <span id="resend-timer" style="display:none;color:var(--text-muted);font-size:13px;"></span>
        </p>
        <p style="margin-top:12px;"><a href="#" onclick="showLogin();return false;">← Back to Login</a></p>
    `;

    f.style.display = 'block';
    setTimeout(() => document.getElementById('otp-input')?.focus(), 100);
}

async function handleOtpVerification(event) {
    event.preventDefault();
    const otp = document.getElementById('otp-input').value.trim();
    const isGoogle = document.getElementById('otp-form').dataset.isGoogle === 'true';
    const btn = document.getElementById('verify-otp-btn');
    const orig = btn.textContent;

    if (!/^\d{6}$/.test(otp)) {
        showAlert('Please enter a valid 6-digit code.', 'error');
        return false;
    }

    try {
        btn.textContent = 'Verifying...';
        btn.disabled = true;

        const result = await apiCall('/auth/verify-email-otp', 'POST', {
            email: verificationEmail,
            otp,
            isGoogle
        }, { ignoreAbort: true });

        if (result.token) {
            showAlert('Email verified successfully!', 'success');
            window.updateAuthState(result.user, result.token);
        } else {
            showAlert(result.message || 'Verification successful. You can now log in.', 'success');
            setTimeout(() => showLogin(), 1500);
        }
    } catch (error) {
        showAlert(error.message || 'Invalid or expired OTP.', 'error');
        document.getElementById('otp-input').value = '';
        document.getElementById('otp-input').focus();
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
    return false;
}

let resendCooldown = false;
async function resendOtp() {
    if (resendCooldown) return;

    const link = document.getElementById('resend-otp-link');
    const timer = document.getElementById('resend-timer');

    try {
        resendCooldown = true;
        if (link) { link.style.opacity = '0.5'; link.style.pointerEvents = 'none'; }

        await apiCall('/auth/send-verification-otp', 'POST', { email: verificationEmail }, { ignoreAbort: true });
        showAlert('A new code has been sent to your email.', 'success');

        let secs = 60;
        if (timer) { timer.style.display = 'inline'; timer.textContent = ` (${secs}s)`; }
        const t = setInterval(() => {
            secs--;
            if (timer) timer.textContent = ` (${secs}s)`;
            if (secs <= 0) {
                clearInterval(t);
                resendCooldown = false;
                if (link) { link.style.opacity = '1'; link.style.pointerEvents = ''; }
                if (timer) timer.style.display = 'none';
            }
        }, 1000);
    } catch (error) {
        resendCooldown = false;
        if (link) { link.style.opacity = '1'; link.style.pointerEvents = ''; }
        showAlert(error.message || 'Could not resend OTP.', 'error');
    }
}

// ==================== FORGOT PASSWORD ====================
async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn = event.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;

    try {
        btn.textContent = 'Sending...';
        btn.disabled = true;
        await apiCall('/account/forgot-password', 'POST', { email }, { ignoreAbort: true });
        showAlert('Password reset link sent! Please check your email (and spam folder).', 'success');
        setTimeout(() => showLogin(), 3000);
    } catch (error) {
        showAlert(error.message || 'Failed to send reset link.', 'error');
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
    return false;
}

// ==================== RESET PASSWORD ====================
async function handleResetPassword(event) {
    event.preventDefault();
    const token = window.location.pathname.split('/').filter(Boolean).pop();
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const btn = event.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;

    if (newPassword !== confirmPassword) {
        showAlert('Passwords do not match.', 'error');
        return false;
    }
    if (newPassword.length < 6) {
        showAlert('Password must be at least 6 characters.', 'error');
        return false;
    }

    try {
        btn.textContent = 'Updating...';
        btn.disabled = true;
        await apiCall('/account/reset-password', 'POST', { token, newPassword }, { ignoreAbort: true });
        showAlert('Password updated successfully! Redirecting to login...', 'success');
        setTimeout(() => window.location.href = '/', 2500);
    } catch (error) {
        showAlert(error.message || 'Failed to reset password. The link may have expired.', 'error');
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
    return false;
}

// ==================== DELETE ACCOUNT ====================
async function handleDeleteAccount(event) {
    event.preventDefault();
    const email = document.getElementById('delete-email').value.trim();
    const btn = event.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;

    try {
        btn.textContent = 'Sending...';
        btn.disabled = true;
        await apiCall('/account/request-delete-otp', 'POST', { email }, { ignoreAbort: true });

        // Show OTP input for deletion confirmation
        document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
        let f = document.getElementById('delete-otp-form');
        if (f) f.remove();

        f = document.createElement('div');
        f.id = 'delete-otp-form';
        f.className = 'auth-form';
        f.innerHTML = `
            <h2>⚠️ Confirm Deletion</h2>
            <p style="color:var(--text-muted);margin-bottom:20px;font-size:14px;">
                Enter the 6-digit code sent to <strong>${email}</strong> to permanently delete your account.
            </p>
            <form id="delete-otp-element" onsubmit="return handleConfirmDelete(event, '${email}')">
                <div class="form-input-wrapper" data-icon="🔑">
                    <input type="text" id="delete-otp" placeholder="6-digit code" required maxlength="6" pattern="[0-9]{6}" inputmode="numeric"
                        style="letter-spacing:6px;text-align:center;font-size:22px;font-weight:700;">
                </div>
                <button type="submit" style="background:var(--danger)">Permanently Delete Account</button>
            </form>
            <p style="margin-top:15px;"><a href="#" onclick="showLogin();return false;">← Cancel</a></p>
        `;
        const container = document.querySelector('.auth-container');
        if (container) { container.appendChild(f); f.style.display = 'block'; }
        setTimeout(() => document.getElementById('delete-otp')?.focus(), 100);

    } catch (error) {
        showAlert(error.message || 'Failed to send deletion code.', 'error');
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
    return false;
}

async function handleConfirmDelete(event, email) {
    event.preventDefault();
    const otp = document.getElementById('delete-otp').value.trim();
    const btn = event.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;

    try {
        btn.textContent = 'Deleting...';
        btn.disabled = true;
        await apiCall('/account/confirm-delete-otp', 'POST', { email, otp }, { ignoreAbort: true });
        showAlert('Your account has been permanently deleted.', 'success');
        setTimeout(() => window.location.href = '/', 2500);
    } catch (error) {
        showAlert(error.message || 'Invalid or expired code.', 'error');
        document.getElementById('delete-otp').value = '';
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
    return false;
}
