const closeOpenMenus = (eventTarget = null) => {
  const openMenus = document.querySelectorAll('details.account-menu[open], details.hamburger-menu[open], details.nav-dropdown[open]');
  openMenus.forEach((menu) => {
    if (eventTarget && menu.contains(eventTarget)) return;
    menu.removeAttribute('open');
  });
};

const ensureAccountCounters = (accountTrigger) => {
  let counterRow = accountTrigger.querySelector('.account-menu-counters');
  if (counterRow) return counterRow;
  counterRow = document.createElement('span');
  counterRow.className = 'account-menu-counters';
  counterRow.innerHTML = `
    <span class="account-counter account-counter-approvals" hidden>
      <span class="account-counter-icon" aria-hidden="true">✅</span>
      <span class="account-counter-value">0</span>
    </span>
    <span class="account-counter account-counter-messages" hidden>
      <span class="account-counter-icon" aria-hidden="true">✉️</span>
      <span class="account-counter-value">0</span>
    </span>
  `;
  accountTrigger.appendChild(counterRow);
  return counterRow;
};

const updateAccountNotificationState = async () => {
  const accountMenu = document.querySelector('details.account-menu');
  const accountTrigger = document.querySelector('.account-menu-trigger');
  const inboxLink = document.querySelector('.account-menu-link[href="/inbox"]');
  const assignmentNavLinks = document.querySelectorAll('[data-nav-key="assignments"]');
  if (!accountMenu || !accountTrigger) return;
  try {
    const response = await fetch('/inbox-api', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const items = await response.json();
    const pendingApprovals = items.filter((item) => !item.is_read && (item.payload || {}).kind === 'assignment_review').length;
    const unreadMessages = items.filter((item) => !item.is_read && (item.payload || {}).kind !== 'assignment_review').length;
    const hasAlert = pendingApprovals > 0 || unreadMessages > 0;
    accountMenu.classList.toggle('account-menu-has-alert', hasAlert);
    accountMenu.classList.toggle('account-menu-has-pending-approvals', pendingApprovals > 0);
    accountMenu.classList.toggle('account-menu-has-unread-messages', unreadMessages > 0);
    accountTrigger.setAttribute('aria-label', `Signed in account menu with ${pendingApprovals} pending approvals and ${unreadMessages} unread messages`);

    const counterRow = ensureAccountCounters(accountTrigger);
    const approvalsCounter = counterRow.querySelector('.account-counter-approvals');
    const messagesCounter = counterRow.querySelector('.account-counter-messages');
    approvalsCounter.hidden = pendingApprovals === 0;
    messagesCounter.hidden = unreadMessages === 0;
    approvalsCounter.querySelector('.account-counter-value').textContent = String(pendingApprovals);
    messagesCounter.querySelector('.account-counter-value').textContent = String(unreadMessages);

    if (inboxLink) {
      inboxLink.dataset.alert = pendingApprovals > 0 ? `pending ${pendingApprovals}` : unreadMessages > 0 ? `unread ${unreadMessages}` : '';
    }
    assignmentNavLinks.forEach((link) => {
      link.classList.toggle('nav-link-has-pending-approvals', pendingApprovals > 0);
      if (pendingApprovals > 0) {
        link.dataset.pendingApprovals = String(pendingApprovals);
      } else {
        delete link.dataset.pendingApprovals;
      }
      link.setAttribute('aria-label', pendingApprovals > 0 ? `Assignments with ${pendingApprovals} pending approvals` : 'Assignments');
    });
  } catch (_) {
    // Non-fatal nav enhancement; ignore fetch failures.
  }
};

window.refreshAccountNotificationState = updateAccountNotificationState;
document.addEventListener('account-notifications-changed', () => {
  updateAccountNotificationState();
});

document.addEventListener('click', (event) => {
  closeOpenMenus(event.target);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeOpenMenus();
});

updateAccountNotificationState();
