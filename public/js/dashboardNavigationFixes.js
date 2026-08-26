(() => {
  const originalLoadView = window.loadView;
  const originalViewTodayAttendance = window.viewTodayAttendance;
  const originalShowNewComplaintForm = window.showNewComplaintForm;
  const viewHistory = [];
  let currentView = null;
  let explicitBackTarget = null;
  let goingBack = false;

  const roleHome = () => {
    const role = (window.currentUser || {}).role;
    return role === 'admin' ? 'adminDashboard' : role === 'warden' ? 'wardenDashboard' : 'studentDashboard';
  };

  const isHomeView = viewName => ['adminDashboard', 'wardenDashboard', 'studentDashboard'].includes(viewName);

  function rememberTransition(nextView) {
    if (goingBack || !nextView || nextView === currentView) return;
    if (currentView) {
      viewHistory.push(currentView);
      if (viewHistory.length > 30) viewHistory.shift();
    }
    currentView = nextView;
  }

  function setExplicitBackTarget(viewName) {
    explicitBackTarget = viewName || null;
  }

  async function goBackInApp() {
    let target = explicitBackTarget;
    explicitBackTarget = null;

    if (!target) target = viewHistory.pop() || roleHome();

    goingBack = true;
    try {
      // Use the current global loadView so the final stability controller
      // can serialize, timeout, and recover the navigation.
      await window.loadView(target);
      currentView = target;
    } finally {
      goingBack = false;
      decorateCurrentView();
      window.hideLoading?.(true);
    }
  }

  function decorateCurrentView() {
    const content = document.getElementById('content-area');
    if (!content || isHomeView(currentView)) return;

    const header = content.querySelector('.page-header');
    if (!header) return;

    header.classList.add('page-header-with-back');

    let backButton = header.querySelector('.page-back-button');
    if (!backButton) {
      backButton = document.createElement('button');
      backButton.type = 'button';
      backButton.className = 'page-back-button';
      backButton.addEventListener('click', () => window.goBackInApp?.());
      header.insertBefore(backButton, header.firstChild);
    }

    backButton.setAttribute('aria-label', 'Go back');
    backButton.title = 'Go back';
    backButton.textContent = '←  Back';
  }

  async function enhancedLoadView(viewName) {
    rememberTransition(viewName);
    try {
      return await originalLoadView(viewName);
    } finally {
      decorateCurrentView();
      window.hideLoading?.(true);
    }
  }

  window.loadView = enhancedLoadView;
  window.goBackInApp = goBackInApp;
  window.setExplicitBackTarget = setExplicitBackTarget;

  if (typeof originalViewTodayAttendance === 'function') {
    window.viewTodayAttendance = async (...args) => {
      setExplicitBackTarget('markAttendance');
      return originalViewTodayAttendance(...args);
    };
  }

  if (typeof originalShowNewComplaintForm === 'function') {
    window.showNewComplaintForm = (...args) => {
      setExplicitBackTarget('myComplaints');
      return originalShowNewComplaintForm(...args);
    };
  }

  const content = document.getElementById('content-area');
  if (content) {
    const observer = new MutationObserver(() => decorateCurrentView());
    observer.observe(content, { childList: true, subtree: true });
  }
})();
