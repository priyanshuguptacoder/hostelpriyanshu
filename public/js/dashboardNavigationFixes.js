(() => {
  const originalLoadView = window.loadView;
  const viewHistory = [];
  let currentView = null;
  let explicitBackTarget = null;
  let goingBack = false;

  const roleHome = () => {
    const role = (window.currentUser || {}).role;
    return role === 'admin' ? 'adminDashboard' : role === 'warden' ? 'wardenDashboard' : 'studentDashboard';
  };

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
      await originalLoadView(target);
      currentView = target;
    } finally {
      goingBack = false;
      decorateCurrentView();
    }
  }

  function decorateCurrentView() {
    const content = document.getElementById('content-area');
    if (!content) return;

    const header = content.querySelector('.page-header');
    if (!header || header.querySelector('.page-back-button')) return;

    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'page-back-button';
    backButton.textContent = '← Back';
    backButton.addEventListener('click', goBackInApp);

    header.classList.add('page-header-with-back');
    header.insertBefore(backButton, header.firstChild);
  }

  async function enhancedLoadView(viewName) {
    rememberTransition(viewName);
    await originalLoadView(viewName);
    decorateCurrentView();
  }

  window.loadView = enhancedLoadView;
  window.goBackInApp = goBackInApp;
  window.setExplicitBackTarget = setExplicitBackTarget;

  const content = document.getElementById('content-area');
  if (content) {
    const observer = new MutationObserver(() => decorateCurrentView());
    observer.observe(content, { childList: true, subtree: true });
  }

  window.addEventListener('beforeunload', () => {
    viewHistory.length = 0;
  });
})();
