// Authentication functions
console.log('Auth.js loading...');

let isLoggingIn = false;
let isRegistering = false;

async function handleLogin(event) {
    event.preventDefault();

    if (isLoggingIn) return false;
    isLoggingIn = true;

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const result = await window.apiCall('/auth/login', 'POST', { email, password });

        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));

        if (window.updateAuthState) {
            window.updateAuthState(result.token, result.user);
        }

        if (result.user.approvalStatus === 'pending') {
            window.showAlert('Account pending approval', 'warning');
            setTimeout(() => window.showApprovalPortal(result.user), 500);
        } else if (result.user.approvalStatus === 'rejected') {
            window.showAlert('Account rejected', 'error');
            setTimeout(() => window.showApprovalPortal(result.user), 500);
        } else {
            window.showAlert('Login successful!', 'success');
            setTimeout(() => window.showDashboard(), 500);
        }
    } catch (error) {
        console.error('Login error:', error);

        if (error.requiresVerification || error.statusCode === 403) {
            const emailToVerify = error.email || email;

            try {
                await window.apiCall('/auth/send-verification-otp', 'POST', {
                    email: emailToVerify
                });
            } catch (otpError) {
                console.error('OTP send error:', otpError);
            }

            showEmailVerification(emailToVerify);
        } else {
            alert('❌ Login failed: ' + error.message);
            window.showAlert(error.message || 'Login failed', 'error');
        }
    } finally {
        isLoggingIn = false;
    }

    return false;
}

async function handleRegister(event) {
    event.preventDefault();

    if (isRegistering) return false;
    isRegistering = true;

    const roleElement = document.getElementById('reg-role');
    const email = document.getElementById('reg-email').value.trim();

    const data = {
        name: document.getElementById('reg-name').value.trim(),
        collegeId: document.getElementById('reg-college-id').value.trim(),
        email,
        password: document.getElementById('reg-password').value,
        role: roleElement ? roleElement.value : 'student',
        roomNumber: document.getElementById('reg-room').value.trim(),
        hostelBlock: document.getElementById('reg-hostel').value.trim(),
        department: document.getElementById('reg-department').value.trim(),
        year: document.getElementById('reg-year').value
            ? parseInt(document.getElementById('reg-year').value, 10)
            : null,
        phoneNumber: document.getElementById('reg-phone').value.trim()
    };

    try {
        const result = await window.apiCall('/auth/register', 'POST', data);

        document.getElementById('register-form-element').reset();

        if (result.requiresVerification) {
            window.showAlert('Registration successful! Check your email for the OTP.', 'success');
            setTimeout(() => showEmailVerification(email), 500);
        } else {
            window.showAlert(result.message || 'Registration successful!', 'success');
            setTimeout(() => window.showLogin(), 1000);
        }
    } catch (error) {
        console.error('Register error:', error);
        alert('❌ Registration failed: ' + error.message);
        window.showAlert(error.message || 'Registration failed', 'error');
    } finally {
        isRegistering = false;
    }

    return false;
}

async function handleForgotPassword(event) {
    event.preventDefault();
    window.showAlert('Please contact the system administrator to reset your password.', 'info');
    setTimeout(() => window.showLogin(), 3000);
    return false;
}

function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) return;

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.authToken = null;
    window.currentUser = null;

    if (window.updateAuthState) {
        window.updateAuthState(null, null);
    }

    window.showAlert('Logged out successfully', 'success');
    setTimeout(() => {
        if (window.showAuth) window.showAuth();
        else window.location.reload();
    }, 500);
}

window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleForgotPassword = handleForgotPassword;
window.handleLogout = handleLogout;

// ==================== GOOGLE OAUTH ====================
async function handleGoogleLogin() {
    try {
        showLoading();

        const result = await window.apiCall('/auth/google', 'GET');

        if (!result.url) {
            throw new Error('Failed to get Google auth URL');
        }

        const width = 500;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const popup = window.open(
            result.url,
            'Google Sign In',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
            hideLoading();
            window.showAlert('Popup blocked! Please allow popups for this site.', 'error');
            return;
        }

        const handleMessage = async (event) => {
            if (event.origin !== window.location.origin) return;

            if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                window.removeEventListener('message', handleMessage);
                popup.close();

                try {
                    const authResult = await window.apiCall('/auth/google/callback', 'POST', {
                        code: event.data.code
                    });

                    localStorage.setItem('token', authResult.token);
                    localStorage.setItem('user', JSON.stringify(authResult.user));

                    if (window.updateAuthState) {
                        window.updateAuthState(authResult.token, authResult.user);
                    }

                    hideLoading();
                    window.showAlert('Google login successful!', 'success');
                    setTimeout(() => window.showDashboard(), 500);
                } catch (error) {
                    hideLoading();
                    console.error('Google auth error:', error);
                    window.showAlert(error.message || 'Google authentication failed', 'error');
                }
            }

            if (event.data.type === 'GOOGLE_AUTH_ERROR') {
                window.removeEventListener('message', handleMessage);
                popup.close();
                hideLoading();
                window.showAlert('Google authentication cancelled or failed', 'error');
            }
        };

        window.addEventListener('message', handleMessage);
    } catch (error) {
        hideLoading();
        console.error('Google login error:', error);
        window.showAlert(error.message || 'Failed to initiate Google login', 'error');
    }
}

window.handleGoogleLogin = handleGoogleLogin;

// ==================== EMAIL VERIFICATION ====================
function showEmailVerification(email) {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;

    authSection.innerHTML = `
        <div class="auth-container" style="max-width: 550px;">
            <h1>📧 Verify Your Email</h1>
            <p class="auth-subtitle">We've sent a 6-digit OTP to</p>
            <p style="text-align:center;color:var(--primary);font-weight:700;font-size:16px;margin-bottom:16px;">${email}</p>

            <div style="background:linear-gradient(135deg,#FFA500 0%,#FF8C00 100%);color:white;padding:16px;border-radius:var(--radius);margin-bottom:24px;">
                <strong>⚠️ Check your Spam/Junk folder if needed.</strong>
                <p style="margin:8px 0 0;font-size:14px;">Also check Promotions and Updates tabs in Gmail.</p>
            </div>

            <form id="verify-email-form" onsubmit="return handleEmailVerification(event)">
                <input type="hidden" id="verify-email" value="${email}">

                <div class="form-group" style="margin-bottom:24px;">
                    <label for="verify-otp" style="display:block;text-align:center;margin-bottom:12px;font-size:14px;color:var(--text-secondary);">Enter OTP</label>
                    <input
                        type="text"
                        id="verify-otp"
                        placeholder="000000"
                        maxlength="6"
                        pattern="[0-9]{6}"
                        style="width:100%;padding:18px;font-size:32px;text-align:center;letter-spacing:12px;font-weight:700;border:2px solid var(--border);border-radius:var(--radius);"
                        required
                        autocomplete="off"
                    >
                    <small style="display:block;text-align:center;margin-top:8px;color:var(--text-secondary);">⏱️ OTP is valid for 10 minutes</small>
                </div>

                <button type="submit" class="btn btn-primary" style="width:100%;padding:16px;font-size:16px;margin-bottom:16px;">✅ Verify Email</button>

                <div style="background:#f8f9fa;border:2px solid #e9ecef;border-radius:var(--radius);padding:16px;margin-bottom:16px;">
                    <p style="margin:0 0 12px;text-align:center;color:#495057;font-size:14px;font-weight:600;">📧 Still didn't receive the OTP?</p>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                        <button type="button" onclick="resendOTP('${email}');return false;" class="btn btn-secondary" style="padding:10px 20px;font-size:14px;flex:1;min-width:140px;">📨 Resend OTP</button>
                        <button type="button" onclick="showSpamHelp();return false;" class="btn" style="padding:10px 20px;font-size:14px;background:#6c757d;color:white;flex:1;min-width:140px;">❓ Help</button>
                    </div>
                </div>

                <p style="text-align:center;margin-top:16px;">
                    <a href="#" onclick="window.showLogin();return false;" style="color:var(--primary);text-decoration:none;font-weight:600;">← Back to Login</a>
                </p>
            </form>
        </div>
    `;

    setTimeout(() => {
        const otpInput = document.getElementById('verify-otp');
        if (!otpInput) return;

        otpInput.focus();
        otpInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }, 100);
}

function showSpamHelp() {
    alert(
        '📧 How to find your OTP email\n\n' +
        '1. Check Spam/Junk.\n' +
        '2. In Gmail, check Promotions and Updates.\n' +
        '3. Search for "Hostel Management".\n' +
        '4. Click Resend OTP and wait a minute.'
    );
}

async function handleEmailVerification(event) {
    event.preventDefault();

    const email = document.getElementById('verify-email').value;
    const otp = document.getElementById('verify-otp').value;

    if (!otp || otp.length !== 6) {
        window.showAlert('Please enter a valid 6-digit OTP', 'error');
        return false;
    }

    try {
        await window.apiCall('/auth/verify-email-otp', 'POST', { email, otp });
        window.showAlert('Email verified successfully!', 'success');
        setTimeout(() => window.showLogin(), 1000);
    } catch (error) {
        console.error('Verification error:', error);
        alert('❌ Verification failed: ' + error.message);
        window.showAlert(error.message || 'Verification failed', 'error');
    }

    return false;
}

async function resendOTP(email) {
    try {
        window.showAlert('Sending OTP to your email...', 'info');

        await window.apiCall('/auth/send-verification-otp', 'POST', { email });

        alert('✅ OTP sent successfully!\n\nEmail: ' + email + '\n\nCheck Inbox, Spam/Junk, Promotions, and Updates.');
        window.showAlert('OTP sent! Check your email.', 'success');
    } catch (error) {
        console.error('Resend OTP error:', error);
        alert('❌ Failed to resend OTP: ' + error.message);
        window.showAlert(error.message || 'Failed to resend OTP', 'error');
    }
}

window.showEmailVerification = showEmailVerification;
window.handleEmailVerification = handleEmailVerification;
window.resendOTP = resendOTP;
window.showSpamHelp = showSpamHelp;

console.log('Auth.js loaded');
