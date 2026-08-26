(() => {
  let loadingTimer = null;

  function removeLoading() {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    document.querySelectorAll('#loading-overlay').forEach(el => el.remove());
  }

  function showLoadingFinal(message = 'Working...') {
    removeLoading();

    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'spinner-overlay';
    overlay.innerHTML = `
      <div class="spinner" aria-hidden="true"></div>
      <div class="loading-message">${message}</div>
    `;
    document.body.appendChild(overlay);

    // No request in this application should leave a modal overlay forever.
    loadingTimer = setTimeout(removeLoading, 20000);
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

  document.addEventListener('DOMContentLoaded', refreshBackButtons);
  const observer = new MutationObserver(refreshBackButtons);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('pageshow', removeLoading);
  window.addEventListener('beforeunload', removeLoading);
})();
