(() => {
  const legacyAddScrollToTop = window.addScrollToTop;

  if (typeof legacyAddScrollToTop === 'function') {
    window.addScrollToTop = () => {
      document.getElementById('scroll-to-top')?.remove();
      return legacyAddScrollToTop();
    };
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('a[href="#"]');
    if (!target) return;

    const handler = target.getAttribute('onclick') || '';
    if (handler.includes('showLogin') || handler.includes('showRegister') || handler.includes('showForgotPassword') || handler.includes('showDeleteAccount')) {
      event.preventDefault();
    }
  });
})();
