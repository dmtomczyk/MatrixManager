const closeOpenMenus = (eventTarget = null) => {
  const openMenus = document.querySelectorAll('details.account-menu[open], details.hamburger-menu[open], details.nav-dropdown[open]');
  openMenus.forEach((menu) => {
    if (eventTarget && menu.contains(eventTarget)) return;
    menu.removeAttribute('open');
  });
};

const updateAccountNotificationState = async () => {
  const accountMenu = document.querySelector('details.account-menu');
  const accountTrigger = document.querySelector('.account-menu-trigger');
  const inboxLink = document.querySelector('.account-menu-link[href="/inbox"]');
  if (!accountMenu || !accountTrigger) return;
  try {
    const response = await fetch('/inbox-api', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const items = await response.json();
    const hasUnread = items.some((item) => !item.is_read);
    const hasPendingApproval = items.some((item) => (item.payload || {}).kind === 'assignment_review' && !item.is_read);
    const hasAlert = hasUnread || hasPendingApproval;
    accountMenu.classList.toggle('account-menu-has-alert', hasAlert);
    accountTrigger.setAttribute('aria-label', hasPendingApproval ? 'Signed in account menu with pending approvals' : hasUnread ? 'Signed in account menu with unread notifications' : 'Signed in account menu');
    if (inboxLink) {
      inboxLink.dataset.alert = hasPendingApproval ? 'pending' : hasUnread ? 'unread' : '';
    }
  } catch (_) {
    // Non-fatal nav enhancement; ignore fetch failures.
  }
};

document.addEventListener('click', (event) => {
  closeOpenMenus(event.target);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeOpenMenus();
});

updateAccountNotificationState();
