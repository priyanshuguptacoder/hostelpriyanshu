/**
 * Hostel Management System — Core Application
 * Single source of truth for navigation, auth state, API calls, and loading.
 */

const API_URL = '/api';

// --- Auth State (exposed globally so other scripts can read them) ---
window.authToken = localStorage.getItem('token') || null;
window.currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
})();

// Keep local references in sync with window
let authToken = window.authToken;
let currentUser = window.currentUser;

function syncAuthState() {
    window.authToken = authToken;
    window.currentUser = currentUser;
}

// --- Navigation Controller ---
let currentNavId = 0;
let activeAbortController = null;
const viewHistory = [];

window.navigateTo = async function(viewName, isBack = false) {
    const navId = ++currentNavId;

    // Abort any previous in-flight navigation
    if (activeAbortController) {
        activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    if (!isBack) {
        if (viewHistory.length === 0 || viewHistory[viewHistory.length - 1] !== viewName) {
            viewHistory.push(viewName);
        }
    }

    setActiveSidebar(viewName);

    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.innerHTML = '<div class="spinner"></div>';
    }

    try {
        console.log(`[Nav ${navId}] Loading: ${viewName}`);
        const ca = () => navId === currentNavId; // check if still current

        switch (viewName) {
            // Student views
            case 'studentDashboard':
                if (window.renderStudentDashboard && ca()) await window.renderStudentDashboard(navId); break;
            case 'markMyAttendance':
                if (window.renderMarkMyAttendance && ca()) window.renderMarkMyAttendance(navId); break;
            case 'myAttendance':
                if (window.renderMyAttendance && ca()) await window.renderMyAttendance(navId); break;
            case 'myBills':
                if (window.renderMyBills && ca()) await window.renderMyBills(navId); break;
            case 'myComplaints':
                if (window.renderMyComplaints && ca()) await window.renderMyComplaints(navId); break;
            case 'wardenRequest':
                if (window.renderWardenRequest && ca()) window.renderWardenRequest(navId); break;
            case 'announcements':
                if (window.renderStudentAnnouncements && ca()) await window.renderStudentAnnouncements(navId);
                else if (window.renderAnnouncements && ca()) await window.renderAnnouncements(navId);
                break;

            // Warden views
            case 'wardenDashboard':
                if (window.renderWardenDashboard && ca()) await window.renderWardenDashboard(navId); break;
            case 'markAttendance':
                if (window.renderMarkAttendance && ca()) await window.renderMarkAttendance(navId); break;
            case 'attendanceRecords':
                if (window.renderAttendanceRecords && ca()) await window.renderAttendanceRecords(navId); break;
            case 'messBills':
            case 'manageBills':
                if (window.renderMessBills && ca()) await window.renderMessBills(navId);
                else if (window.renderManageBills && ca()) await window.renderManageBills(navId);
                break;
            case 'complaints':
            case 'allComplaints':
                if (window.renderComplaints && ca()) await window.renderComplaints(navId);
                else if (window.renderAllComplaints && ca()) await window.renderAllComplaints(navId);
                break;
            case 'manageAnnouncements':
                if (window.renderManageAnnouncements && ca()) await window.renderManageAnnouncements(navId);
                else if (window.renderAnnouncements && ca()) await window.renderAnnouncements(navId);
                break;
            case 'attendanceReport':
                if (window.renderAttendanceReport && ca()) await window.renderAttendanceReport(navId); break;

            // Admin views
            case 'adminDashboard':
                if (window.renderAdminDashboard && ca()) await window.renderAdminDashboard(navId); break;
            case 'pendingWardens':
                if (window.renderPendingWardens && ca()) await window.renderPendingWardens(navId); break;
            case 'allUsers':
                if (window.renderAllUsers && ca()) await window.renderAllUsers(navId); break;

            default:
                if (ca() && contentArea) {
                    contentArea.innerHTML = `<div class="empty-state"><h3>${viewName}</h3><p>This view is not available yet.</p></div>`;
                }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`[Nav ${navId}] Cancelled`);
        } else {
            console.error(`[Nav ${navId}] Error:`, error);
            if (navId === currentNavId && contentArea) {
                contentArea.innerHTML = `
                    <div class="empty-state">
                        <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                        <h3>Failed to load</h3>
                        <p>${error.message || 'Something went wrong'}</p>
                        <button class="btn" onclick="navigateTo('${viewHistory[viewHistory.length-1] || currentUser?.role + 'Dashboard'}')">Retry</button>
                    </div>`;
            }
        }
    }
};

window.goBack = function() {
    if (viewHistory.length > 1) {
        viewHistory.pop();
        const prevView = viewHistory[viewHistory.length - 1];
        navigateTo(prevView, true);
    } else if (currentUser) {
        const home = currentUser.role === 'admin' ? 'adminDashboard'
            : currentUser.role === 'warden' ? 'wardenDashboard'
            : 'studentDashboard';
        navigateTo(home, true);
    }
};

window.setActiveSidebar = function(viewName) {
    document.querySelectorAll('.sidebar li').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        }
    });
};

// Legacy alias
window.loadView = window.navigateTo;

// --- API Helper ---
async function apiCall(endpoint, method = 'GET', data = null, customOptions = {}) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    // Use abort signal unless explicitly ignored
    if (activeAbortController && !customOptions.ignoreAbort) {
        options.signal = activeAbortController.signal;
    }

    const token = authToken || window.authToken;
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        // Only log out on genuine token failures, not role/approval issues
        if (response.status === 401 &&
            result.code !== 'ACCOUNT_DEACTIVATED' &&
            !endpoint.includes('/auth/login') &&
            !endpoint.includes('/auth/register')) {
            // Session truly expired/invalid
            _clearSession();
            showAuth();
            throw new Error('Session expired. Please login again.');
        }

        const error = new Error(result.message || 'Something went wrong');
        error.statusCode = response.status;
        error.code = result.code;
        error.requiresVerification = result.requiresVerification;
        error.email = result.email;
        throw error;
    }

    return result;
}
window.apiCall = apiCall;

// --- Loading State ---
window.showLoading = function(global = false) {
    if (global) {
        let overlay = document.getElementById('global-loading');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'global-loading';
            overlay.className = 'spinner-overlay';
            overlay.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    } else {
        const contentArea = document.getElementById('content-area');
        if (contentArea) contentArea.innerHTML = '<div class="spinner"></div>';
    }
};

window.hideLoading = function(global = false) {
    if (global) {
        const overlay = document.getElementById('global-loading');
        if (overlay) overlay.style.display = 'none';
    } else {
        // Remove any full-page loading overlay that wasn't already cleaned
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.remove();
    }
};

// Patch: features.js defines showLoading/hideLoading with overlay logic.
// Override with our versions so dashboard.js calls work correctly.
// This runs AFTER features.js due to script order.

// --- Alert Helper ---
function showAlert(message, type = 'success') {
    if (!message || message.includes('aborted') || message.includes('AbortError')) return;

    // Remove existing alerts of same type quickly
    document.querySelectorAll('.flash-alert').forEach(a => a.remove());

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} flash-alert`;
    alertDiv.textContent = message;
    alertDiv.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;max-width:400px;';

    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}
window.showAlert = showAlert;

// --- Format Helpers ---
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
window.formatDate = formatDate;

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
window.formatDateTime = formatDateTime;

// --- Session Management ---
function _clearSession() {
    authToken = null;
    currentUser = null;
    window.authToken = null;
    window.currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

function _saveSession(user, token) {
    authToken = token;
    currentUser = user;
    syncAuthState();
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

// --- Auth Flow ---
async function checkAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
        authToken = tokenFromUrl;
        window.authToken = tokenFromUrl;
        localStorage.setItem('token', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!authToken) {
        showAuth();
        return;
    }

    try {
        // Use ignoreAbort so this doesn't get cancelled by navigation
        const result = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await result.json().catch(() => ({}));

        if (result.ok && data.user) {
            _saveSession(data.user, authToken);
            routeByStatus(data.user);
        } else if (result.status === 403 && data.code === 'ACCOUNT_PENDING') {
            // Pending approval - show portal
            showApprovalPortal(data.message);
        } else if (result.status === 403 && data.code === 'ACCOUNT_REJECTED') {
            showRejectedPortal(data.message);
        } else if (result.status === 403 && data.code === 'ACCOUNT_DEACTIVATED') {
            showAlert('Your account has been deactivated. Please contact admin.', 'error');
            _clearSession();
            showAuth();
        } else {
            // 401 or unknown — clear and show login
            _clearSession();
            showAuth();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        showAuth();
    }
}

function routeByStatus(user) {
    if (user.approvalStatus === 'pending') {
        showApprovalPortal();
    } else if (user.approvalStatus === 'rejected') {
        showRejectedPortal(user.rejectionReason);
    } else {
        showDashboard();
    }
}

window.updateAuthState = function(user, token) {
    _saveSession(user, token);
    routeByStatus(user);
};

// --- Theme ---
window.toggleTheme = function() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = newTheme === 'light' ? '🌙' : '☀️';
};

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = savedTheme === 'light' ? '🌙' : '☀️';

    if (window.location.pathname.startsWith('/reset-password/')) {
        showResetPassword();
    } else {
        checkAuth();
    }
});

// --- UI View Controllers ---
function showAuth() {
    // Cancel any in-flight navigation
    if (activeAbortController) activeAbortController.abort();
    viewHistory.length = 0;
    currentNavId++; // invalidate any pending nav

    document.getElementById('dashboard-section').style.display = 'none';
    const authSection = document.getElementById('auth-section');
    if (authSection) authSection.style.display = 'block';

    const ap = document.getElementById('approval-portal');
    if (ap) ap.remove();

    showLogin();
    window.scrollTo(0, 0);
}
window.showAuth = showAuth;

function showDashboard() {
    if (!currentUser) { showAuth(); return; }

    const authSection = document.getElementById('auth-section');
    if (authSection) authSection.style.display = 'none';

    const ap = document.getElementById('approval-portal');
    if (ap) ap.remove();

    document.getElementById('dashboard-section').style.display = 'block';

    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    if (nameEl) nameEl.textContent = currentUser.name;
    if (roleEl) roleEl.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);

    // Always use loadDashboard which builds the sidebar correctly
    if (typeof window.loadDashboard === 'function') {
        window.loadDashboard();
    }
}
window.showDashboard = showDashboard;

window.showLogin = function() {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    const lf = document.getElementById('login-form');
    if (lf) lf.style.display = 'block';
};

window.showRegister = function() {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    const rf = document.getElementById('register-form');
    if (rf) rf.style.display = 'block';
};

window.showForgotPassword = function() {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    const f = document.getElementById('forgot-password-form');
    if (f) f.style.display = 'block';
};

window.showResetPassword = function() {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');

    let f = document.getElementById('reset-password-form');
    if (!f) {
        f = document.createElement('div');
        f.id = 'reset-password-form';
        f.className = 'auth-form';
        f.innerHTML = `
            <h2>🔒 Set New Password</h2>
            <p style="color:var(--text-muted);margin-bottom:20px;font-size:14px;">Enter your new password below.</p>
            <form id="reset-password-form-element" onsubmit="return handleResetPassword(event)">
                <div class="form-input-wrapper" data-icon="🔒">
                    <input type="password" id="reset-new-password" placeholder="New Password (min 6 chars)" required minlength="6">
                </div>
                <div class="form-input-wrapper" data-icon="🔒">
                    <input type="password" id="reset-confirm-password" placeholder="Confirm Password" required minlength="6">
                </div>
                <button type="submit">Update Password</button>
            </form>
            <p style="margin-top:15px;"><a href="/" onclick="window.location.href='/';return false;">← Back to Login</a></p>
        `;
        const container = document.querySelector('.auth-container');
        if (container) container.appendChild(f);
    }
    f.style.display = 'block';
};

window.showDeleteAccount = function() {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    let f = document.getElementById('delete-account-form');
    if (!f) {
        f = document.createElement('div');
        f.id = 'delete-account-form';
        f.className = 'auth-form';
        f.innerHTML = `
            <h2>🗑️ Delete Account</h2>
            <p style="color:var(--text-muted);margin-bottom:20px;font-size:14px;">Enter your email address. We'll send you a verification code to confirm deletion.</p>
            <form id="delete-account-form-element" onsubmit="return handleDeleteAccount(event)">
                <div class="form-input-wrapper" data-icon="📧">
                    <input type="email" id="delete-email" placeholder="Your Email Address" required autocomplete="email">
                </div>
                <button type="submit" style="background:var(--danger)">Send Verification Code</button>
            </form>
            <p style="margin-top:15px;"><a href="#" onclick="showLogin();return false;">← Cancel</a></p>
        `;
        const container = document.querySelector('.auth-container');
        if (container) container.appendChild(f);
    }
    f.style.display = 'block';
};

function showApprovalPortal(message) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'none';

    let portal = document.getElementById('approval-portal');
    if (portal) portal.remove();

    portal = document.createElement('div');
    portal.id = 'approval-portal';
    portal.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-secondary,#f0f4ff);';
    portal.innerHTML = `
        <div class="auth-container" style="max-width:520px;text-align:center;padding:48px 32px;">
            <div style="width:80px;height:80px;background:#fff3cd;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:40px;">⏳</div>
            <h2 style="margin-bottom:12px;">Account Pending Approval</h2>
            <p style="color:var(--text-muted);margin-bottom:24px;">${message || 'Your warden account request is under review by the administrator. You will be notified once it is approved.'}</p>
            <button onclick="handleLogout()" class="btn" style="width:100%;">Back to Login</button>
        </div>
    `;
    document.body.appendChild(portal);
}
window.showApprovalPortal = showApprovalPortal;

function showRejectedPortal(reason) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'none';

    let portal = document.getElementById('approval-portal');
    if (portal) portal.remove();

    portal = document.createElement('div');
    portal.id = 'approval-portal';
    portal.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-secondary,#f0f4ff);';
    portal.innerHTML = `
        <div class="auth-container" style="max-width:520px;text-align:center;padding:48px 32px;">
            <div style="width:80px;height:80px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:40px;">❌</div>
            <h2 style="margin-bottom:12px;color:var(--danger);">Account Request Rejected</h2>
            <p style="color:var(--text-muted);margin-bottom:24px;">${reason || 'Your account request was rejected. Please contact administration for more information.'}</p>
            <button onclick="handleLogout()" class="btn" style="width:100%;">Back to Login</button>
        </div>
    `;
    document.body.appendChild(portal);
}
window.showRejectedPortal = showRejectedPortal;

// --- Logout ---
window.handleLogout = async function() {
    // Cancel all in-flight requests
    if (activeAbortController) {
        activeAbortController.abort();
    }

    // Invalidate all pending navigations
    currentNavId++;
    viewHistory.length = 0;

    // Clear session
    _clearSession();

    // Clear DOM
    const contentArea = document.getElementById('content-area');
    if (contentArea) contentArea.innerHTML = '';

    const sidebar = document.getElementById('sidebar-menu');
    if (sidebar) sidebar.innerHTML = '';

    // Remove any loading overlays
    ['global-loading', 'loading-overlay', 'approval-portal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    showAuth();
};
