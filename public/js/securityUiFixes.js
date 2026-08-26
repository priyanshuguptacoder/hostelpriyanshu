(() => {
  const style = document.createElement('style');
  style.textContent = `
    #auth-section.security-auth .auth-container {
      max-width: 520px;
      width: min(92%, 520px);
      padding: 34px 40px;
    }

    #auth-section.security-auth .auth-form h2 {
      margin-bottom: 18px;
    }

    #auth-section.security-auth .auth-form button::after {
      content: none !important;
    }

    #auth-section.security-auth .auth-form button span {
      display: none !important;
    }

    #auth-section.security-auth .security-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    #auth-section.security-auth .security-actions .btn,
    #auth-section.security-auth .security-actions a {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius);
      padding: 11px 18px;
      font-weight: 700;
      text-decoration: none;
      box-sizing: border-box;
    }

    #auth-section.security-auth .security-otp-input {
      width: 100%;
      padding: 18px 16px !important;
      font-size: 28px !important;
      text-align: center;
      letter-spacing: 9px !important;
      font-weight: 800;
    }

    #auth-section.security-auth .security-note {
      border-radius: var(--radius);
      padding: 14px 16px;
      margin-bottom: 20px;
      line-height: 1.5;
    }

    #auth-section.security-auth .security-danger-note {
      background: linear-gradient(135deg, rgba(239,68,68,.10), rgba(220,38,38,.08));
      border: 1px solid rgba(239,68,68,.25);
      border-left: 4px solid var(--danger);
      color: #991b1b;
    }

    [data-theme="dark"] #auth-section.security-auth .security-danger-note {
      color: #fecaca;
      background: rgba(127,29,29,.28);
      border-color: rgba(248,113,113,.35);
    }

    #auth-section.security-auth .security-mail-note {
      background: linear-gradient(135deg, rgba(245,158,11,.16), rgba(249,115,22,.10));
      border: 1px solid rgba(245,158,11,.30);
      color: #92400e;
    }

    [data-theme="dark"] #auth-section.security-auth .security-mail-note {
      color: #fde68a;
    }

    #auth-section.security-auth .security-status {
      text-align: center;
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 18px;
    }

    #auth-section.security-auth .security-status strong {
      color: var(--primary);
      overflow-wrap: anywhere;
    }
  `;
  document.head.appendChild(style);

  function markSecurityPage() {
    const section = document.getElementById('auth-section');
    if (!section) return;

    const securityForm = section.querySelector(
      '#verify-email-security-form, #delete-account-confirm-form, #delete-account-request-form, #reset-password-security-form'
    );

    if (securityForm) {
      section.classList.add('security-auth');
      normalizeSecurityMarkup();
    } else {
      section.classList.remove('security-auth');
    }
  }

  function normalizeSecurityMarkup() {
    document.querySelectorAll('#auth-section.security-auth .auth-form button span').forEach(span => span.remove());

    const deleteForm = document.getElementById('delete-account-confirm-form');
    if (deleteForm) {
      const actions = deleteForm.nextElementSibling;
      if (actions && !actions.classList.contains('security-actions')) actions.classList.add('security-actions');
      const otp = document.getElementById('delete-account-otp-security');
      otp?.classList.add('security-otp-input');
    }

    const verifyForm = document.getElementById('verify-email-security-form');
    if (verifyForm) {
      document.getElementById('verify-otp-security')?.classList.add('security-otp-input');
      const link = verifyForm.querySelector('a[href="#"]');
      if (link) link.style.fontWeight = '700';
    }

    const dangerAlerts = document.querySelectorAll('#auth-section.security-auth .alert-error');
    dangerAlerts.forEach(el => el.classList.add('security-note', 'security-danger-note'));
  }

  document.addEventListener('DOMContentLoaded', markSecurityPage);

  const section = document.getElementById('auth-section');
  if (section) {
    new MutationObserver(markSecurityPage).observe(section, { childList: true, subtree: true });
  }
})();
