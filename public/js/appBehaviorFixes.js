(() => {
  const originalShowAuth = window.showAuth;

  function safeStoredUser() {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Invalid stored user data. Clearing it.', error);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return null;
    }
  }

  async function safeApiCall(endpoint, method = 'GET', data = null) {
    const token = window.authToken || localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };

    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${window.location.origin}/api${endpoint}`, {
        method,
        headers,
        body: data == null ? undefined : JSON.stringify(data),
        signal: controller.signal,
        credentials: 'same-origin'
      });

      const contentType = response.headers.get('content-type') || '';
      let result;

      if (contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = { success: false, message: text || 'Unexpected server response.' };
      }

      if (!response.ok) {
        if (response.status === 401 && Boolean(token)) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.authToken = null;
          window.currentUser = null;
          if (typeof originalShowAuth === 'function') originalShowAuth();
          const sessionError = new Error('Your session expired. Please sign in again.');
          sessionError.statusCode = 401;
          sessionError.sessionExpired = true;
          throw sessionError;
        }

        const error = new Error(result.message || `Request failed (${response.status}).`);
        error.statusCode = response.status;
        error.requiresVerification = result.requiresVerification;
        error.email = result.email;
        error.approvalStatus = result.approvalStatus;
        error.code = result.code;
        throw error;
      }

      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error('The server took too long to respond. Please try again.');
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function enhancedAlert(message, type = 'info') {
    const text = String(message || 'Something went wrong.');

    if (window.notifications?.show) {
      window.notifications.show(text, type, 5000);
      return;
    }

    let host = document.getElementById('global-alert-container');
    if (!host) {
      host = document.createElement('div');
      host.id = 'global-alert-container';
      host.className = 'global-alert-container';
      document.body.appendChild(host);
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = text;
    host.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
  }

  let loadingDepth = 0;

  function enhancedShowLoading() {
    loadingDepth += 1;
    if (document.getElementById('loading-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'spinner-overlay';
    overlay.innerHTML = '<div class="spinner"></div><div class="loading-message">Working...</div>';
    document.body.appendChild(overlay);
  }

  function enhancedHideLoading(force = false) {
    if (force) {
      loadingDepth = 0;
    } else {
      loadingDepth = Math.max(0, loadingDepth - 1);
    }

    if (loadingDepth === 0) {
      document.getElementById('loading-overlay')?.remove();
    }
  }

  window.apiCall = safeApiCall;
  window.showAlert = enhancedAlert;
  window.showLoading = enhancedShowLoading;
  window.hideLoading = enhancedHideLoading;

  document.addEventListener('DOMContentLoaded', () => {
    const user = safeStoredUser();
    const token = localStorage.getItem('token');
    if (!user || !token) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  });
})();
