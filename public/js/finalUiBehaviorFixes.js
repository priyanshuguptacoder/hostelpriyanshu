(() => {
  let loadingTimer = null;
  let loadingStartedAt = 0;

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
    if (!button.dataset.finalUi) {
      button.textContent = '←  Back';
      button.dataset.finalUi = 'true';
    }
  }

  function refreshBackButtons() {
    document.querySelectorAll('.page-back-button').forEach(normalizeBackButton);
  }

  function wrapAsyncViewFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__finalUiWrapped) return;

    const wrapped = async function(...args) {
      try {
        return await original.apply(this, args);
      } catch (error) {
        removeLoading();
        throw error;
      } finally {
        removeLoading();
      }
    };

    wrapped.__finalUiWrapped = true;
    window[name] = wrapped;
  }

  function installAsyncWrappers() {
    wrapAsyncViewFunction('loadView');
    wrapAsyncViewFunction('loadDashboard');
    wrapAsyncViewFunction('renderAdminDashboard');
    wrapAsyncViewFunction('renderWardenDashboard');
    wrapAsyncViewFunction('renderStudentDashboard');
    wrapAsyncViewFunction('renderAdminUsers');
    wrapAsyncViewFunction('renderWardenRequests');
    wrapAsyncViewFunction('renderAttendance');
    wrapAsyncViewFunction('renderBills');
    wrapAsyncViewFunction('renderComplaints');
  }

  document.addEventListener('DOMContentLoaded', () => {
    refreshBackButtons();
    installAsyncWrappers();
  });

  const observer = new MutationObserver(() => {
    refreshBackButtons();
    installAsyncWrappers();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('pageshow', removeLoading);
  window.addEventListener('beforeunload', removeLoading);
  window.addEventListener('error', removeLoading);
  window.addEventListener('unhandledrejection', removeLoading);
})();
