(() => {
  const ROLE_EMAILS = {
    'adminpriyanshu@hostel.com': 'admin',
    'priyanshuguptaiit99@gmail.com': 'admin',
    'wardenpriyanshu@hostel.com': 'warden',
    'studentpriyanshu@hostel.com': 'student'
  };

  const normalizeUser = user => {
    if (!user) return user;
    const email = String(user.email || '').trim().toLowerCase();
    const role = ROLE_EMAILS[email];
    return role
      ? { ...user, email, role, approvalStatus: 'approved', emailVerified: true, isActive: true }
      : user;
  };

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  let loadingDepth = 0;
  let loadingTimer = null;
  let navigationSequence = 0;
  let navigationRunning = false;
  let navigationPromise = null;
  let latestRequestedView = null;
  let originalLoadView = null;
  let originalGoBackInApp = null;

  function removeLoading() {
    loadingDepth = 0;
    if (loadingTimer) clearTimeout(loadingTimer);
    loadingTimer = null;
    document.querySelectorAll('#loading-overlay').forEach(el => el.remove());
  }

  function showLoadingSafe(message = 'Working...') {
    const dashboardVisible = document.getElementById('dashboard-section')?.style.display === 'block';
    if (dashboardVisible) return;

    loadingDepth += 1;
    if (document.getElementById('loading-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'spinner-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `<div class="spinner" aria-hidden="true"></div><div class="loading-message">${message}</div>`;
    document.body.appendChild(overlay);
    loadingTimer = setTimeout(removeLoading, 10000);
  }

  function hideLoadingSafe(force = false) {
    if (force) return removeLoading();
    loadingDepth = Math.max(0, loadingDepth - 1);
    if (loadingDepth === 0) removeLoading();
  }

  async function apiCallSafe(endpoint, method = 'GET', data = null) {
    const token = window.authToken || localStorage.getItem('token');
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };

    if (token) options.headers.Authorization = `Bearer ${token}`;
    if (data !== null && data !== undefined) options.body = JSON.stringify(data);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${window.location.origin}/api${endpoint}`, {
        ...options,
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type') || '';
      const result = contentType.includes('application/json')
        ? await response.json()
        : { success: false, message: await response.text() };

      if (!response.ok) {
        const error = new Error(result.message || `Request failed (${response.status}).`);
        error.statusCode = response.status;
        error.requiresVerification = result.requiresVerification;
        error.email = result.email;
        error.approvalStatus = result.approvalStatus;
        error.code = result.code;

        const isSessionFailure = response.status === 401 && (
          endpoint === '/auth/me' ||
          result.code === 'TOKEN_EXPIRED' ||
          result.code === 'INVALID_TOKEN' ||
          result.code === 'USER_NOT_FOUND'
        );

        if (isSessionFailure) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.authToken = null;
          window.currentUser = null;
          window.showAuth?.();
          error.sessionExpired = true;
        }

        throw error;
      }

      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error('The server took too long to respond. Please try again.');
        timeoutError.code = 'TIMEOUT';
        timeoutError.statusCode = 408;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function setActiveSidebar(viewName) {
    const items = document.querySelectorAll('#sidebar-menu li');
    items.forEach(item => item.classList.remove('active'));

    const menus = {
      student: ['studentDashboard', 'markMyAttendance', 'myAttendance', 'myBills', 'myComplaints', 'announcements', 'wardenRequest'],
      warden: ['wardenDashboard', 'markAttendance', 'attendanceRecords', 'messBills', 'complaints', 'manageAnnouncements'],
      admin: ['adminDashboard', 'pendingWardens', 'allUsers', 'manageAnnouncements']
    };

    const role = (window.currentUser || {}).role;
    const index = (menus[role] || []).indexOf(viewName);
    if (index >= 0 && items[index]) items[index].classList.add('active');
  }

  async function runLatestNavigation() {
    if (navigationRunning || !latestRequestedView || typeof originalLoadView !== 'function') return;

    navigationRunning = true;
    try {
      while (latestRequestedView) {
        const target = latestRequestedView;
        latestRequestedView = null;
        const runId = ++navigationSequence;

        setActiveSidebar(target);

        const content = document.getElementById('content-area');
        if (content) {
          content.innerHTML = `
            <div class="page-loading-state" aria-live="polite">
              <div class="spinner" aria-hidden="true"></div>
              <p>Loading page...</p>
            </div>`;
        }

        try {
          await Promise.race([
            Promise.resolve(originalLoadView(target)),
            delay(9000).then(() => { throw Object.assign(new Error('This page is taking too long to load.'), { code: 'VIEW_TIMEOUT' }); })
          ]);
        } catch (error) {
          console.error(`View '${target}' failed:`, error);
          if (runId === navigationSequence && document.getElementById('content-area')) {
            document.getElementById('content-area').innerHTML = `
              <div class="page-load-error">
                <div class="page-load-error-icon">⚠️</div>
                <h3>Unable to load this page</h3>
                <p>${error?.message || 'Something went wrong while loading this section.'}</p>
                <div class="page-load-error-actions">
                  <button type="button" class="btn btn-primary" data-retry-view="${target}">Try Again</button>
                  <button type="button" class="btn btn-secondary" data-go-home>Back to Dashboard</button>
                </div>
              </div>`;
          }
        }
      }
    } finally {
      navigationRunning = false;
      removeLoading();
    }
  }

  function stableLoadView(viewName) {
    latestRequestedView = viewName;
    if (!navigationPromise) {
      navigationPromise = runLatestNavigation().finally(() => {
        navigationPromise = null;
      });
    }
    return navigationPromise;
  }

  function handleRuntimeActions(event) {
    const retry = event.target.closest('[data-retry-view]');
    if (retry) {
      stableLoadView(retry.dataset.retryView);
      return;
    }

    const home = event.target.closest('[data-go-home]');
    if (home) {
      const role = (window.currentUser || {}).role;
      stableLoadView(role === 'admin' ? 'adminDashboard' : role === 'warden' ? 'wardenDashboard' : 'studentDashboard');
    }
  }

  function stableLogout() {
    if (!confirm('Are you sure you want to logout?')) return;

    navigationSequence += 1;
    latestRequestedView = null;
    navigationRunning = false;
    navigationPromise = null;
    removeLoading();

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.authToken = null;
    window.currentUser = null;
    window.updateAuthState?.(null, null);

    document.getElementById('approval-portal')?.remove();
    const dashboard = document.getElementById('dashboard-section');
    const auth = document.getElementById('auth-section');

    if (dashboard) {
      dashboard.style.display = 'none';
      document.getElementById('sidebar-menu')?.replaceChildren();
      document.getElementById('content-area')?.replaceChildren();
    }
    if (auth) auth.style.display = 'block';

    try {
      window.showLogin?.();
    } catch (error) {
      console.warn('Login UI restore failed; reloading cleanly.', error);
      window.location.replace('/');
      return;
    }

    removeLoading();
    window.scrollTo?.({ top: 0, behavior: 'instant' });
    window.notifications?.show?.('Logged out successfully.', 'success', 2500);
  }

  function stableShowDashboard() {
    const rawUser = localStorage.getItem('user');
    let user = rawUser ? (() => { try { return JSON.parse(rawUser); } catch { return null; } })() : null;
    const token = localStorage.getItem('token');

    if (!user || !token) return window.showAuth?.();

    user = normalizeUser(user);
    localStorage.setItem('user', JSON.stringify(user));
    window.currentUser = user;
    window.authToken = token;

    document.getElementById('approval-portal')?.remove();
    const auth = document.getElementById('auth-section');
    const dashboard = document.getElementById('dashboard-section');
    if (auth) auth.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';

    const name = document.getElementById('user-name');
    const role = document.getElementById('user-role');
    if (name) name.textContent = user.name || '';
    if (role) role.textContent = String(user.role || '').replace('_', ' ').toUpperCase();

    removeLoading();
    if (typeof window.loadDashboard === 'function') window.loadDashboard();
  }

  document.addEventListener('click', handleRuntimeActions);

  function initializeStability() {
    originalLoadView = window.loadView;
    originalGoBackInApp = window.goBackInApp;

    window.apiCall = apiCallSafe;
    window.showLoading = showLoadingSafe;
    window.hideLoading = hideLoadingSafe;
    window.forceHideLoading = removeLoading;
    window.loadView = stableLoadView;
    window.handleLogout = stableLogout;
    window.showDashboard = stableShowDashboard;
    window.goBackInApp = (...args) => {
      if (typeof originalGoBackInApp === 'function') return originalGoBackInApp(...args);
      const role = (window.currentUser || {}).role;
      return stableLoadView(role === 'admin' ? 'adminDashboard' : role === 'warden' ? 'wardenDashboard' : 'studentDashboard');
    };

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const normalized = normalizeUser(JSON.parse(storedUser));
        localStorage.setItem('user', JSON.stringify(normalized));
        window.currentUser = normalized;
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }

    removeLoading();

    if (localStorage.getItem('token') && localStorage.getItem('user')) {
      setTimeout(() => {
        try {
          stableShowDashboard();
        } catch (error) {
          console.error('Initial dashboard recovery failed:', error);
          window.showAuth?.();
        }
      }, 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStability, { once: true });
  } else {
    initializeStability();
  }

  window.addEventListener('error', event => {
    console.error('Unhandled frontend error:', event.error || event.message);
  });

  window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
  });
})();
