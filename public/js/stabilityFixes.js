(() => {
  const ROLE_EMAILS = {
    'adminpriyanshu@hostel.com': 'admin',
    'priyanshuguptaiit99@gmail.com': 'admin',
    'wardenpriyanshu@hostel.com': 'warden',
    'studentpriyanshu@hostel.com': 'student'
  };

  const MENU_VIEWS = {
    student: ['studentDashboard', 'markMyAttendance', 'myAttendance', 'myBills', 'myComplaints', 'announcements', 'wardenRequest'],
    warden: ['wardenDashboard', 'markAttendance', 'attendanceRecords', 'messBills', 'complaints', 'manageAnnouncements'],
    admin: ['adminDashboard', 'pendingWardens', 'allUsers', 'manageAnnouncements']
  };

  const HOME_VIEWS = new Set(['studentDashboard', 'wardenDashboard', 'adminDashboard']);

  const normalizeUser = user => {
    if (!user) return user;
    const email = String(user.email || '').trim().toLowerCase();
    const role = ROLE_EMAILS[email];
    return role
      ? { ...user, email, role, approvalStatus: 'approved', emailVerified: true, isActive: true }
      : user;
  };

  let loadingDepth = 0;
  let loadingTimer = null;
  let navigationRunning = false;
  let navigationPromise = null;
  let requestedView = null;
  let currentView = null;
  let navigationId = 0;
  let navigationAbortController = null;
  let viewHistory = [];
  let explicitBackTarget = null;
  let baseLoadView = null;
  let baseGoBackInApp = null;

  const contentArea = () => document.getElementById('content-area');
  const roleHome = () => {
    const role = (window.currentUser || {}).role;
    return role === 'admin' ? 'adminDashboard' : role === 'warden' ? 'wardenDashboard' : 'studentDashboard';
  };

  function clearLoadingOverlay() {
    if (loadingTimer) clearTimeout(loadingTimer);
    loadingTimer = null;
    loadingDepth = 0;
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
    loadingTimer = setTimeout(clearLoadingOverlay, 10000);
  }

  function hideLoadingSafe(force = false) {
    if (force) return clearLoadingOverlay();
    loadingDepth = Math.max(0, loadingDepth - 1);
    if (loadingDepth === 0) clearLoadingOverlay();
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

    const requestController = new AbortController();
    const timeout = setTimeout(() => requestController.abort(), 10000);

    let signal = requestController.signal;
    if (navigationAbortController) {
      if (typeof AbortSignal !== 'undefined' && AbortSignal.any) {
        signal = AbortSignal.any([requestController.signal, navigationAbortController.signal]);
      } else if (navigationAbortController.signal.aborted) {
        requestController.abort();
      } else {
        navigationAbortController.signal.addEventListener('abort', () => requestController.abort(), { once: true });
      }
    }

    try {
      const response = await fetch(`${window.location.origin}/api${endpoint}`, { ...options, signal });
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
          clearLoadingOverlay();
          window.showAuth?.();
          error.sessionExpired = true;
        }

        throw error;
      }

      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        if (navigationAbortController?.signal.aborted) {
          const cancelled = new Error('Navigation cancelled.');
          cancelled.code = 'NAVIGATION_CANCELLED';
          throw cancelled;
        }
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
    const menu = document.getElementById('sidebar-menu');
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll(':scope > li'));
    items.forEach(item => item.classList.remove('active'));

    const role = (window.currentUser || {}).role;
    const index = (MENU_VIEWS[role] || []).indexOf(viewName);
    if (index >= 0 && items[index]) items[index].classList.add('active');
  }

  function decorateBackButton() {
    const content = contentArea();
    if (!content || !currentView || HOME_VIEWS.has(currentView)) return;
    const header = content.querySelector('.page-header');
    if (!header) return;

    header.classList.add('page-header-with-back');
    let back = header.querySelector('.page-back-button');
    if (!back) {
      back = document.createElement('button');
      back.type = 'button';
      back.className = 'page-back-button';
      back.addEventListener('click', navigateBack);
      header.insertBefore(back, header.firstChild);
    }
    back.textContent = '←  Back';
    back.setAttribute('aria-label', 'Go back');
    back.title = 'Go back';
  }

  function rememberHistory(nextView) {
    if (!nextView || !currentView || currentView === nextView) return;
    viewHistory.push(currentView);
    if (viewHistory.length > 40) viewHistory = viewHistory.slice(-40);
  }

  async function runLatestNavigation() {
    if (navigationRunning) return;
    navigationRunning = true;

    try {
      while (requestedView) {
        const target = requestedView;
        requestedView = null;
        const runId = ++navigationId;

        navigationAbortController?.abort();
        const controller = new AbortController();
        navigationAbortController = controller;

        rememberHistory(target);
        setActiveSidebar(target);

        const content = contentArea();
        if (content) {
          content.innerHTML = `
            <div class="view-loading-state" aria-live="polite">
              <div class="spinner" aria-hidden="true"></div>
              <div class="view-loading-title">Loading page...</div>
              <div class="view-loading-subtitle">Please wait a moment.</div>
            </div>`;
        }

        try {
          if (typeof baseLoadView !== 'function') throw new Error('Dashboard navigation is not initialized correctly.');

          await Promise.race([
            Promise.resolve(baseLoadView(target)),
            new Promise((_, reject) => setTimeout(() => {
              controller.abort();
              const timeoutError = new Error('This page took too long to load.');
              timeoutError.code = 'VIEW_TIMEOUT';
              reject(timeoutError);
            }, 10000))
          ]);
        } catch (error) {
          if (controller.signal.aborted && requestedView && requestedView !== target) continue;
          if (error?.code !== 'NAVIGATION_CANCELLED') console.error(`View '${target}' failed:`, error);

          if (runId === navigationId && content) {
            content.innerHTML = `
              <div class="card view-load-error">
                <div class="view-load-error-icon">⚠️</div>
                <h3>Unable to load this page</h3>
                <p>${error?.message || 'Something went wrong while loading this section.'}</p>
                <div class="view-load-error-actions">
                  <button type="button" class="btn btn-primary" data-retry-view="${target}">Try Again</button>
                  <button type="button" class="btn btn-secondary" data-go-home>Back to Dashboard</button>
                </div>
              </div>`;
          }
        } finally {
          if (navigationAbortController === controller) navigationAbortController = null;
        }

        if (runId === navigationId && !controller.signal.aborted) {
          currentView = target;
          setActiveSidebar(target);
          decorateBackButton();
        }
      }
    } finally {
      navigationRunning = false;
      navigationAbortController = null;
      navigationPromise = null;
      clearLoadingOverlay();
      setActiveSidebar(requestedView || currentView || roleHome());
      decorateBackButton();
    }
  }

  function navigateTo(viewName) {
    if (!viewName) return;
    explicitBackTarget = null;
    requestedView = viewName;
    navigationId += 1;
    navigationAbortController?.abort();

    if (!navigationPromise) {
      navigationPromise = runLatestNavigation();
    }
    return navigationPromise;
  }

  function requestDefaultDashboardView(viewName) {
    if (currentView || requestedView || navigationRunning) return;
    navigateTo(viewName || roleHome());
  }

  async function navigateBack() {
    const target = explicitBackTarget || viewHistory.pop() || roleHome();
    explicitBackTarget = null;
    navigateTo(target);
  }

  function setExplicitBackTarget(viewName) {
    explicitBackTarget = viewName || null;
  }

  function handleRuntimeActions(event) {
    const retry = event.target.closest('[data-retry-view]');
    if (retry) {
      navigateTo(retry.dataset.retryView);
      return;
    }
    const home = event.target.closest('[data-go-home]');
    if (home) navigateTo(roleHome());
  }

  function stableShowDashboard() {
    const rawUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    let user = null;
    try { user = rawUser ? normalizeUser(JSON.parse(rawUser)) : null; } catch { user = null; }

    if (!user || !token) {
      clearLoadingOverlay();
      return window.showAuth?.();
    }

    navigationAbortController?.abort();
    navigationAbortController = null;
    navigationRunning = false;
    navigationPromise = null;
    requestedView = null;
    currentView = null;
    viewHistory = [];
    explicitBackTarget = null;

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

    clearLoadingOverlay();
    window.loadDashboard?.();
  }

  function stableLogout() {
    if (!confirm('Are you sure you want to logout?')) return;

    navigationId += 1;
    requestedView = null;
    navigationRunning = false;
    navigationPromise = null;
    navigationAbortController?.abort();
    navigationAbortController = null;
    viewHistory = [];
    currentView = null;
    explicitBackTarget = null;
    clearLoadingOverlay();

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

    clearLoadingOverlay();
    window.scrollTo?.({ top: 0, behavior: 'instant' });
    window.notifications?.show?.('Logged out successfully.', 'success', 2500);
  }

  document.addEventListener('click', handleRuntimeActions);

  function initializeStability() {
    baseLoadView = window.loadView;
    baseGoBackInApp = window.goBackInApp;

    window.apiCall = apiCallSafe;
    window.showLoading = showLoadingSafe;
    window.hideLoading = hideLoadingSafe;
    window.forceHideLoading = clearLoadingOverlay;
    window.loadView = navigateTo;
    window.requestDefaultDashboardView = requestDefaultDashboardView;
    window.goBackInApp = navigateBack;
    window.setExplicitBackTarget = setExplicitBackTarget;
    window.handleLogout = stableLogout;
    window.showDashboard = stableShowDashboard;

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const normalized = normalizeUser(JSON.parse(storedUser));
        localStorage.setItem('user', JSON.stringify(normalized));
        window.currentUser = normalized;
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.currentUser = null;
        window.authToken = null;
      }
    }

    clearLoadingOverlay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStability, { once: true });
  } else {
    initializeStability();
  }

  const activeObserver = new MutationObserver(() => {
    const target = requestedView || currentView;
    if (target) setActiveSidebar(target);
    decorateBackButton();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('sidebar-menu');
    const content = document.getElementById('content-area');
    if (menu) activeObserver.observe(menu, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    if (content) activeObserver.observe(content, { childList: true, subtree: true });
  }, { once: true });

  window.addEventListener('error', event => {
    console.error('Unhandled frontend error:', event.error || event.message);
    clearLoadingOverlay();
  });

  window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
    if (event.reason?.code !== 'NAVIGATION_CANCELLED') clearLoadingOverlay();
  });

  window.addEventListener('pageshow', clearLoadingOverlay);
})();