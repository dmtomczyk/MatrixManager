const greeting = document.getElementById('dashboard-greeting');
const subtitle = document.getElementById('dashboard-subtitle');
const summaryPills = document.getElementById('dashboard-summary-pills');
const subordinatesList = document.getElementById('subordinates-list');
const trackedList = document.getElementById('tracked-list');
const approvalList = document.getElementById('approval-list');
const submittedList = document.getElementById('submitted-list');
const subordinatesCount = document.getElementById('subordinates-count');
const trackedCount = document.getElementById('tracked-count');
const approvalCount = document.getElementById('approval-count');
const submittedCount = document.getElementById('submitted-count');
const trackedEmployeeSelect = document.getElementById('tracked-employee-select');
const trackedEmployeeAdd = document.getElementById('tracked-employee-add');
const emptyState = document.getElementById('dashboard-team-empty');
const toast = document.getElementById('toast');

let dashboard = null;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const formatPercent = (value = 0) => `${Math.round((Number(value) || 0) * 10) / 10}%`;
const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString() : '—';

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  if (response.status === 204) return null;
  return response.json();
};

const showToast = (message) => {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
};

const renderSummaryPills = () => {
  if (!summaryPills || !dashboard) return;
  const totalTeam = (dashboard.direct_reports || []).length;
  const totalTracked = (dashboard.tracked_employees || []).length;
  const totalApprovals = (dashboard.approval_items || []).length;
  const totalSubmitted = (dashboard.submitted_items || []).length;
  summaryPills.innerHTML = [
    `<span class="badge">${totalTeam} team</span>`,
    `<span class="badge">${totalTracked} tracked</span>`,
    `<span class="badge">${totalApprovals} approvals</span>`,
    `<span class="badge">${totalSubmitted} submitted</span>`,
  ].join('');
};

const buildLoadBar = (employee) => {
  const ratio = Math.min(100, Math.max(0, Number(employee.active_allocation_percent) || 0));
  return `
    <div class="dashboard-loadbar-shell" aria-label="${escapeHtml(employee.name)} allocation ${formatPercent(employee.active_allocation_percent)} of ${formatPercent(employee.capacity_percent)} capacity">
      <div class="dashboard-loadbar-fill dashboard-loadbar-fill-${escapeHtml(employee.load_status)}" style="width:${ratio}%"></div>
    </div>`;
};

const buildEmployeeCard = (employee, { removable = false } = {}) => {
  const chips = [];
  if (employee.is_direct_report) chips.push('<span class="badge">Direct</span>');
  if (employee.is_indirect_report) chips.push('<span class="badge">Indirect</span>');
  if (employee.is_tracked) chips.push('<span class="badge">Tracked</span>');
  const removeButton = removable ? `<button type="button" class="ghost-button compact-toolbar-button" data-action="remove-tracked" data-id="${employee.id}">Remove</button>` : '';
  return `
    <article class="dashboard-employee-card dashboard-status-${escapeHtml(employee.load_status)}">
      <div class="dashboard-employee-top">
        <div>
          <h4>${escapeHtml(employee.name)}</h4>
          <p>${escapeHtml(employee.organization_name || 'No organization')} · ${escapeHtml(employee.manager_name || 'No manager')}</p>
        </div>
        <div class="dashboard-employee-actions">${chips.join('')}${removeButton}</div>
      </div>
      ${buildLoadBar(employee)}
      <div class="dashboard-employee-metrics">
        <span><strong>${formatPercent(employee.active_allocation_percent)}</strong> allocated</span>
        <span><strong>${formatPercent(employee.capacity_percent)}</strong> capacity</span>
        <span><strong>${employee.active_assignment_count || 0}</strong> active assignments</span>
      </div>
    </article>`;
};

const renderEmployeeList = (items, container, emptyText, options = {}) => {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="panel"><p class="muted">${escapeHtml(emptyText)}</p></div>`;
    return;
  }
  container.innerHTML = items.map((item) => buildEmployeeCard(item, options)).join('');
};

const buildRequestCard = (item, mode) => {
  const pendingNames = Array.isArray(item.pending_approver_usernames) ? item.pending_approver_usernames.join(', ') : '';
  const stateLine = mode === 'approval'
    ? (pendingNames ? `Awaiting: ${escapeHtml(pendingNames)}` : 'Awaiting your approval')
    : (pendingNames ? `Pending approvers: ${escapeHtml(pendingNames)}` : 'Still in review');
  return `
    <article class="dashboard-request-card">
      <div class="dashboard-request-top">
        <div>
          <h4>${escapeHtml(item.employee_name || 'Employee')} → ${escapeHtml(item.project_name || 'Project')}</h4>
          <p>${formatDate(item.start_date)} → ${formatDate(item.end_date)} · ${formatPercent((Number(item.allocation) || 0) * 100)}</p>
        </div>
        <span class="badge badge-request">${mode === 'approval' ? 'Action needed' : 'Submitted'}</span>
      </div>
      <p class="dashboard-request-meta">${stateLine}</p>
      <div class="dashboard-request-actions">
        <a href="/staffing" class="ghost-button compact-toolbar-button">Open Assignments</a>
      </div>
    </article>`;
};

const renderRequestList = (items, container, emptyText, mode) => {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="panel"><p class="muted">${escapeHtml(emptyText)}</p></div>`;
    return;
  }
  container.innerHTML = items.map((item) => buildRequestCard(item, mode)).join('');
};

const renderTrackingCandidates = () => {
  if (!trackedEmployeeSelect || !dashboard) return;
  const candidates = dashboard.available_tracking_candidates || [];
  trackedEmployeeSelect.innerHTML = ['<option value="">Select employee to track</option>']
    .concat(candidates.map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)}${employee.organization_name ? ` · ${escapeHtml(employee.organization_name)}` : ''}</option>`))
    .join('');
  trackedEmployeeAdd.disabled = !candidates.length;
};

const renderDashboard = () => {
  if (!dashboard) return;
  const hasEmployeeLink = Boolean(dashboard.employee_id);
  if (greeting) greeting.textContent = hasEmployeeLink && dashboard.employee_name ? `${dashboard.employee_name}'s dashboard` : 'Your dashboard';
  if (subtitle) subtitle.textContent = hasEmployeeLink
    ? 'Quick load view for your reporting chain plus any extra employees you want to watch.'
    : 'This account is not linked to an employee yet, so subordinate views are unavailable.';
  emptyState?.classList.toggle('hidden', hasEmployeeLink);
  renderSummaryPills();
  renderTrackingCandidates();
  renderEmployeeList(dashboard.direct_reports || [], subordinatesList, 'No subordinates found for this account yet.');
  renderEmployeeList(dashboard.tracked_employees || [], trackedList, 'No tracked employees yet.', { removable: true });
  renderRequestList(dashboard.approval_items || [], approvalList, 'No pending approvals right now.', 'approval');
  renderRequestList(dashboard.submitted_items || [], submittedList, 'No submitted requests are waiting right now.', 'submitted');
  if (subordinatesCount) subordinatesCount.textContent = String((dashboard.direct_reports || []).length);
  if (trackedCount) trackedCount.textContent = String((dashboard.tracked_employees || []).length);
  if (approvalCount) approvalCount.textContent = String((dashboard.approval_items || []).length);
  if (submittedCount) submittedCount.textContent = String((dashboard.submitted_items || []).length);
};

const persistTrackedEmployees = async (employeeIds) => {
  dashboard = await apiFetch('/dashboard-api/tracked-employees', {
    method: 'PUT',
    body: JSON.stringify({ employee_ids: employeeIds }),
  });
  renderDashboard();
};

trackedEmployeeAdd?.addEventListener('click', async () => {
  const employeeId = Number(trackedEmployeeSelect.value);
  if (!employeeId) return;
  const nextIds = [
    ...new Set([...(dashboard.tracked_employees || []).map((item) => item.id), employeeId]),
  ];
  try {
    await persistTrackedEmployees(nextIds);
    showToast('Tracked employee added');
  } catch (err) {
    alert(err.message);
  }
});

trackedList?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="remove-tracked"]');
  if (!button) return;
  const employeeId = Number(button.dataset.id);
  const nextIds = (dashboard.tracked_employees || []).map((item) => item.id).filter((id) => id !== employeeId);
  try {
    await persistTrackedEmployees(nextIds);
    showToast('Tracked employee removed');
  } catch (err) {
    alert(err.message);
  }
});

const loadDashboard = async () => {
  try {
    dashboard = await apiFetch('/dashboard-api');
    renderDashboard();
  } catch (err) {
    showToast(err.message);
  }
};

loadDashboard();
