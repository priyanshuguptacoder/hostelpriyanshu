(() => {
  let loadingTimer = null;
  let loadingStartedAt = 0;
  let navigationBusy = false;
  let queuedView = null;
  let navigationToken = 0;
  let realLoadView = null;
  let originalShowLoading = null;

  function removeLoading() {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    loadingStartedAt = 0;
    document.querySelectorAll('#loading-overlay').forEach(el => el.remove());
  }

  function showLoadingFinal(message = 'Working...') {
    removeLoading();
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'spinner-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="spinner" aria-hidden="true"></div>
      <div class="loading-message">${message}</div>
    `;
    document.body.appendChild(overlay);
    loadingStartedAt = Date.now();
    loadingTimer = setTimeout(() => {
      if (Date.now() - loadingStartedAt >= 9000) removeLoading();
    }, 9000);
  }

  function hideLoadingFinal() {
    removeLoading();
  }

  window.showLoading = showLoadingFinal;
  window.hideLoading = hideLoadingFinal;
  window.forceHideLoading = removeLoading;

  function normalizeBackButton(button) {
    if (!button) return;
    button.type = 'button';
    button.className = 'page-back-button';
    button.setAttribute('aria-label', 'Go back');
    button.title = 'Go back';
    button.dataset.finalUi = 'true';
    button.textContent = '←  Back';
  }

  function refreshBackButtons() {
    document.querySelectorAll('.page-back-button').forEach(normalizeBackButton);
  }

  function setInlineLoading(contentArea, label = 'Loading page') {
    if (!contentArea) return;
    contentArea.innerHTML = `
      <div class="view-loading-state" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <div class="view-loading-title">${label}</div>
        <div class="view-loading-subtitle">Please wait…</div>
      </div>
    `;
  }

  function showViewError(contentArea, message, viewName) {
    if (!contentArea) return;
    const safeMessage = String(message || 'This page could not be loaded.');
    contentArea.innerHTML = `
      <div class="card view-load-error" role="alert">
        <div class="view-load-error-icon">⚠️</div>
        <h3>We couldn't load this page</h3>
        <p>${safeMessage}</p>
        <div class="view-load-error-actions">
          <button type="button" class="btn btn-primary" data-retry-view>Try Again</button>
          <button type="button" class="btn btn-secondary" data-home-view>Back to Dashboard</button>
        </div>
      </div>
    `;

    contentArea.querySelector('[data-retry-view]')?.addEventListener('click', () => {
      window.loadView(viewName);
    });
    contentArea.querySelector('[data-home-view]')?.addEventListener('click', () => {
      const role = String((window.currentUser || {}).role || 'student');
      const home = role === 'admin' ? 'adminDashboard' : role === 'warden' ? 'wardenDashboard' : 'studentDashboard';
      window.loadView(home);
    });
  }

  function suppressGlobalLoader() {
    originalShowLoading = window.showLoading;
    window.showLoading = () => {};
    return () => {
      window.showLoading = originalShowLoading || showLoadingFinal;
      originalShowLoading = null;
      removeLoading();
    };
  }

  async function stableLoadView(viewName) {
    if (!realLoadView && typeof window.loadView === 'function' && window.loadView !== stableLoadView) {
      realLoadView = window.loadView;
    }

    if (typeof realLoadView !== 'function') {
      const contentArea = document.getElementById('content-area');
      showViewError(contentArea, 'Navigation is unavailable. Please refresh the page.', viewName);
      return;
    }

    if (navigationBusy) {
      queuedView = viewName;
      return;
    }

    navigationBusy = true;
    queuedView = null;
    const token = ++navigationToken;
    const contentArea = document.getElementById('content-area');
    setInlineLoading(contentArea);
    removeLoading();

    const restoreLoader = suppressGlobalLoader();

    try {
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('The server is taking too long to respond.')), 12000);
      });

      await Promise.race([
        Promise.resolve().then(() => realLoadView(viewName)),
        timeout
      ]);

      if (token === navigationToken) removeLoading();
    } catch (error) {
      if (token === navigationToken) {
        removeLoading();
        showViewError(contentArea, error?.message || 'Something went wrong while loading this page.', viewName);
      }
    } finally {
      restoreLoader();
      navigationBusy = false;
      refreshBackButtons();

      if (queuedView && queuedView !== viewName) {
        const next = queuedView;
        queuedView = null;
        setTimeout(() => stableLoadView(next), 0);
      }
    }
  }

  function installNavigationController() {
    if (typeof window.loadView !== 'function') return;
    if (window.loadView.__stableNavigation) return;
    realLoadView = window.loadView;
    const stable = function(viewName) {
      return stableLoadView(viewName);
    };
    stable.__stableNavigation = true;
    window.loadView = stable;
  }

  function bindSidebarGuard() {
    document.addEventListener('click', event => {
      const item = event.target.closest('.sidebar li');
      if (!item || !navigationBusy) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  }

  function installUiWatchers() {
    refreshBackButtons();
    installNavigationController();
  }

  document.addEventListener('DOMContentLoaded', () => {
    installUiWatchers();
    bindSidebarGuard();
  });

  const observer = new MutationObserver(refreshBackButtons);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('pageshow', removeLoading);
  window.addEventListener('beforeunload', removeLoading);
  window.addEventListener('error', removeLoading);
  window.addEventListener('unhandledrejection', removeLoading);
})();
