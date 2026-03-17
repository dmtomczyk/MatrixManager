import { renderAppChrome } from './chrome.js';

interface OrganizationView {
  id: number;
  name: string;
  description?: string | null;
  child_organization_count?: number;
  employee_count?: number;
}

interface JobCodeView {
  id: number;
  name: string;
  is_leader: boolean;
  assigned_employee_count?: number;
}

interface EmployeeView {
  id: number;
  name: string;
  employee_type?: string | null;
  job_code_id?: number | null;
  job_code_name?: string | null;
  organization_id: number;
  organization_name?: string | null;
  manager_id?: number | null;
  manager_name?: string | null;
  role?: string | null;
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
      .wrap{max-width:1200px;margin:0 auto;padding:28px 16px 44px}.meta{color:#64748b;font-size:14px;margin:6px 0 0}
      h1{margin:0 0 8px;font-size:38px}.lead{color:#475569;max-width:760px;line-height:1.7}
      .grid{display:grid;grid-template-columns:380px minmax(0,1fr);gap:20px;align-items:start;margin-top:24px}
      .card{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:20px;box-shadow:0 10px 30px rgba(15,23,42,.05)}
      label{display:block;margin:14px 0 6px;font-size:14px;font-weight:600} input,textarea,select{width:100%;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;background:white}
      button.primary,.button-link{margin-top:16px;padding:12px 14px;border:0;border-radius:10px;background:#0f172a;color:white;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;justify-content:center;align-items:center}
      button.secondary{padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;background:white;color:#0f172a;font-weight:600;cursor:pointer}
      button.danger{padding:10px 12px;border:1px solid #fecaca;border-radius:10px;background:#fff1f2;color:#b91c1c;font-weight:600;cursor:pointer}
      table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top} th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
      .flash{margin:0 0 16px;border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:12px;padding:12px 14px}
      .empty{color:#64748b}.section-title{margin:0 0 12px;font-size:22px}.row-form{display:grid;gap:10px}.actions{display:flex;gap:8px;flex-wrap:wrap}.subtle{color:#64748b;font-size:13px}
      .stack{display:grid;gap:12px}.checkbox{display:flex;gap:10px;align-items:center;margin-top:14px}.checkbox input{width:auto}
      @media (max-width: 980px){.grid{grid-template-columns:1fr}}
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
    ? organizations.map((org) => `<tr>
        <td><strong>${escapeHtml(org.name)}</strong><div class="subtle">ID ${org.id}</div></td>
        <td>${escapeHtml(org.description || '—')}</td>
        <td>${org.child_organization_count ?? 0}</td>
        <td>${org.employee_count ?? 0}</td>
        <td>
          <div class="stack">
            <form method="post" action="/orgs/${org.id}/update" class="row-form">
              <input name="name" value="${escapeHtml(org.name)}" required />
              <textarea name="description" rows="2">${escapeHtml(org.description || '')}</textarea>
              <div class="actions"><button class="secondary" type="submit">Save</button></div>
            </form>
            <form method="post" action="/orgs/${org.id}/delete" onsubmit="return confirm('Delete ${escapeHtml(org.name)}?');">
              <button class="danger" type="submit">Delete</button>
            </form>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="empty">No organizations yet.</td></tr>';

  return layout('Matrix Manager · Organizations', currentUser, '/orgs', `
    <h1>Organizations</h1>
    <p class="lead">Create and maintain the structural homes for teams and reporting lines. This route is fully backed by the TypeScript workforce service.</p>
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
          <thead><tr><th>Name</th><th>Description</th><th>Children</th><th>People</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    </div>
  `, flash);
}

export function buildJobCodesPage(currentUser: string, jobCodes: JobCodeView[], flash = ''): string {
  const rows = jobCodes.length
    ? jobCodes.map((jobCode) => `<tr>
        <td><strong>${escapeHtml(jobCode.name)}</strong><div class="subtle">ID ${jobCode.id}</div></td>
        <td>${jobCode.is_leader ? 'Leader' : 'IC'}</td>
        <td>${jobCode.assigned_employee_count ?? 0}</td>
        <td>
          <div class="stack">
            <form method="post" action="/job-codes/${jobCode.id}/update" class="row-form">
              <input name="name" value="${escapeHtml(jobCode.name)}" required />
              <label class="checkbox"><input type="checkbox" name="is_leader" ${jobCode.is_leader ? 'checked' : ''} /> Leader role</label>
              <div class="actions"><button class="secondary" type="submit">Save</button></div>
            </form>
            <form method="post" action="/job-codes/${jobCode.id}/delete" onsubmit="return confirm('Delete ${escapeHtml(jobCode.name)}?');">
              <button class="danger" type="submit">Delete</button>
            </form>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="empty">No job codes yet.</td></tr>';

  return layout('Matrix Manager · Job Codes', currentUser, '/job-codes', `
    <h1>Job Codes</h1>
    <p class="lead">Define the reusable roles people can hold. Leader job codes allow employees using them to act as managers.</p>
    <div class="grid">
      <section class="card">
        <h2 class="section-title">Create job code</h2>
        <form method="post" action="/job-codes/create">
          <label for="name">Name</label>
          <input id="name" name="name" required />
          <label class="checkbox"><input type="checkbox" name="is_leader" /> Leader role</label>
          <button class="primary" type="submit">Create job code</button>
        </form>
      </section>
      <section class="card">
        <h2 class="section-title">Current job codes</h2>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Assigned</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    </div>
  `, flash);
}

export function buildEmployeesPage(currentUser: string, employees: EmployeeView[], organizations: OrganizationView[], jobCodes: JobCodeView[], flash = ''): string {
  const orgOptions = organizations.length
    ? organizations.map((org) => `<option value="${org.id}">${escapeHtml(org.name)}</option>`).join('')
    : '<option value="">Create an organization first</option>';
  const jobCodeOptions = jobCodes.length
    ? jobCodes.map((jobCode) => `<option value="${jobCode.id}">${escapeHtml(jobCode.name)}${jobCode.is_leader ? ' · Leader' : ''}</option>`).join('')
    : '<option value="">Create a job code first</option>';
  const managerOptions = ['<option value="">No manager</option>']
    .concat(employees.filter((employee) => employee.employee_type === 'L').map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)).join('');
  const rows = employees.length
    ? employees.map((employee) => `<tr>
        <td><strong>${escapeHtml(employee.name)}</strong><div class="subtle">ID ${employee.id}</div></td>
        <td>${escapeHtml(employee.job_code_name || '—')}</td>
        <td>${escapeHtml(employee.employee_type || '—')}</td>
        <td>${escapeHtml(employee.organization_name || '—')}</td>
        <td>${escapeHtml(employee.manager_name || '—')}</td>
        <td>${escapeHtml(employee.location || '—')}</td>
        <td>${employee.capacity ?? 1}</td>
        <td>
          <div class="stack">
            <form method="post" action="/people/${employee.id}/update" class="row-form">
              <input name="name" value="${escapeHtml(employee.name)}" required />
              <select name="job_code_id" id="employee-job-code">
                ${jobCodes.map((jobCode) => `<option value="${jobCode.id}" ${employee.job_code_id === jobCode.id ? 'selected' : ''}>${escapeHtml(jobCode.name)}${jobCode.is_leader ? ' · Leader' : ''}</option>`).join('')}
              </select>
              <select name="organization_id">${organizations.map((org) => `<option value="${org.id}" ${employee.organization_id === org.id ? 'selected' : ''}>${escapeHtml(org.name)}</option>`).join('')}</select>
              <select name="manager_id" id="employee-manager">${['<option value="">No manager</option>'].concat(employees.filter((item) => item.employee_type === 'L' && item.id !== employee.id).map((item) => `<option value="${item.id}" ${employee.manager_id === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`)).join('')}</select>
              <input name="role" value="${escapeHtml(employee.role || '')}" placeholder="Role label (optional)" />
              <input name="location" value="${escapeHtml(employee.location || '')}" placeholder="Location" />
              <input name="capacity" type="number" min="0.1" step="0.1" value="${employee.capacity ?? 1}" />
              <div class="actions"><button class="secondary" type="submit">Save</button></div>
            </form>
            <form method="post" action="/people/${employee.id}/delete" onsubmit="return confirm('Delete ${escapeHtml(employee.name)}?');">
              <button class="danger" type="submit">Delete</button>
            </form>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="empty">No employees yet.</td></tr>';

  return layout('Matrix Manager · Employees', currentUser, '/people', `
    <h1>Employees</h1>
    <p class="lead">Add people to the model, place them inside organizations, and connect them to reusable job codes. This page is now TypeScript-backed for create, edit, and delete.</p>
    <div class="grid">
      <section class="card">
        <h2 class="section-title">Create employee</h2>
        <form method="post" action="/people/create">
          <label for="name">Name</label>
          <input id="name" name="name" required />
          <label for="job_code_id">Job code</label>
          <select id="employee-job-code" name="job_code_id" ${jobCodes.length ? '' : 'disabled'} required>${jobCodeOptions}</select>
          <label for="organization_id">Organization</label>
          <select id="organization_id" name="organization_id" ${organizations.length ? '' : 'disabled'} required>${orgOptions}</select>
          <label for="manager_id">Manager</label>
          <select id="employee-manager" name="manager_id">${managerOptions}</select>
          <label for="role">Role label</label>
          <input id="role" name="role" />
          <label for="location">Location</label>
          <input id="location" name="location" />
          <label for="capacity">Capacity</label>
          <input id="capacity" name="capacity" type="number" min="0.1" step="0.1" value="1" />
          <button class="primary" type="submit" ${organizations.length && jobCodes.length ? '' : 'disabled'}>Create employee</button>
        </form>
      </section>
      <section class="card">
        <h2 class="section-title">Current employees</h2>
        <table>
          <thead><tr><th>Name</th><th id="employee-job-code">Job Code</th><th id="employee-type">Type</th><th>Organization</th><th id="employee-manager">Manager</th><th>Location</th><th>Capacity</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    </div>
  `, flash);
}
