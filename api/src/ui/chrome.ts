function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderStandardLinks(currentPath: string, navLinks: Array<[string, string]>) {
  return navLinks.map(([href, label]) => {
    const classes = ['nav-link'];
    if (href === currentPath) classes.push('active');
    if (href === '/') classes.push('nav-link-subtle');
    return `<a href="${href}" class="${classes.join(' ')}"${href === currentPath ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`;
  }).join('');
}

function renderDropdown(currentPath: string, label: string, navLinks: Array<[string, string]>, mobile = false) {
  if (!navLinks.length) return '';
  const anyActive = navLinks.some(([href]) => href === currentPath);
  const panelClass = mobile ? 'nav-dropdown-panel nav-dropdown-panel-mobile' : 'nav-dropdown-panel';
  const detailsClass = mobile ? 'nav-dropdown nav-dropdown-mobile' : 'nav-dropdown';
  const triggerClass = anyActive ? 'nav-link nav-dropdown-trigger active' : 'nav-link nav-dropdown-trigger';
  const rendered = navLinks.map(([href, itemLabel]) => `<a href="${href}" class="${href === currentPath ? 'nav-dropdown-link active' : 'nav-dropdown-link'}"${href === currentPath ? ' aria-current="page"' : ''}>${escapeHtml(itemLabel)}</a>`).join('');
  return `<details class="${detailsClass}"><summary class="${triggerClass}"><span>${escapeHtml(label)}</span><span class="nav-dropdown-caret" aria-hidden="true">▾</span></summary><div class="${panelClass}">${rendered}</div></details>`;
}

export function renderAppChrome(currentUser: string, currentPath: string) {
  const links: Array<[string, string]> = [['/', 'Get Started'], ['/dashboard', 'Dashboard'], ['/canvas', 'Canvas']];
  const planningLinks: Array<[string, string]> = [['/planning', 'Projects'], ['/forecast', 'Forecast'], ['/demands', 'Demands'], ['/staffing', 'Assignments']];
  const workforceLinks: Array<[string, string]> = [['/orgs', 'Organizations'], ['/people', 'Employees'], ['/job-codes', 'Job Codes']];
  const adminLinks: Array<[string, string]> = [['/users', 'Users'], ['/audit', 'Audit'], ['/runtime', 'Runtime'], ['/db-management', 'DB Management']];

  const linkMarkup = renderStandardLinks(currentPath, links);
  const planningMarkup = renderDropdown(currentPath, 'Planning', planningLinks);
  const workforceMarkup = renderDropdown(currentPath, 'Workforce', workforceLinks);
  const adminMarkup = renderDropdown(currentPath, 'Admin', adminLinks);
  const mobilePlanning = renderDropdown(currentPath, 'Planning', planningLinks, true);
  const mobileWorkforce = renderDropdown(currentPath, 'Workforce', workforceLinks, true);
  const mobileAdmin = renderDropdown(currentPath, 'Admin', adminLinks, true);

  return {
    css: `
      .app-header{position:sticky;top:0;z-index:30;border-bottom:1px solid #e2e8f0;background:rgba(255,255,255,.95);backdrop-filter:blur(10px)}
      .app-header-inner{max-width:1100px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:16px}
      .app-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%}
      .app-nav-main{display:flex;align-items:center;gap:14px;min-width:0}.nav-links{display:flex;align-items:center;gap:8px}.nav-links-mobile{display:none;flex-direction:column;align-items:stretch}
      .nav-link,.nav-dropdown-trigger,.nav-dropdown-link,.account-menu-link,.logout-button,.hamburger-trigger{appearance:none;border:0;background:none;text-decoration:none;color:#475569;font:inherit;cursor:pointer}
      .nav-link,.nav-dropdown-trigger{display:inline-flex;align-items:center;gap:6px;padding:10px 12px;border-radius:10px;font-size:14px;font-weight:600}
      .nav-link:hover,.nav-dropdown-trigger:hover,.hamburger-trigger:hover{background:#f1f5f9;color:#0f172a}.nav-link.active,.nav-dropdown-trigger.active{background:#f1f5f9;color:#0f172a}
      .nav-link-subtle{color:#0f172a}.nav-dropdown{position:relative}.nav-dropdown summary{list-style:none}.nav-dropdown summary::-webkit-details-marker{display:none}
      .nav-dropdown-panel{position:absolute;left:0;top:calc(100% + 8px);min-width:190px;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:8px;box-shadow:0 10px 30px rgba(15,23,42,.08)}
      .nav-dropdown-link{display:block;padding:10px 12px;border-radius:8px;font-size:14px}.nav-dropdown-link:hover,.nav-dropdown-link.active{background:#f1f5f9;color:#0f172a}
      .nav-dropdown-caret{font-size:12px;color:#94a3b8}.hamburger-menu{display:none;position:relative}.hamburger-menu summary{list-style:none}.hamburger-menu summary::-webkit-details-marker{display:none}
      .hamburger-trigger{display:inline-flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-size:14px;font-weight:600;color:#475569}.hamburger-icon{position:relative;width:16px;height:2px;background:#475569;border-radius:999px}.hamburger-icon::before,.hamburger-icon::after{content:'';position:absolute;left:0;width:16px;height:2px;background:#475569;border-radius:999px}.hamburger-icon::before{top:-5px}.hamburger-icon::after{top:5px}
      .hamburger-panel{position:absolute;left:0;top:calc(100% + 8px);min-width:260px;border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:12px;box-shadow:0 10px 30px rgba(15,23,42,.08)}
      .account-menu{position:relative}.account-menu summary{list-style:none}.account-menu summary::-webkit-details-marker{display:none}.account-menu-trigger{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;cursor:pointer}
      .account-menu-copy{display:flex;flex-direction:column}.account-menu-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8}.account-menu-username{font-size:14px;font-weight:600;color:#0f172a}.account-icon{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;background:#0f172a;color:#fff;font-size:14px}
      .account-menu-panel{position:absolute;right:0;top:calc(100% + 8px);min-width:230px;border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:10px;box-shadow:0 10px 30px rgba(15,23,42,.08)}
      .account-menu-meta{padding:8px 10px 12px;border-bottom:1px solid #e2e8f0;margin-bottom:8px}.account-menu-meta-top{display:flex;align-items:center;gap:10px}.account-icon-panel{width:36px;height:36px}
      .account-menu-link{display:block;padding:10px;border-radius:8px;font-size:14px}.account-menu-link:hover,.logout-button:hover{background:#f1f5f9;color:#0f172a}.logout-form{margin:8px 0 0}.logout-button{display:block;width:100%;text-align:left;padding:10px;border-radius:8px;font-size:14px}
      @media (max-width: 900px){.nav-links-desktop{display:none}.hamburger-menu{display:block}.nav-links-mobile{display:flex}.account-menu-copy{display:none}.nav-dropdown-panel-mobile{position:static;min-width:0;border:0;box-shadow:none;padding:6px 0 0}}
    `,
    html: `<header class="app-header"><div class="app-header-inner"><nav class="app-nav" aria-label="Primary"><div class="app-nav-main"><a href="/" class="nav-link nav-link-subtle${currentPath === '/' ? ' active' : ''}">Matrix Manager</a><div class="nav-links nav-links-desktop">${linkMarkup}${planningMarkup}${workforceMarkup}${adminMarkup}</div><details class="hamburger-menu"><summary class="hamburger-trigger" aria-label="Open navigation menu"><span class="hamburger-icon" aria-hidden="true"></span><span>Menu</span></summary><div class="hamburger-panel"><div class="nav-links nav-links-mobile">${linkMarkup}${mobilePlanning}${mobileWorkforce}${mobileAdmin}</div></div></details></div><details class="account-menu"><summary class="account-menu-trigger"><span class="account-icon" aria-hidden="true">👤</span><span class="account-menu-copy"><span class="account-menu-label">Signed in as</span><span class="account-menu-username">${escapeHtml(currentUser)}</span></span></summary><div class="account-menu-panel"><div class="account-menu-meta"><div class="account-menu-meta-top"><span class="account-icon account-icon-panel" aria-hidden="true">👤</span><div><span class="account-menu-label">Signed in as</span><strong>${escapeHtml(currentUser)}</strong></div></div></div><a href="/inbox" class="account-menu-link">Inbox</a><a href="/account-settings" class="account-menu-link">Account Settings</a><a href="/users" class="account-menu-link">Users</a><a href="/audit" class="account-menu-link">Audit</a><a href="/runtime" class="account-menu-link">Runtime</a><a href="/db-management" class="account-menu-link">DB Management</a><form method="post" action="/logout" class="logout-form"><button type="submit" class="logout-button">Logout</button></form></div></details></nav></div></header>`
  };
}
