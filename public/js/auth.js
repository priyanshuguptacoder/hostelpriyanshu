let isLoggingIn = false;
let isRegistering = false;
let verificationEmail = '';

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
            updateAuthState(result.user, result.token);
        }
    } catch (error) {
        if (error.statusCode === 403 && error.requiresVerification) {
            verificationEmail = error.email || email;
            showAlert('Please verify your email.', 'warning');
            showOtpVerification(verificationEmail, false);
            apiCall('/auth/send-verification-otp', 'POST', { email: verificationEmail }).catch(console.error);
        } else {
            showAlert(error.message, 'error');
        }
    } finally {
        isLoggingIn = false;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
    return false;
}

async function handleRegister(event) {
    event.preventDefault();
    if (isRegistering) return false;
    isRegistering = true;
    
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const collegeId = document.getElementById('reg-college-id').value.trim();
    const roomNumber = document.getElementById('reg-room').value.trim();
    const hostel = document.getElementById('reg-hostel').value.trim();
    const department = document.getElementById('reg-department').value.trim();
    const year = document.getElementById('reg-year').value;
    const phone = document.getElementById('reg-phone').value.trim();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.textContent = 'Creating account...';
        submitBtn.disabled = true;
        
        const data = {
            name, email, password, role, collegeId, roomNumber, hostel, department, year, phone
        };
        
        const result = await apiCall('/auth/register', 'POST', data);
        
        verificationEmail = email;
        showAlert('Registration successful! Please verify your email.', 'success');
        showOtpVerification(email, false);
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        isRegistering = false;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
    return false;
}

function handleGoogleLogin() {
    window.showLoading?.(true);
    // Let backend redirect us to Google OAuth
    window.location.href = '/api/auth/google';
}

function showOtpVerification(email, isGoogle = false) {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    let f = document.getElementById('otp-form');
    if (!f) {
        f = document.createElement('div');
        f.id = 'otp-form';
        f.className = 'auth-form';
        f.innerHTML = `
            <h2>Verify Email</h2>
            <p style="margin-bottom: 20px; color: var(--text-muted); font-size: 14px;">We've sent a 6-digit code to <strong id="otp-display-email"></strong></p>
            <form id="otp-form-element" onsubmit="return handleOtpVerification(event)">
                <div class="form-input-wrapper" data-icon="🔑">
                    <input type="text" id="otp-input" placeholder="6-digit code" required pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" style="letter-spacing: 2px; text-align: center; font-size: 18px; font-weight: bold;">
                </div>
                <button type="submit" id="verify-btn">Verify Code</button>
            </form>
            <p style="margin-top: 15px;">
                <a href="#" id="resend-otp-btn" onclick="resendOtp(); return false;">Resend Code</a>
                <span id="resend-timer" style="display:none; color: var(--text-muted); font-size: 14px; margin-left: 10px;"></span>
            </p>
            <p style="margin-top: 15px;"><a href="#" onclick="showLogin(); return false;">Back to Login</a></p>
        `;
        document.querySelector('.auth-container').appendChild(f);
    }
    
    document.getElementById('otp-display-email').textContent = email;
    f.dataset.isGoogle = isGoogle ? 'true' : 'false';
    f.style.display = 'block';
    document.getElementById('otp-input').value = '';
    document.getElementById('otp-input').focus();
}

async function handleOtpVerification(event) {
    event.preventDefault();
    const otp = document.getElementById('otp-input').value.trim();
    const submitBtn = document.getElementById('verify-btn');
    const isGoogle = document.getElementById('otp-form').dataset.isGoogle === 'true';
    
    if (otp.length !== 6) {
        showAlert('Please enter a 6-digit OTP.', 'error');
        return false;
    }
    
    const originalText = submitBtn.textContent;
    try {
        submitBtn.textContent = 'Verifying...';
        submitBtn.disabled = true;
        
        const result = await apiCall('/auth/verify-email-otp', 'POST', { 
            email: verificationEmail, 
            otp,
            isGoogle
        });
        
        if (result.token) {
            showAlert('Email verified successfully!', 'success');
            updateAuthState(result.user, result.token);
        }
    } catch (error) {
        showAlert(error.message, 'error');
        document.getElementById('otp-input').value = '';
        document.getElementById('otp-input').focus();
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
    
    return false;
}

let resendCooldown = false;
async function resendOtp() {
    if (resendCooldown) return;
    
    try {
        resendCooldown = true;
        document.getElementById('resend-otp-btn').style.opacity = '0.5';
        document.getElementById('resend-otp-btn').style.cursor = 'not-allowed';
        
        await apiCall('/auth/send-verification-otp', 'POST', { email: verificationEmail });
        showAlert('OTP resent successfully. Please check your inbox.', 'success');
        
        // Start 60s cooldown timer
        let timeLeft = 60;
        const timerSpan = document.getElementById('resend-timer');
        timerSpan.style.display = 'inline';
        
        const timer = setInterval(() => {
            timeLeft--;
            timerSpan.textContent = `(${timeLeft}s)`;
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                resendCooldown = false;
                document.getElementById('resend-otp-btn').style.opacity = '1';
                document.getElementById('resend-otp-btn').style.cursor = 'pointer';
                timerSpan.style.display = 'none';
            }
        }, 1000);
        
    } catch (error) {
        resendCooldown = false;
        document.getElementById('resend-otp-btn').style.opacity = '1';
        document.getElementById('resend-otp-btn').style.cursor = 'pointer';
        showAlert(error.message, 'error');
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn = event.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    
    try {
        btn.textContent = 'Sending...';
        btn.disabled = true;
        await apiCall('/account/forgot-password', 'POST', { email });
        showAlert('Password reset link sent to your email.', 'success');
        setTimeout(() => showLogin(), 2000);
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
    return false;
}

async function handleResetPassword(event) {
    event.preventDefault();
    const token = window.location.pathname.split('/').pop();
    const password = document.getElementById('reset-password').value;
    const btn = event.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    
    try {
        btn.textContent = 'Updating...';
        btn.disabled = true;
        await apiCall('/account/reset-password', 'POST', { token, newPassword: password });
        showAlert('Password updated successfully! You can now login.', 'success');
        setTimeout(() => window.location.href = '/', 2000);
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
    return false;
}

async function handleDeleteAccount(event) {
    event.preventDefault();
    const email = document.getElementById('delete-email').value.trim();
    const btn = event.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    
    try {
        btn.textContent = 'Requesting...';
        btn.disabled = true;
        await apiCall('/account/request-delete-otp', 'POST', { email });
        
        // Show OTP verify for deletion
        document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
        let f = document.getElementById('delete-otp-form');
        if (!f) {
            f = document.createElement('div');
            f.id = 'delete-otp-form';
            f.className = 'auth-form';
            f.innerHTML = `
                <h2>Confirm Deletion</h2>
                <p>We've sent a 6-digit code to your email to confirm account deletion.</p>
                <form id="delete-otp-form-element" onsubmit="return handleConfirmDelete(event, '${email}')">
                    <div class="form-input-wrapper" data-icon="🔑"><input type="text" id="delete-otp" placeholder="6-digit code" required pattern="[0-9]{6}"></div>
                    <button type="submit" style="background:var(--danger)">Permanently Delete Account</button>
                </form>
                <p><a href="#" onclick="showLogin(); return false;">Cancel</a></p>
            `;
            document.querySelector('.auth-container').appendChild(f);
        } else {
            // Update email context
            f.querySelector('form').setAttribute('onsubmit', `return handleConfirmDelete(event, '${email}')`);
        }
        f.style.display = 'block';
        
    } catch (error) {
        showAlert(error.message, 'error');
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
        await apiCall('/account/confirm-delete-otp', 'POST', { email, otp });
        
        showAlert('Your account has been deleted.', 'success');
        setTimeout(() => window.location.href = '/', 2000);
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
    return false;
}
