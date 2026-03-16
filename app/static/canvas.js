const canvasStage = document.querySelector('#canvas-stage');
const canvasContent = document.querySelector('#canvas-content');
const contextMenu = document.querySelector('#context-menu');
const modal = document.querySelector('#canvas-modal');
const modalBody = document.querySelector('#modal-body');
const modalClose = document.querySelector('#modal-close');
const resetViewBtn = document.querySelector('#reset-view');
const toast = document.querySelector('#toast');
const allocationUnitsSelect = document.querySelector('#allocation-units');
const resourceList = document.querySelector('#resource-list');
const canvasOrgFilter = document.querySelector('#canvas-org-filter');

const HOURS_PER_FTE = 40;
const DAY_MS = 86400000;
const WEEK_MS = DAY_MS * 7;

const state = {
  organizations: [],
  employees: [],
  projects: [],
  assignments: [],
  expandedManagers: new Set(),
  canvasNodeRects: new Map(),
};

let pan = { x: 0, y: 0 };
let isPanning = false;
let pointerId = null;
let panStart = { x: 0, y: 0 };
let contextTarget = { type: 'canvas', id: null };
let panInitialized = false;
let dragEmployeeId = null;
let allocationUnits = 'percent';
let projectChart = null;
let connectionDraft = null;

const formatISODate = (date) => new Date(date).toISOString().split('T')[0];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));

const getLeaderEmployees = (currentEmployeeId = null) =>
  state.employees.filter((emp) => emp.employee_type === 'L' && emp.id !== currentEmployeeId).sort((a, b) => a.name.localeCompare(b.name));

const toDateValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return NaN;
  date.setHours(0, 0, 0, 0);
  return date.valueOf();
};

const getWeekRangeForValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  const weekStartValue = date.valueOf();
  const weekEnd = new Date(date);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStartValue, weekEndValue: weekEnd.valueOf(), weekStartDate: new Date(weekStartValue) };
};

const getCurrentWeekRange = () => getWeekRangeForValue(Date.now());
const overlapsRange = (startValue, endValue, rangeStart, rangeEnd) => startValue <= rangeEnd && endValue >= rangeStart;

const showToast = (message) => {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
};

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  if (response.status === 204) return null;
  return response.json();
};

const applyTransform = () => { canvasContent.style.transform = `translate(${pan.x}px, ${pan.y}px)`; };
const hideContextMenu = () => contextMenu?.classList.add('hidden');

const closeModal = () => {
  modal?.classList.add('hidden');
  modalBody.innerHTML = '';
  modal?.querySelector('.modal-content')?.classList.remove('modal-wide');
  if (projectChart) { projectChart.destroy(); projectChart = null; }
};

const buildOptions = (items, selectedId, placeholder = null) => {
  const options = items.map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
  return placeholder ? `<option value="">${placeholder}</option>${options}` : options;
};

const buildManagerOptions = (selectedId = null, currentEmployeeId = null) => {
  const options = getLeaderEmployees(currentEmployeeId).map((employee) => {
    const suffix = employee.organization_name ? ` · ${employee.organization_name}` : '';
    return `<option value="${employee.id}" ${employee.id === selectedId ? 'selected' : ''}>${escapeHtml(employee.name + suffix)}</option>`;
  }).join('');
  return `<option value="">No manager</option>${options}`;
};

const getOrganizationName = (organizationId) => state.organizations.find((org) => org.id === organizationId)?.name || `Org ${organizationId}`;
const getEmployeeById = (employeeId) => state.employees.find((employee) => employee.id === employeeId) || null;
const getProjectById = (projectId) => state.projects.find((project) => project.id === projectId) || null;

const openOrganizationModal = () => {
  modalBody.innerHTML = `
    <h3>Create organization</h3>
    <form id="organization-modal-form">
      <label>Name<input name="name" required /></label>
      <label>Description<textarea name="description" rows="2"></textarea></label>
      <button type="submit">Create organization</button>
    </form>`;
  modal.classList.remove('hidden');
  const form = document.querySelector('#organization-modal-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = { name: String(formData.get('name') || '').trim(), description: String(formData.get('description') || '').trim() || null };
    try {
      await apiFetch('/organizations', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Organization created');
      closeModal();
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  });
};

const openProjectModal = (projectId = null) => {
  const editing = Boolean(projectId);
  const project = editing ? state.projects.find((proj) => proj.id === projectId) : null;
  if (editing && !project) return alert('Project not found');
  modalBody.innerHTML = `
    <h3>${editing ? 'Edit project' : 'Create project'}</h3>
    <form id="project-modal-form">
      <label>Name<input name="name" value="${escapeHtml(project?.name || '')}" required /></label>
      <label>Description<textarea name="description" rows="2">${escapeHtml(project?.description || '')}</textarea></label>
      <label>Start Date<input type="date" name="start_date" value="${project?.start_date || ''}" /></label>
      <label>End Date<input type="date" name="end_date" value="${project?.end_date || ''}" /></label>
      <button type="submit">${editing ? 'Save changes' : 'Create project'}</button>
    </form>`;
  modal.classList.remove('hidden');
  const form = document.querySelector('#project-modal-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = { name: formData.get('name').trim(), description: formData.get('description').trim() || null, start_date: formData.get('start_date') || null, end_date: formData.get('end_date') || null };
    try {
      if (editing) await apiFetch(`/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await apiFetch('/projects', { method: 'POST', body: JSON.stringify(payload) });
      showToast(editing ? 'Project updated' : 'Project created');
      closeModal();
      await loadData();
    } catch (err) { alert(err.message); }
  });
};

const openProjectEditModal = (projectId = null) => {
  if (!state.projects.length) return alert('No projects available yet.');
  let currentProjectId = projectId || null;
  const pickerOptions = ['<option value="">Select project...</option>'].concat(state.projects.map((proj) => `<option value="${proj.id}" ${proj.id === currentProjectId ? 'selected' : ''}>${escapeHtml(proj.name)}</option>`)).join('');
  modalBody.innerHTML = `
    <h3>Edit project</h3>
    <label class="muted small-text">Project<select id="project-picker">${pickerOptions}</select></label>
    <form id="project-edit-form">
      <label>Name<input name="name" required /></label>
      <label>Description<textarea name="description" rows="2"></textarea></label>
      <label>Start Date<input type="date" name="start_date" /></label>
      <label>End Date<input type="date" name="end_date" /></label>
      <button type="submit">Save changes</button>
    </form>`;
  modal.classList.remove('hidden');
  const picker = document.querySelector('#project-picker');
  const form = document.querySelector('#project-edit-form');
  const populateFields = (id) => {
    const project = state.projects.find((proj) => proj.id === id);
    if (!project) { form.reset(); currentProjectId = null; return; }
    currentProjectId = id;
    form.elements.name.value = project.name || '';
    form.elements.description.value = project.description || '';
    form.elements.start_date.value = project.start_date || '';
    form.elements.end_date.value = project.end_date || '';
  };
  picker.addEventListener('change', (event) => populateFields(Number(event.target.value) || null));
  if (currentProjectId) populateFields(currentProjectId); else { picker.value = ''; form.reset(); }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentProjectId) return alert('Select a project to edit.');
    const formData = new FormData(form);
    const payload = { name: formData.get('name').trim(), description: formData.get('description').trim() || null, start_date: formData.get('start_date') || null, end_date: formData.get('end_date') || null };
    try {
      await apiFetch(`/projects/${currentProjectId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Project updated');
      closeModal();
      await loadData();
    } catch (err) { alert(err.message); }
  });
};

const openEmployeeModal = (employeeId = null) => {
  if (!state.employees.length) return alert('No employees available yet.');
  let currentEmployeeId = employeeId || null;
  const pickerOptions = ['<option value="">Select employee...</option>'].concat(state.employees.map((emp) => `<option value="${emp.id}" ${emp.id === currentEmployeeId ? 'selected' : ''}>${escapeHtml(emp.name)}</option>`)).join('');
  modalBody.innerHTML = `
    <h3>Edit employee</h3>
    <label class="muted small-text">Employee<select id="employee-picker">${pickerOptions}</select></label>
    <form id="employee-modal-form">
      <label>Name<input name="name" required /></label>
      <label>Role<input name="role" /></label>
      <label>Type
        <select name="employee_type"><option value="IC">IC</option><option value="L">L</option></select>
      </label>
      <label>Manager<select name="manager_id">${buildManagerOptions(null, currentEmployeeId)}</select></label>
      <label>Location<input name="location" /></label>
      <label>Capacity<input type="number" name="capacity" step="0.1" min="0.1" required /></label>
      <button type="submit">Save changes</button>
    </form>`;
  modal.classList.remove('hidden');
  const picker = document.querySelector('#employee-picker');
  const form = document.querySelector('#employee-modal-form');
  const populateFields = (id) => {
    const employee = state.employees.find((emp) => emp.id === id);
    form.elements.manager_id.innerHTML = buildManagerOptions(employee?.manager_id || null, id);
    if (!employee) { form.reset(); currentEmployeeId = null; return; }
    currentEmployeeId = id;
    form.elements.name.value = employee.name || '';
    form.elements.role.value = employee.role || '';
    form.elements.employee_type.value = employee.employee_type || 'IC';
    form.elements.location.value = employee.location || '';
    form.elements.capacity.value = employee.capacity || 1;
    form.elements.manager_id.value = employee.manager_id || '';
  };
  picker.addEventListener('change', (event) => populateFields(Number(event.target.value) || null));
  if (currentEmployeeId) populateFields(currentEmployeeId); else { picker.value = ''; form.reset(); }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentEmployeeId) return alert('Select an employee to edit.');
    const formData = new FormData(form);
    const managerId = formData.get('manager_id');
    const payload = { name: formData.get('name').trim(), role: formData.get('role').trim() || null, employee_type: formData.get('employee_type') || 'IC', location: formData.get('location').trim() || null, capacity: Number(formData.get('capacity')) || 1, manager_id: managerId ? Number(managerId) : null };
    try {
      await apiFetch(`/employees/${currentEmployeeId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Employee updated');
      closeModal();
      await loadData();
    } catch (err) { alert(err.message); }
  });
};

const buildHierarchy = (employees) => {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const directReports = new Map();
  employees.forEach((employee) => directReports.set(employee.id, []));
  const roots = [];
  employees.forEach((employee) => {
    if (employee.manager_id && byId.has(employee.manager_id)) directReports.get(employee.manager_id).push(employee);
    else roots.push(employee);
  });
  const sortEmployees = (list) => list.sort((a, b) => a.name.localeCompare(b.name));
  sortEmployees(roots); directReports.forEach((list) => sortEmployees(list));
  return { roots, directReports };
};

const createResourceItem = (employee, options = {}) => {
  const { level = 0, hasChildren = false, expanded = false } = options;
  const nested = level > 0;
  const item = document.createElement('div');
  item.className = `resource-item${nested ? ' resource-item-nested' : ''}${hasChildren ? ' resource-item-manager' : ''}`;
  item.style.marginLeft = `${level * 22}px`;
  item.setAttribute('draggable', 'true');
  item.dataset.dragType = 'employee';
  item.dataset.id = employee.id;
  const infoRow = document.createElement('div'); infoRow.className = 'resource-row';
  const left = document.createElement('div'); left.className = 'resource-left';
  if (hasChildren) {
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'hierarchy-toggle'; toggle.dataset.managerToggle = employee.id; toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false'); toggle.textContent = expanded ? '▾' : '▸'; left.appendChild(toggle);
  } else {
    const spacer = document.createElement('span'); spacer.className = 'hierarchy-spacer'; spacer.textContent = '•'; left.appendChild(spacer);
  }
  const details = document.createElement('div'); details.className = 'resource-details';
  const subtitleParts = [employee.role, employee.employee_type, employee.organization_name].filter(Boolean);
  if (employee.manager_name && !nested) subtitleParts.push(`Reports to ${employee.manager_name}`);
  if (hasChildren) subtitleParts.push(`${employee.direct_report_count || 0} direct report${employee.direct_report_count === 1 ? '' : 's'}`);
  details.innerHTML = `<strong>${escapeHtml(employee.name)}</strong><span class="resource-meta">${escapeHtml(subtitleParts.join(' • '))}</span>`;
  left.appendChild(details);
  const capacity = document.createElement('span'); capacity.className = 'resource-meta'; capacity.textContent = `${Math.round((employee.capacity || 1) * 100)}%`;
  infoRow.append(left, capacity); item.appendChild(infoRow); return item;
};

const renderResources = () => {
  if (!resourceList) return;
  let selectedOrg = canvasOrgFilter?.value || '';
  const orgMap = new Map();
  state.employees.forEach((employee) => {
    if (employee.organization_id != null) {
      const key = String(employee.organization_id);
      if (!orgMap.has(key)) orgMap.set(key, employee.organization_name || `Org ${employee.organization_id}`);
    }
  });
  if (canvasOrgFilter) {
    const previous = canvasOrgFilter.value;
    const options = ['<option value="">All</option>'].concat(Array.from(orgMap.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)).join('');
    canvasOrgFilter.innerHTML = options;
    canvasOrgFilter.value = previous && orgMap.has(previous) ? previous : '';
    selectedOrg = canvasOrgFilter.value;
  }
  const filtered = state.employees.filter((employee) => !selectedOrg || String(employee.organization_id) === selectedOrg);
  resourceList.innerHTML = '';
  if (!filtered.length) {
    const empty = document.createElement('div'); empty.className = 'muted'; empty.textContent = 'No employees match this filter.'; resourceList.appendChild(empty); return;
  }
  const { roots, directReports } = buildHierarchy(filtered);
  const appendEmployeeTree = (employee, level = 0) => {
    const children = directReports.get(employee.id) || [];
    const hasChildren = children.length > 0;
    const expanded = hasChildren && state.expandedManagers.has(employee.id);
    resourceList.appendChild(createResourceItem(employee, { level, hasChildren, expanded }));
    if (expanded) children.forEach((report) => appendEmployeeTree(report, level + 1));
  };
  roots.forEach((employee) => appendEmployeeTree(employee, 0));
};

const openProjectTimeline = (projectId) => {
  const project = state.projects.find((proj) => proj.id === projectId);
  if (!project) return alert('Project not found');
  const projectAssignments = state.assignments.filter((asg) => asg.project_id === projectId);
  if (!projectAssignments.length) return alert('No assignments for this project yet.');
  const assignmentRanges = [];
  const projectStartValue = toDateValue(project.start_date);
  const projectEndValue = toDateValue(project.end_date);
  let minStart = Number.isFinite(projectStartValue) ? projectStartValue : Infinity;
  let maxEnd = Number.isFinite(projectEndValue) ? projectEndValue : -Infinity;
  let minAssignmentStart = Infinity;
  let maxAssignmentEnd = -Infinity;
  projectAssignments.forEach((asg) => {
    const startValue = toDateValue(asg.start_date); const endValue = toDateValue(asg.end_date);
    if (Number.isNaN(startValue) || Number.isNaN(endValue)) return;
    assignmentRanges.push({ startValue, endValue, allocation: asg.allocation || 0 });
    if (startValue < minAssignmentStart) minAssignmentStart = startValue;
    if (endValue > maxAssignmentEnd) maxAssignmentEnd = endValue;
  });
  if (!Number.isFinite(minStart)) minStart = minAssignmentStart;
  if (!Number.isFinite(maxEnd)) maxEnd = maxAssignmentEnd;
  if (!assignmentRanges.length || !Number.isFinite(minStart) || !Number.isFinite(maxEnd)) return alert('No schedulable assignments for this project yet.');
  let cursorValue = minStart; const labels = []; const values = []; const MAX_WEEKS = 520;
  const formatWeekLabel = (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  while (cursorValue <= maxEnd && labels.length < MAX_WEEKS) {
    const rangeStart = cursorValue; const rangeEnd = Math.min(cursorValue + WEEK_MS - DAY_MS, maxEnd);
    const fte = assignmentRanges.reduce((sum, rangeData) => overlapsRange(rangeData.startValue, rangeData.endValue, rangeStart, rangeEnd) ? sum + rangeData.allocation : sum, 0);
    labels.push(formatWeekLabel(rangeStart)); values.push(Number(fte.toFixed(2))); cursorValue += WEEK_MS;
  }
  if (labels.length) { labels[0] = formatWeekLabel(minStart); labels[labels.length - 1] = formatWeekLabel(maxEnd); }
  modalBody.innerHTML = `<h3>${escapeHtml(project.name)} · weekly FTE</h3><div class="chart-panel"><canvas id="project-chart"></canvas></div>`;
  modal.querySelector('.modal-content')?.classList.add('modal-wide'); modal.classList.remove('hidden');
  const ctx = document.getElementById('project-chart'); if (!ctx) return;
  projectChart = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'FTE', data: values, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.15)', borderWidth: 2, tension: 0.25, fill: true, pointRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'FTE' } }, x: { ticks: { autoSkip: true, maxTicksLimit: 6 } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.formattedValue} FTE` } } } } });
};

const openAssignmentModal = (defaults = {}) => {
  if (!state.employees.length || !state.projects.length) return alert('Add employees and projects before creating assignments.');
  const defaultEmployeeId = defaults.employeeId ?? (contextTarget.type === 'employee' ? Number(contextTarget.id) : null);
  const defaultProjectId = defaults.projectId ?? (contextTarget.type === 'project' ? Number(contextTarget.id) : null);
  modalBody.innerHTML = `
    <h3>Add assignment</h3>
    <form id="assignment-modal-form">
      <label>Employee<select name="employee_id" required>${buildOptions(state.employees, defaultEmployeeId)}</select></label>
      <label>Project<select name="project_id" required>${buildOptions(state.projects, defaultProjectId)}</select></label>
      <label>Start Date<input type="date" name="start_date" value="${formatISODate(new Date())}" required /></label>
      <label>End Date<input type="date" name="end_date" value="${formatISODate(new Date())}" required /></label>
      <label>Allocation (%)<input type="number" name="allocation" min="1" max="100" value="100" required /></label>
      <label>Notes<textarea name="notes" rows="2"></textarea></label>
      <button type="submit">Save assignment</button>
    </form>`;
  modal.classList.remove('hidden');
  const form = document.querySelector('#assignment-modal-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = { employee_id: Number(formData.get('employee_id')), project_id: Number(formData.get('project_id')), start_date: formData.get('start_date'), end_date: formData.get('end_date'), allocation: (Number(formData.get('allocation')) || 0) / 100, notes: formData.get('notes').trim() || null };
    try {
      await apiFetch('/assignments', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Assignment added'); closeModal(); await loadData();
    } catch (err) { alert(err.message); }
  });
};

const updateEmployeeOrganization = async (employeeId, organizationId) => {
  const employee = getEmployeeById(employeeId);
  if (!employee) return;
  try {
    await apiFetch(`/employees/${employeeId}`, { method: 'PUT', body: JSON.stringify({ organization_id: organizationId }) });
    showToast(`${employee.name} moved to ${getOrganizationName(organizationId)}`);
    await loadData();
  } catch (err) { alert(err.message); }
};

const renderCanvasConnections = () => {
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.setAttribute('class', 'canvas-connections');
  overlay.setAttribute('viewBox', `0 0 ${parseInt(canvasContent.style.width || '3600', 10)} ${parseInt(canvasContent.style.height || '2400', 10)}`);
  overlay.setAttribute('preserveAspectRatio', 'none');

  state.assignments.forEach((assignment) => {
    const employeeRect = state.canvasNodeRects.get(`employee-${assignment.employee_id}`);
    const projectRect = state.canvasNodeRects.get(`project-${assignment.project_id}`);
    if (!employeeRect || !projectRect) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const startX = employeeRect.right;
    const startY = employeeRect.top + employeeRect.height / 2;
    const endX = projectRect.left;
    const endY = projectRect.top + projectRect.height / 2;
    const controlOffset = Math.max(80, (endX - startX) * 0.45);
    path.setAttribute('d', `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`);
    path.setAttribute('class', 'canvas-connection-line');
    overlay.appendChild(path);
  });

  if (connectionDraft?.startRect && connectionDraft?.currentPoint) {
    const startX = connectionDraft.startRect.right;
    const startY = connectionDraft.startRect.top + connectionDraft.startRect.height / 2;
    const endX = connectionDraft.currentPoint.x;
    const endY = connectionDraft.currentPoint.y;
    const controlOffset = Math.max(60, Math.abs(endX - startX) * 0.35);
    const draft = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    draft.setAttribute('d', `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`);
    draft.setAttribute('class', 'canvas-connection-line canvas-connection-draft');
    overlay.appendChild(draft);
  }

  canvasContent.appendChild(overlay);
};

const renderCanvas = () => {
  canvasContent.innerHTML = '';
  state.canvasNodeRects = new Map();
  const fragment = document.createDocumentFragment();
  const stageRect = canvasStage.getBoundingClientRect();
  const stageWidth = stageRect.width || window.innerWidth;
  const stageHeight = stageRect.height || window.innerHeight;
  const currentWeek = getCurrentWeekRange();
  const weekStartValue = currentWeek?.weekStartValue ?? toDateValue(Date.now());
  const weekEndValue = currentWeek?.weekEndValue ?? weekStartValue;

  const orgBaseX = 60;
  const orgBaseY = 80;
  const orgWidth = 300;
  const orgGap = 28;
  const employeeRowHeight = 74;
  const projectBaseX = 460;
  const projectBaseY = 80;
  const colWidth = 320;
  const rowHeight = 260;
  const availableWidth = Math.max(stageWidth - (projectBaseX + 240), colWidth);
  const projectCols = Math.max(1, Math.floor(availableWidth / colWidth));

  state.organizations.forEach((org, index) => {
    const orgEmployees = state.employees.filter((employee) => employee.organization_id === org.id).sort((a, b) => a.name.localeCompare(b.name));
    const boxHeight = Math.max(160, 72 + orgEmployees.length * employeeRowHeight);
    const box = document.createElement('div');
    box.className = 'org-box';
    box.style.left = `${orgBaseX}px`;
    box.style.top = `${orgBaseY + index * (boxHeight + orgGap)}px`;
    box.style.width = `${orgWidth}px`;
    box.style.height = `${boxHeight}px`;
    box.dataset.nodeType = 'organization';
    box.dataset.id = org.id;
    box.dataset.dropType = 'organization';
    box.innerHTML = `<div class="org-box-head"><div><h4>${escapeHtml(org.name)}</h4><p class="muted small-text">${escapeHtml(org.description || `${orgEmployees.length} employees`)}</p></div><span class="badge">${orgEmployees.length}</span></div>`;
    fragment.appendChild(box);
    state.canvasNodeRects.set(`organization-${org.id}`, { left: orgBaseX, top: orgBaseY + index * (boxHeight + orgGap), right: orgBaseX + orgWidth, bottom: orgBaseY + index * (boxHeight + orgGap) + boxHeight, width: orgWidth, height: boxHeight });

    orgEmployees.forEach((employee, employeeIndex) => {
      const activeAssignments = state.assignments.filter((asg) => asg.employee_id === employee.id && overlapsRange(toDateValue(asg.start_date), toDateValue(asg.end_date), weekStartValue, weekEndValue));
      const activeAllocation = activeAssignments.reduce((sum, asg) => sum + (asg.allocation || 0), 0);
      const employeeTop = orgBaseY + index * (boxHeight + orgGap) + 62 + employeeIndex * employeeRowHeight;
      const node = document.createElement('div');
      node.className = 'employee-node-canvas';
      node.style.left = `${orgBaseX + 16}px`;
      node.style.top = `${employeeTop}px`;
      node.dataset.nodeType = 'employee';
      node.dataset.id = employee.id;
      const over = activeAllocation > (employee.capacity || 1);
      if (over) node.classList.add('over');
      const percent = Math.round(activeAllocation * 100);
      const cap = Math.round((employee.capacity || 1) * 100);
      node.innerHTML = `
        <div class="employee-node-copy">
          <strong>${escapeHtml(employee.name)}</strong>
          <span>${escapeHtml(employee.role || employee.employee_type || 'Employee')}</span>
          <span>${percent}% / ${cap}% this week</span>
        </div>
        <button type="button" class="employee-connect-handle" data-connect-from="employee" data-id="${employee.id}" aria-label="Create connection from ${escapeHtml(employee.name)}">+</button>`;
      fragment.appendChild(node);
      state.canvasNodeRects.set(`employee-${employee.id}`, { left: orgBaseX + 16, top: employeeTop, right: orgBaseX + 16 + 268, bottom: employeeTop + 58, width: 268, height: 58 });
    });
  });

  state.projects.forEach((project, index) => {
    const col = index % projectCols;
    const row = Math.floor(index / projectCols);
    const projectAssignments = state.assignments.filter((asg) => asg.project_id === project.id);
    const boxLeft = projectBaseX + col * colWidth;
    const boxTop = projectBaseY + row * rowHeight;
    const box = document.createElement('div');
    box.className = 'project-box';
    box.style.left = `${boxLeft}px`;
    box.style.top = `${boxTop}px`;
    box.dataset.nodeType = 'project';
    box.dataset.id = project.id;
    box.dataset.dropType = 'project';
    const activeFte = projectAssignments.reduce((sum, asg) => {
      const startValue = toDateValue(asg.start_date); const endValue = toDateValue(asg.end_date);
      return (!Number.isNaN(startValue) && !Number.isNaN(endValue) && overlapsRange(startValue, endValue, weekStartValue, weekEndValue)) ? sum + (asg.allocation || 0) : sum;
    }, 0);
    const header = document.createElement('div'); header.className = 'project-head';
    const info = document.createElement('div');
    info.innerHTML = `<h4>${escapeHtml(project.name)}</h4><p class="muted small-text">${project.start_date || '—'} → ${project.end_date || '—'}</p><p class="muted small-text">FTE rollup (this week): ${activeFte.toFixed(2)}</p>`;
    const detailsBtn = document.createElement('button'); detailsBtn.type = 'button'; detailsBtn.className = 'project-details'; detailsBtn.textContent = 'Show details'; detailsBtn.addEventListener('click', (event) => { event.preventDefault(); openProjectTimeline(project.id); });
    header.append(info, detailsBtn); box.appendChild(header);
    const assignmentGroup = document.createElement('div'); assignmentGroup.className = 'assignment-nodes';
    projectAssignments.forEach((asg) => {
      const employee = getEmployeeById(asg.employee_id);
      const chip = document.createElement('div'); chip.className = 'assignment-node'; chip.dataset.nodeType = 'assignment'; chip.dataset.id = asg.id;
      const percent = Math.round(asg.allocation * 100); const capacity = Math.round((employee?.capacity || 1) * 100); if (percent > capacity) chip.classList.add('over');
      const employeeName = employee?.name || asg.employee_name || 'Employee';
      chip.textContent = allocationUnits === 'percent-hours' ? `${employeeName} · ${percent}% (${Math.round((employee?.capacity || 1) * HOURS_PER_FTE * asg.allocation)}h)` : `${employeeName} · ${percent}%`;
      assignmentGroup.appendChild(chip);
    });
    if (!projectAssignments.length) assignmentGroup.innerHTML = '<p class="muted small-text">No assignments yet</p>';
    box.appendChild(assignmentGroup); fragment.appendChild(box);
    state.canvasNodeRects.set(`project-${project.id}`, { left: boxLeft, top: boxTop, right: boxLeft + 280, bottom: boxTop + 180, width: 280, height: 180 });
  });

  const orgHeights = state.organizations.map((org) => Math.max(160, 72 + state.employees.filter((employee) => employee.organization_id === org.id).length * employeeRowHeight));
  const orgColumnHeight = orgHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, state.organizations.length - 1) * orgGap;
  const totalProjects = state.projects.length || 1;
  const colsUsed = Math.min(projectCols || 1, totalProjects);
  const rowsUsed = Math.ceil(totalProjects / (projectCols || 1));
  const contentWidth = projectBaseX + colsUsed * colWidth + 220;
  const contentHeight = Math.max(orgBaseY + orgColumnHeight + 160, projectBaseY + rowsUsed * rowHeight + 200);
  canvasContent.style.width = `${Math.max(contentWidth, stageWidth)}px`;
  canvasContent.style.height = `${Math.max(contentHeight, stageHeight)}px`;
  canvasContent.appendChild(fragment);
  renderCanvasConnections();

  if (!panInitialized) {
    const extraX = Math.max((stageWidth - contentWidth) / 2, 0);
    const extraY = Math.max((stageHeight - contentHeight) / 2, 0);
    pan = { x: extraX, y: extraY }; applyTransform(); panInitialized = true;
  }
};

const loadData = async () => {
  try {
    const [organizations, employees, projects, assignments] = await Promise.all([apiFetch('/organizations'), apiFetch('/employees'), apiFetch('/projects'), apiFetch('/assignments')]);
    state.organizations = organizations; state.employees = employees; state.projects = projects; state.assignments = assignments;
    const managerIds = new Set(state.employees.filter((employee) => employee.direct_report_count > 0).map((employee) => employee.id));
    state.expandedManagers = new Set([...state.expandedManagers].filter((id) => managerIds.has(id)));
    renderResources(); renderCanvas();
  } catch (err) { alert(err.message); }
};

const openAssignmentRemovalModal = (assignmentId = null) => {
  if (!state.assignments.length) return alert('No assignments available to remove.');
  let currentAssignmentId = assignmentId || null;
  const options = ['<option value="">Select assignment...</option>'].concat(state.assignments.map((asg) => {
    const employee = getEmployeeById(asg.employee_id); const project = getProjectById(asg.project_id); const label = `${employee?.name || asg.employee_name || 'Employee'} → ${project?.name || asg.project_name || 'Project'}`;
    return `<option value="${asg.id}" ${asg.id === currentAssignmentId ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  })).join('');
  modalBody.innerHTML = `<h3>Remove assignment</h3><label class="muted small-text">Assignment<select id="assignment-picker">${options}</select></label><p class="muted small-text">Removing an assignment immediately frees up the allocation.</p><div class="modal-actions"><button type="button" id="assignment-remove-confirm" class="danger">Remove assignment</button></div>`;
  modal.classList.remove('hidden');
  const picker = document.querySelector('#assignment-picker'); const confirmBtn = document.querySelector('#assignment-remove-confirm');
  picker.addEventListener('change', (event) => { currentAssignmentId = Number(event.target.value) || null; });
  confirmBtn.addEventListener('click', async () => { if (!currentAssignmentId) return alert('Select an assignment to remove.'); await deleteAssignment(currentAssignmentId); closeModal(); });
};

const deleteAssignment = async (assignmentId) => {
  const assignment = state.assignments.find((asg) => asg.id === Number(assignmentId)); if (!assignment) return;
  const employee = getEmployeeById(assignment.employee_id); const project = getProjectById(assignment.project_id);
  if (!confirm(`Remove assignment ${employee?.name || 'Employee'} → ${project?.name || 'Project'}?`)) return;
  try { await apiFetch(`/assignments/${assignmentId}`, { method: 'DELETE' }); showToast('Assignment removed'); await loadData(); } catch (err) { alert(err.message); }
};

const handleContextMenu = (event) => {
  event.preventDefault(); hideContextMenu();
  const node = event.target.closest('[data-node-type]');
  contextTarget = node ? { type: node.dataset.nodeType, id: node.dataset.id } : { type: 'canvas', id: null };
  contextMenu.style.left = `${event.clientX}px`; contextMenu.style.top = `${event.clientY}px`; contextMenu.classList.remove('hidden');
};

const handleMenuClick = (event) => {
  const action = event.target.dataset.action; if (!action) return; hideContextMenu();
  if (action === 'create-org') openOrganizationModal();
  else if (action === 'create-project') openProjectModal();
  else if (action === 'add-assignment') openAssignmentModal();
  else if (action === 'edit-employee') openEmployeeModal(contextTarget.type === 'employee' ? Number(contextTarget.id) : null);
  else if (action === 'edit-project') openProjectEditModal(contextTarget.type === 'project' ? Number(contextTarget.id) : null);
  else if (action === 'remove-assignment') openAssignmentRemovalModal(contextTarget.type === 'assignment' ? Number(contextTarget.id) : null);
};

const handlePointerDown = (event) => {
  if (event.button !== 0) return;
  const connectHandle = event.target.closest('[data-connect-from="employee"]');
  if (connectHandle) {
    event.preventDefault(); event.stopPropagation();
    const employeeId = Number(connectHandle.dataset.id); const startRect = state.canvasNodeRects.get(`employee-${employeeId}`);
    if (!startRect) return;
    connectionDraft = { employeeId, startRect, currentPoint: { x: startRect.right + 40, y: startRect.top + startRect.height / 2 } };
    renderCanvas(); return;
  }
  if (event.target.closest('button, input, select, textarea')) return;
  isPanning = true; pointerId = event.pointerId; panStart = { x: event.clientX, y: event.clientY }; canvasContent.classList.add('dragging'); canvasStage.setPointerCapture(pointerId);
};

const handlePointerMove = (event) => {
  if (connectionDraft) {
    const stageRect = canvasStage.getBoundingClientRect();
    connectionDraft.currentPoint = { x: event.clientX - stageRect.left - pan.x, y: event.clientY - stageRect.top - pan.y };
    renderCanvas(); return;
  }
  if (!isPanning || event.pointerId !== pointerId) return;
  const dx = event.clientX - panStart.x; const dy = event.clientY - panStart.y; pan.x += dx; pan.y += dy; panStart = { x: event.clientX, y: event.clientY }; applyTransform();
};

const finishConnectionDraft = (event) => {
  if (!connectionDraft) return;
  const project = event.target.closest('.project-box');
  const employeeId = connectionDraft.employeeId;
  connectionDraft = null;
  renderCanvas();
  if (project) openAssignmentModal({ employeeId, projectId: Number(project.dataset.id) });
};

const handlePointerUp = (event) => {
  if (connectionDraft) return finishConnectionDraft(event);
  if (!isPanning || event.pointerId !== pointerId) return;
  isPanning = false; canvasContent.classList.remove('dragging'); canvasStage.releasePointerCapture(pointerId);
};

const handleDragStart = (event) => {
  const node = event.target.closest('[data-drag-type="employee"]');
  if (!node) return;
  if (event.target.closest('[data-manager-toggle]')) { event.preventDefault(); return; }
  dragEmployeeId = Number(node.dataset.id); event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('text/plain', String(dragEmployeeId));
};

const clearDropHighlights = () => canvasStage.querySelectorAll('.project-box-droppable, .org-box-droppable').forEach((box) => box.classList.remove('project-box-droppable', 'org-box-droppable'));
const handleDragEnd = () => { dragEmployeeId = null; clearDropHighlights(); };
const handleDragOver = (event) => { if (!dragEmployeeId) return; const dropTarget = event.target.closest('[data-drop-type]'); if (!dropTarget) return; event.preventDefault(); };
const handleDragEnter = (event) => { if (!dragEmployeeId) return; const dropTarget = event.target.closest('[data-drop-type]'); if (!dropTarget) return; event.preventDefault(); dropTarget.classList.add(dropTarget.dataset.dropType === 'project' ? 'project-box-droppable' : 'org-box-droppable'); };
const handleDragLeave = (event) => { if (!dragEmployeeId) return; const dropTarget = event.target.closest('[data-drop-type]'); if (!dropTarget) return; if (dropTarget.contains(event.relatedTarget)) return; dropTarget.classList.remove('project-box-droppable', 'org-box-droppable'); };
const handleDrop = async (event) => {
  if (!dragEmployeeId) return;
  const dropTarget = event.target.closest('[data-drop-type]'); if (!dropTarget) return;
  event.preventDefault(); const employeeId = dragEmployeeId; dragEmployeeId = null; clearDropHighlights();
  if (dropTarget.dataset.dropType === 'project') openAssignmentModal({ employeeId, projectId: Number(dropTarget.dataset.id) });
  if (dropTarget.dataset.dropType === 'organization') await updateEmployeeOrganization(employeeId, Number(dropTarget.dataset.id));
};

const handleResourceClick = (event) => {
  const toggle = event.target.closest('[data-manager-toggle]'); if (!toggle) return; const managerId = Number(toggle.dataset.managerToggle); if (!managerId) return;
  if (state.expandedManagers.has(managerId)) state.expandedManagers.delete(managerId); else state.expandedManagers.add(managerId); renderResources();
};

if (typeof window !== 'undefined') window.__canvasTest = { openAssignmentModal, openEmployeeModal, openProjectEditModal, openAssignmentRemovalModal, openOrganizationModal, getState: () => state };

const init = () => {
  applyTransform(); loadData();
  canvasStage.addEventListener('pointerdown', handlePointerDown);
  canvasStage.addEventListener('pointermove', handlePointerMove);
  canvasStage.addEventListener('pointerup', handlePointerUp);
  canvasStage.addEventListener('pointerleave', handlePointerUp);
  canvasStage.addEventListener('contextmenu', handleContextMenu);
  canvasStage.addEventListener('dragstart', handleDragStart);
  canvasStage.addEventListener('dragend', handleDragEnd);
  canvasStage.addEventListener('dragover', handleDragOver);
  document.addEventListener('dragstart', handleDragStart);
  document.addEventListener('dragend', handleDragEnd);
  canvasStage.addEventListener('dragenter', handleDragEnter);
  canvasStage.addEventListener('dragleave', handleDragLeave);
  canvasStage.addEventListener('drop', handleDrop);
  resourceList?.addEventListener('click', handleResourceClick);
  allocationUnitsSelect?.addEventListener('change', (event) => { allocationUnits = event.target.value; renderCanvas(); });
  contextMenu.addEventListener('click', handleMenuClick); document.addEventListener('click', hideContextMenu); contextMenu.addEventListener('click', (event) => event.stopPropagation());
  modalClose.addEventListener('click', () => closeModal()); modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') { hideContextMenu(); closeModal(); if (connectionDraft) { connectionDraft = null; renderCanvas(); } } });
  window.addEventListener('resize', () => renderCanvas());
  canvasOrgFilter?.addEventListener('change', () => renderResources());
  resetViewBtn.addEventListener('click', () => { pan = { x: 0, y: 0 }; panInitialized = false; renderCanvas(); });
};

init();
