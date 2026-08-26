const API_URL = '/api';
let authToken = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

// --- Navigation Controller ---
let currentNavId = 0;
let activeAbortController = null;
const viewHistory = [];

window.navigateTo = async function(viewName, isBack = false) {
    const navId = ++currentNavId;
    
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
        console.log(`[Nav ${navId}] Loading view:`, viewName);
        
        switch(viewName) {
            case 'studentDashboard': if(window.renderStudentDashboard) await window.renderStudentDashboard(navId); break;
            case 'markMyAttendance': if(window.renderMarkMyAttendance) window.renderMarkMyAttendance(navId); break;
            case 'myAttendance': if(window.renderMyAttendance) await window.renderMyAttendance(navId); break;
            case 'myBills': if(window.renderMyBills) await window.renderMyBills(navId); break;
            case 'myComplaints': if(window.renderMyComplaints) await window.renderMyComplaints(navId); break;
            case 'wardenRequest': if(window.renderWardenRequest) window.renderWardenRequest(navId); break;
            
            case 'wardenDashboard': if (window.renderWardenDashboard) await window.renderWardenDashboard(navId); break;
            case 'markAttendance': if (window.renderMarkAttendance) await window.renderMarkAttendance(navId); break;
            case 'attendanceRecords': if (window.renderAttendanceRecords) await window.renderAttendanceRecords(navId); break;
            case 'messBills':
            case 'manageBills': if (window.renderManageBills) await window.renderManageBills(navId); else if (window.renderMessBills) await window.renderMessBills(navId); break;
            case 'complaints':
            case 'allComplaints': if (window.renderAllComplaints) await window.renderAllComplaints(navId); else if (window.renderComplaints) await window.renderComplaints(navId); break;
            case 'manageAnnouncements': if (window.renderManageAnnouncements) await window.renderManageAnnouncements(navId); break;
            case 'announcements': if (window.renderStudentAnnouncements) await window.renderStudentAnnouncements(navId); else if (window.renderManageAnnouncements) await window.renderManageAnnouncements(navId); break;
            case 'attendanceReport': if (window.renderAttendanceReport) await window.renderAttendanceReport(navId); break;
            
            case 'adminDashboard': if (window.renderAdminDashboard) await window.renderAdminDashboard(navId); break;
            case 'pendingWardens': if (window.renderPendingWardens) await window.renderPendingWardens(navId); break;
            case 'allUsers': if (window.renderAllUsers) await window.renderAllUsers(navId); break;
            
            default:
                if (navId === currentNavId && contentArea) {
                    contentArea.innerHTML = `<div class="empty-state"><h3>${viewName}</h3><p>This view is not implemented yet.</p></div>`;
                }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`[Nav ${navId}] Aborted`);
        } else {
            console.error(`[Nav ${navId}] Error:`, error);
            if (navId === currentNavId && contentArea) {
                contentArea.innerHTML = `<div class="alert alert-error">Failed to load view: ${error.message}</div>`;
            }
        }
    }
};

window.goBack = function() {
    if (viewHistory.length > 1) {
        viewHistory.pop(); // remove current
        const prevView = viewHistory[viewHistory.length - 1];
        navigateTo(prevView, true);
    } else {
        if (currentUser) {
            navigateTo(currentUser.role + 'Dashboard', true);
        }
    }
};

window.setActiveSidebar = function(viewName) {
    const items = document.querySelectorAll('.sidebar li');
    items.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        }
    });
};

// Replace legacy loadView
window.loadView = window.navigateTo;

// --- API Helper ---
async function apiCall(endpoint, method = 'GET', data = null, customOptions = {}) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        ...customOptions
    };

    if (activeAbortController && !customOptions.ignoreAbort) {
        options.signal = activeAbortController.signal;
    }

    if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const result = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/me')) {
                // Genuine session expiration
                handleLogout();
                throw new Error('Session expired. Please login again.');
            }
            
            const error = new Error(result.message || 'Something went wrong');
            error.requiresVerification = result.requiresVerification;
            error.email = result.email;
            error.statusCode = response.status;
            throw error;
        }
        
        return result;
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('API Error:', error);
        }
        throw error;
    }
}
window.apiCall = apiCall;

// --- Loading State ---
window.showLoading = function(global = false) {
    if (global) {
        let overlay = document.getElementById('global-loading');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'global-loading';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    } else {
        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.innerHTML = '<div class="spinner"></div>';
        }
    }
};

window.hideLoading = function(global = false) {
    if (global) {
        const overlay = document.getElementById('global-loading');
        if (overlay) overlay.style.display = 'none';
    }
};

// --- View Helpers ---
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const contentArea = document.getElementById('content-area');
    if (contentArea && document.getElementById('dashboard-section').style.display !== 'none') {
        contentArea.insertBefore(alertDiv, contentArea.firstChild);
    } else {
        const authSection = document.getElementById('auth-section');
        if (authSection) {
            const form = authSection.querySelector('.auth-form:not([style*="display: none"])');
            if(form) form.insertBefore(alertDiv, form.firstChild);
            else authSection.insertBefore(alertDiv, authSection.firstChild);
        }
    }
    setTimeout(() => alertDiv.remove(), 5000);
}
window.showAlert = showAlert;

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

// --- App Initialization ---
async function checkAuth() {
    console.log('Checking auth...');
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    if (tokenFromUrl) {
        authToken = tokenFromUrl;
        localStorage.setItem('token', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!authToken) {
        showAuth();
        return;
    }

    try {
        const user = await apiCall('/auth/me', 'GET', null, { ignoreAbort: true });
        if (user) {
            updateAuthState(user, authToken);
        } else {
            throw new Error('User not found');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        if (error.statusCode === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            authToken = null;
            currentUser = null;
        }
        showAuth();
    }
}

function updateAuthState(user, token) {
    currentUser = user;
    authToken = token;
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    
    if (user.role === 'pending') {
        showApprovalPortal();
    } else {
        showDashboard();
    }
}
window.updateAuthState = updateAuthState;

// Toggle Theme
window.toggleTheme = function() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('theme-icon').textContent = newTheme === 'light' ? '🌙' : '☀️';
};

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
document.addEventListener('DOMContentLoaded', () => {
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
    
    // Check if we are on a reset password route
    if (window.location.pathname.startsWith('/reset-password/')) {
        showResetPassword();
    } else {
        checkAuth();
    }
});

// UI Views
function showAuth() {
    document.getElementById('dashboard-section').style.display = 'none';
    const authSection = document.getElementById('auth-section');
    if (authSection) authSection.style.display = 'block';
    
    const approvalPortal = document.getElementById('approval-portal');
    if (approvalPortal) approvalPortal.style.display = 'none';
    
    showLogin();
}
window.showAuth = showAuth;

function showDashboard() {
    const authSection = document.getElementById('auth-section');
    if (authSection) authSection.style.display = 'none';
    
    const approvalPortal = document.getElementById('approval-portal');
    if (approvalPortal) approvalPortal.style.display = 'none';
    
    document.getElementById('dashboard-section').style.display = 'block';
    
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-role').textContent = currentUser.role.replace('_', ' ');
        
        if (typeof window.buildSidebar === 'function') {
            window.buildSidebar(currentUser.role);
        } else if (typeof window.loadDashboard === 'function') {
            window.loadDashboard();
        }
    }
}
window.showDashboard = showDashboard;

window.showLogin = function() {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    document.getElementById('login-form').style.display = 'block';
};

window.showRegister = function() {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    document.getElementById('register-form').style.display = 'block';
};

window.showForgotPassword = function() {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    const f = document.getElementById('forgot-password-form');
    if(f) f.style.display = 'block';
};

window.showResetPassword = function() {
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    let f = document.getElementById('reset-password-form');
    if (!f) {
        f = document.createElement('div');
        f.id = 'reset-password-form';
        f.className = 'auth-form';
        f.innerHTML = `
            <h2>New Password</h2>
            <form id="reset-password-form-element" onsubmit="return handleResetPassword(event)">
                <div class="form-input-wrapper" data-icon="🔒"><input type="password" id="reset-password" placeholder="New Password" required minlength="6"></div>
                <button type="submit">Update Password</button>
            </form>
            <p><a href="/" onclick="window.location.href='/'; return false;">Back to Login</a></p>
        `;
        document.querySelector('.auth-container').appendChild(f);
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
            <h2>Delete Account</h2>
            <form id="delete-account-form-element" onsubmit="return handleDeleteAccount(event)">
                <div class="form-input-wrapper" data-icon="📧"><input type="email" id="delete-email" placeholder="Email Address" required></div>
                <button type="submit" style="background:var(--danger)">Request Deletion</button>
            </form>
            <p><a href="#" onclick="showLogin(); return false;">Cancel</a></p>
        `;
        document.querySelector('.auth-container').appendChild(f);
    }
    f.style.display = 'block';
};

window.showApprovalPortal = function() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'none';
    
    let portalHtml = `
        <div id="approval-portal" class="auth-container" style="max-width: 600px; margin: 40px auto; position: relative; z-index: 10;">
            <div style="text-align: center; padding: 40px 20px;">
                <div style="width: 80px; height: 80px; background: #fff3cd; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
                    <span style="font-size: 40px;">⏳</span>
                </div>
                <h2>Account Pending Approval</h2>
                <p>Your warden account request is currently under review by the administrator.</p>
                <button onclick="handleLogout()" style="margin-top:20px; width:100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Back to Login
                </button>
            </div>
        </div>
    `;
    
    const existingPortal = document.getElementById('approval-portal');
    if (existingPortal) existingPortal.remove();
    document.body.insertAdjacentHTML('beforeend', portalHtml);
};

window.handleLogout = async function() {
    console.log('Logging out...');
    
    if (activeAbortController) {
        activeAbortController.abort();
    }
    viewHistory.length = 0;
    
    authToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    const contentArea = document.getElementById('content-area');
    if (contentArea) contentArea.innerHTML = '';
    
    const sidebar = document.getElementById('sidebar-menu');
    if (sidebar) sidebar.innerHTML = '';
    
    showAuth();
};
