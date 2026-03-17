import { renderAppChrome } from './chrome.js';

interface OrganizationView {
  id: number;
  name: string;
  description?: string | null;
  child_organization_count?: number;
}

interface EmployeeView {
  id: number;
  name: string;
  employee_type?: string | null;
  organization_id: number;
  organization_name?: string | null;
  manager_name?: string | null;
  location?: string | null;
  capacity?: number | null;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout(title: string, currentUser: string, currentPath: string, body: string, flash = ''): string {
  const chrome = renderAppChrome(currentUser, currentPath);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a}
      ${chrome.css}
      .wrap{max-width:1100px;margin:0 auto;padding:28px 16px 44px}.meta{color:#64748b;font-size:14px;margin:6px 0 0}
      h1{margin:0 0 8px;font-size:38px}.lead{color:#475569;max-width:760px;line-height:1.7}
      .grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:20px;align-items:start;margin-top:24px}
      .card{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:20px;box-shadow:0 10px 30px rgba(15,23,42,.05)}
      label{display:block;margin:14px 0 6px;font-size:14px;font-weight:600} input,textarea,select{width:100%;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;background:white}
      button.primary{margin-top:16px;width:100%;padding:12px 14px;border:0;border-radius:10px;background:#0f172a;color:white;font-weight:700;cursor:pointer}
      table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top} th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
      .flash{margin:0 0 16px;border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:12px;padding:12px 14px}
      .empty{color:#64748b}.section-title{margin:0 0 12px;font-size:22px}
      @media (max-width: 900px){.grid{grid-template-columns:1fr}}
    </style>
  </head>
  <body>
    ${chrome.html}
    <main class="wrap">
      ${flash ? `<div class="flash">${escapeHtml(flash)}</div>` : ''}
      ${body}
      <div class="meta">Signed in as <strong>${escapeHtml(currentUser)}</strong></div>
    </main>
  </body>
</html>`;
}

export function buildOrganizationsPage(currentUser: string, organizations: OrganizationView[], flash = ''): string {
  const rows = organizations.length
    ? organizations.map((org) => `<tr><td><strong>${escapeHtml(org.name)}</strong></td><td>${escapeHtml(org.description || '—')}</td><td>${org.child_organization_count ?? 0}</td></tr>`).join('')
    : '<tr><td colspan="3" class="empty">No organizations yet.</td></tr>';

  return layout('Matrix Manager · Organizations', currentUser, '/orgs', `
    <h1>Organizations</h1>
    <p class="lead">Create the structural homes for teams and reporting lines. This page is backed by the new TypeScript API.</p>
    <div class="grid">
      <section class="card">
        <h2 class="section-title">Create organization</h2>
        <form method="post" action="/orgs/create">
          <label for="name">Name</label>
          <input id="name" name="name" required />
          <label for="description">Description</label>
          <textarea id="description" name="description" rows="4"></textarea>
          <button class="primary" type="submit">Create organization</button>
        </form>
      </section>
      <section class="card">
        <h2 class="section-title">Current organizations</h2>
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Children</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    </div>
  `, flash);
}

export function buildEmployeesPage(currentUser: string, employees: EmployeeView[], organizations: OrganizationView[], flash = ''): string {
  const orgOptions = organizations.length
    ? organizations.map((org) => `<option value="${org.id}">${escapeHtml(org.name)}</option>`).join('')
    : '<option value="">Create an organization first</option>';
  const rows = employees.length
    ? employees.map((employee) => `<tr><td><strong>${escapeHtml(employee.name)}</strong></td><td>${escapeHtml(employee.organization_name || '—')}</td><td>${escapeHtml(employee.employee_type || '—')}</td><td>${escapeHtml(employee.manager_name || '—')}</td><td>${escapeHtml(employee.location || '—')}</td><td>${employee.capacity ?? 1}</td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">No employees yet.</td></tr>';

  return layout('Matrix Manager · Employees', currentUser, '/people', `
    <h1>Employees</h1>
    <p class="lead">Add people to the model and place them inside organizations. This is the first real data-entry UI on the TypeScript backend.</p>
    <div class="grid">
      <section class="card">
        <h2 class="section-title">Create employee</h2>
        <form method="post" action="/people/create">
          <label for="name">Name</label>
          <input id="name" name="name" required />
          <label for="organization_id">Organization</label>
          <select id="organization_id" name="organization_id" ${organizations.length ? '' : 'disabled'} required>
            ${orgOptions}
          </select>
          <label for="employee_type">Type</label>
          <select id="employee_type" name="employee_type">
            <option value="IC">IC</option>
            <option value="L">L</option>
          </select>
          <label for="location">Location</label>
          <input id="location" name="location" />
          <label for="capacity">Capacity</label>
          <input id="capacity" name="capacity" type="number" min="0.1" step="0.1" value="1" />
          <button class="primary" type="submit" ${organizations.length ? '' : 'disabled'}>Create employee</button>
        </form>
      </section>
      <section class="card">
        <h2 class="section-title">Current employees</h2>
        <table>
          <thead><tr><th>Name</th><th>Organization</th><th>Type</th><th>Manager</th><th>Location</th><th>Capacity</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    </div>
  `, flash);
}
