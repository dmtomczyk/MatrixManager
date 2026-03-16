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
  employeeLayout: new Map(),
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

const getLeaderEmployees = (currentEmployeeId = null) =>
  state.employees.filter((emp) => emp.employee_type === 'L' && emp.id !== currentEmployeeId).sort((a, b) => a.name.localeCompare(b.name));

const toDateValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return NaN;
  date.setHours(0, 0, 0, 0);
  return date.valueOf();
};

const overlapsRange = (startValue, endValue, rangeStart, rangeEnd) => startValue <= rangeEnd && endValue >= rangeStart;
const getCurrentWeekRange = () => {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  const weekStartValue = date.valueOf();
  const weekEnd = new Date(date);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStartValue, weekEndValue: weekEnd.valueOf() };
};

const getOrganizationName = (organizationId) => state.organizations.find((org) => org.id === organizationId)?.name || `Org ${organizationId}`;
const getEmployeeById = (employeeId) => state.employees.find((employee) => employee.id === employeeId) || null;
const getProjectById = (projectId) => state.projects.find((project) => project.id === projectId) || null;
const getEmployeeCurrentAllocation = (employeeId) => {
  const { weekStartValue, weekEndValue } = getCurrentWeekRange();
  return state.assignments.reduce((sum, asg) => {
    if (asg.employee_id !== employeeId) return sum;
    const startValue = toDateValue(asg.start_date);
    const endValue = toDateValue(asg.end_date);
    if (Number.isNaN(startValue) || Number.isNaN(endValue)) return sum;
    return overlapsRange(startValue, endValue, weekStartValue, weekEndValue) ? sum + (asg.allocation || 0) : sum;
  }, 0);
};

const applyTransform = () => { canvasContent.style.transform = `translate(${pan.x}px, ${pan.y}px)`; };
const hideContextMenu = () => contextMenu?.classList.add('hidden');
const clearConnectionHover = () => canvasStage.querySelectorAll('.canvas-target-hover').forEach((el) => el.classList.remove('canvas-target-hover'));
const clearDropHighlights = () => canvasStage.querySelectorAll('.project-box-droppable, .org-box-droppable').forEach((box) => box.classList.remove('project-box-droppable', 'org-box-droppable'));

const updateConnectionHint = (text = '') => {
  let hint = document.querySelector('.canvas-connection-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'canvas-connection-hint hidden';
    canvasStage.appendChild(hint);
  }
  hint.textContent = text;
  hint.classList.toggle('hidden', !text);
};

const stagePointFromPointer = (event) => {
  const stageRect = canvasStage.getBoundingClientRect();
  return { x: event.clientX - stageRect.left - pan.x, y: event.clientY - stageRect.top - pan.y };
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

const closeModal = () => {
  modal?.classList.add('hidden');
  modalBody.innerHTML = '';
  modal?.querySelector('.modal-content')?.classList.remove('modal-wide');
  if (projectChart) {
    projectChart.destroy();
    projectChart = null;
  }
};

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
    try {
      await apiFetch('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: String(formData.get('name') || '').trim(),
          description: String(formData.get('description') || '').trim() || null,
        }),
      });
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
    const payload = {
      name: String(formData.get('name') || '').trim(),
      description: String(formData.get('description') || '').trim() || null,
      start_date: formData.get('start_date') || null,
      end_date: formData.get('end_date') || null,
    };
    try {
      if (editing) await apiFetch(`/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await apiFetch('/projects', { method: 'POST', body: JSON.stringify(payload) });
      showToast(editing ? 'Project updated' : 'Project created');
      closeModal();
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  });
};

const openProjectEditModal = (projectId = null) => {
  if (!state.projects.length) return alert('No projects available yet.');
  let currentProjectId = projectId || null;
  const pickerOptions = ['<option value="">Select project...</option>']
    .concat(state.projects.map((proj) => `<option value="${proj.id}" ${proj.id === currentProjectId ? 'selected' : ''}>${escapeHtml(proj.name)}</option>`))
    .join('');
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
    if (!project) {
      form.reset();
      currentProjectId = null;
      return;
    }
    currentProjectId = id;
    form.elements.name.value = project.name || '';
    form.elements.description.value = project.description || '';
    form.elements.start_date.value = project.start_date || '';
    form.elements.end_date.value = project.end_date || '';
  };
  picker.addEventListener('change', (event) => populateFields(Number(event.target.value) || null));
  if (currentProjectId) populateFields(currentProjectId);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentProjectId) return alert('Select a project to edit.');
    const formData = new FormData(form);
    try {
      await apiFetch(`/projects/${currentProjectId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: String(formData.get('name') || '').trim(),
          description: String(formData.get('description') || '').trim() || null,
          start_date: formData.get('start_date') || null,
          end_date: formData.get('end_date') || null,
        }),
      });
      showToast('Project updated');
      closeModal();
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  });
};

const openEmployeeModal = (employeeId = null) => {
  if (!state.employees.length) return alert('No employees available yet.');
  let currentEmployeeId = employeeId || null;
  const pickerOptions = ['<option value="">Select employee...</option>']
    .concat(state.employees.map((emp) => `<option value="${emp.id}" ${emp.id === currentEmployeeId ? 'selected' : ''}>${escapeHtml(emp.name)}</option>`))
    .join('');
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
    if (!employee) {
      form.reset();
      currentEmployeeId = null;
      return;
    }
    currentEmployeeId = id;
    form.elements.name.value = employee.name || '';
    form.elements.role.value = employee.role || '';
    form.elements.employee_type.value = employee.employee_type || 'IC';
    form.elements.location.value = employee.location || '';
    form.elements.capacity.value = employee.capacity || 1;
    form.elements.manager_id.value = employee.manager_id || '';
  };
  picker.addEventListener('change', (event) => populateFields(Number(event.target.value) || null));
  if (currentEmployeeId) populateFields(currentEmployeeId);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentEmployeeId) return alert('Select an employee to edit.');
    const formData = new FormData(form);
    const managerId = formData.get('manager_id');
    try {
      await apiFetch(`/employees/${currentEmployeeId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: String(formData.get('name') || '').trim(),
          role: String(formData.get('role') || '').trim() || null,
          employee_type: formData.get('employee_type') || 'IC',
          location: String(formData.get('location') || '').trim() || null,
          capacity: Number(formData.get('capacity')) || 1,
          manager_id: managerId ? Number(managerId) : null,
        }),
      });
      showToast('Employee updated');
      closeModal();
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  });
};

const openProjectTimeline = (projectId) => {
  const project = state.projects.find((proj) => proj.id === projectId);
  if (!project) return alert('Project not found');
  const projectAssignments = state.assignments.filter((asg) => asg.project_id === projectId);
  if (!projectAssignments.length) return alert('No assignments for this project yet.');
  const ranges = [];
  let minStart = Infinity;
  let maxEnd = -Infinity;
  projectAssignments.forEach((asg) => {
    const startValue = toDateValue(asg.start_date);
    const endValue = toDateValue(asg.end_date);
    if (Number.isNaN(startValue) || Number.isNaN(endValue)) return;
    ranges.push({ startValue, endValue, allocation: asg.allocation || 0 });
    minStart = Math.min(minStart, startValue);
    maxEnd = Math.max(maxEnd, endValue);
  });
  if (!ranges.length) return alert('No schedulable assignments for this project yet.');
  const labels = [];
  const values = [];
  let cursorValue = minStart;
  while (cursorValue <= maxEnd && labels.length < 520) {
    const rangeStart = cursorValue;
    const rangeEnd = Math.min(cursorValue + WEEK_MS - DAY_MS, maxEnd);
    const fte = ranges.reduce((sum, item) => overlapsRange(item.startValue, item.endValue, rangeStart, rangeEnd) ? sum + item.allocation : sum, 0);
    labels.push(new Date(rangeStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    values.push(Number(fte.toFixed(2)));
    cursorValue += WEEK_MS;
  }
  modalBody.innerHTML = `<h3>${escapeHtml(project.name)} · weekly FTE</h3><div class="chart-panel"><canvas id="project-chart"></canvas></div>`;
  modal.querySelector('.modal-content')?.classList.add('modal-wide');
  modal.classList.remove('hidden');
  const ctx = document.getElementById('project-chart');
  if (!ctx) return;
  projectChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'FTE', data: values, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.15)', borderWidth: 2, tension: 0.25, fill: true, pointRadius: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
};

const openAssignmentModal = (defaults = {}) => {
  if (!state.employees.length || !state.projects.length) return alert('Add employees and projects before creating assignments.');
  modalBody.innerHTML = `
    <h3>Add assignment</h3>
    <form id="assignment-modal-form">
      <label>Employee<select name="employee_id" required>${buildOptions(state.employees, defaults.employeeId ?? null)}</select></label>
      <label>Project<select name="project_id" required>${buildOptions(state.projects, defaults.projectId ?? null)}</select></label>
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
    try {
      await apiFetch('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(formData.get('employee_id')),
          project_id: Number(formData.get('project_id')),
          start_date: formData.get('start_date'),
          end_date: formData.get('end_date'),
          allocation: (Number(formData.get('allocation')) || 0) / 100,
          notes: String(formData.get('notes') || '').trim() || null,
        }),
      });
      showToast('Assignment added');
      closeModal();
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  });
};

const updateEmployeeOrganization = async (employeeId, organizationId) => {
  const employee = getEmployeeById(employeeId);
  if (!employee) return;
  try {
    await apiFetch(`/employees/${employeeId}`, { method: 'PUT', body: JSON.stringify({ organization_id: organizationId }) });
    showToast(`${employee.name} moved to ${getOrganizationName(organizationId)}`);
    await loadData();
  } catch (err) {
    alert(err.message);
  }
};

const updateEmployeeManager = async (employeeId, managerId) => {
  const employee = getEmployeeById(employeeId);
  const manager = getEmployeeById(managerId);
  if (!employee || !manager) return;
  if (employeeId === managerId) return alert('An employee cannot manage themselves.');
  try {
    await apiFetch(`/employees/${employeeId}`, { method: 'PUT', body: JSON.stringify({ manager_id: managerId }) });
    showToast(`${employee.name} now reports to ${manager.name}`);
    await loadData();
  } catch (err) {
    alert(err.message);
  }
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
  const sortList = (list) => list.sort((a, b) => a.name.localeCompare(b.name));
  sortList(roots);
  directReports.forEach(sortList);
  return { roots, directReports };
};

const createResourceItem = (employee, options = {}) => {
  const { level = 0, hasChildren = false, expanded = false } = options;
  const item = document.createElement('div');
  item.className = `resource-item${level > 0 ? ' resource-item-nested' : ''}${hasChildren ? ' resource-item-manager' : ''}`;
  item.style.marginLeft = `${level * 22}px`;
  item.setAttribute('draggable', 'true');
  item.dataset.dragType = 'employee';
  item.dataset.id = employee.id;
  item.innerHTML = `
    <div class="resource-row">
      <div class="resource-left">
        ${hasChildren ? `<button type="button" class="hierarchy-toggle" data-manager-toggle="${employee.id}" aria-expanded="${expanded ? 'true' : 'false'}">${expanded ? '▾' : '▸'}</button>` : '<span class="hierarchy-spacer">•</span>'}
        <div class="resource-details">
          <strong>${escapeHtml(employee.name)}</strong>
          <span class="resource-meta">${escapeHtml([employee.role, employee.employee_type, employee.organization_name].filter(Boolean).join(' • '))}</span>
        </div>
      </div>
      <span class="resource-meta">${Math.round((employee.capacity || 1) * 100)}%</span>
    </div>`;
  return item;
};

const renderResources = () => {
  let selectedOrg = canvasOrgFilter?.value || '';
  const orgMap = new Map();
  state.employees.forEach((employee) => {
    if (employee.organization_id != null) orgMap.set(String(employee.organization_id), employee.organization_name || `Org ${employee.organization_id}`);
  });
  if (canvasOrgFilter) {
    const previous = canvasOrgFilter.value;
    canvasOrgFilter.innerHTML = ['<option value="">All</option>']
      .concat(Array.from(orgMap.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`))
      .join('');
    canvasOrgFilter.value = previous && orgMap.has(previous) ? previous : '';
    selectedOrg = canvasOrgFilter.value;
  }
  const filtered = state.employees.filter((employee) => !selectedOrg || String(employee.organization_id) === selectedOrg);
  resourceList.innerHTML = '';
  if (!filtered.length) {
    resourceList.innerHTML = '<div class="muted">No employees match this filter.</div>';
    return;
  }
  const { roots, directReports } = buildHierarchy(filtered);
  const appendTree = (employee, level = 0) => {
    const children = directReports.get(employee.id) || [];
    const hasChildren = children.length > 0;
    const expanded = hasChildren && state.expandedManagers.has(employee.id);
    resourceList.appendChild(createResourceItem(employee, { level, hasChildren, expanded }));
    if (expanded) children.forEach((report) => appendTree(report, level + 1));
  };
  roots.forEach((employee) => appendTree(employee));
};

const buildEmployeeTreeLayout = (employees) => {
  const sorted = [...employees].sort((a, b) => a.name.localeCompare(b.name));
  const byId = new Map(sorted.map((employee) => [employee.id, employee]));
  const children = new Map(sorted.map((employee) => [employee.id, []]));
  const roots = [];
  sorted.forEach((employee) => {
    if (employee.manager_id && byId.has(employee.manager_id)) children.get(employee.manager_id).push(employee);
    else roots.push(employee);
  });
  children.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));

  let cursorY = 0;
  const positions = new Map();
  const NODE_GAP = 24;
  const LANE_PAD_TOP = 78;
  const layoutNode = (employee, depth) => {
    const reports = children.get(employee.id) || [];
    const startY = cursorY;
    reports.forEach((report) => layoutNode(report, depth + 1));
    let y = cursorY;
    if (reports.length) {
      const childYs = reports.map((report) => positions.get(report.id).y);
      y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
      cursorY = Math.max(cursorY, Math.max(...childYs) + NODE_GAP);
    } else {
      cursorY += NODE_GAP;
    }
    positions.set(employee.id, { depth, y });
    if (!reports.length) return;
    const subtreeBottom = Math.max(...reports.map((report) => positions.get(report.id).y));
    cursorY = Math.max(cursorY, subtreeBottom + NODE_GAP);
    if (cursorY === startY) cursorY += NODE_GAP;
  };

  roots.forEach((root) => {
    layoutNode(root, 0);
    cursorY += 18;
  });

  let minY = Infinity;
  let maxY = -Infinity;
  positions.forEach((pos) => {
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  });
  if (!Number.isFinite(minY)) minY = 0;
  if (!Number.isFinite(maxY)) maxY = 0;
  positions.forEach((pos, id) => {
    positions.set(id, { depth: pos.depth, y: LANE_PAD_TOP + (pos.y - minY) * 92 });
  });
  return { positions, height: Math.max(220, LANE_PAD_TOP + (maxY - minY) * 92 + 90), children };
};

const createSvgPath = (d, className) => {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('class', className);
  return path;
};

const buildCurve = (startX, startY, endX, endY) => {
  const delta = Math.max(70, Math.abs(endX - startX) * 0.42);
  return `M ${startX} ${startY} C ${startX + delta} ${startY}, ${endX - delta} ${endY}, ${endX} ${endY}`;
};

const renderCanvasConnections = () => {
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.setAttribute('class', 'canvas-connections');
  overlay.setAttribute('viewBox', `0 0 ${parseInt(canvasContent.style.width || '3600', 10)} ${parseInt(canvasContent.style.height || '2400', 10)}`);
  overlay.setAttribute('preserveAspectRatio', 'none');

  state.employees.forEach((employee) => {
    if (!employee.manager_id) return;
    const employeeRect = state.canvasNodeRects.get(`employee-${employee.id}`);
    const managerRect = state.canvasNodeRects.get(`employee-${employee.manager_id}`);
    if (!employeeRect || !managerRect) return;
    overlay.appendChild(createSvgPath(
      buildCurve(managerRect.left + managerRect.width * 0.52, managerRect.bottom - 8, employeeRect.left + employeeRect.width * 0.48, employeeRect.top + 8),
      'canvas-connection-line canvas-connection-line-hierarchy'
    ));
  });

  state.assignments.forEach((assignment) => {
    const employeeRect = state.canvasNodeRects.get(`employee-${assignment.employee_id}`);
    const projectRect = state.canvasNodeRects.get(`project-${assignment.project_id}`);
    if (!employeeRect || !projectRect) return;
    overlay.appendChild(createSvgPath(
      buildCurve(employeeRect.right, employeeRect.top + employeeRect.height / 2, projectRect.left, projectRect.top + projectRect.height / 2),
      'canvas-connection-line canvas-connection-line-assignment'
    ));
  });

  if (connectionDraft?.startRect && connectionDraft?.currentPoint) {
    overlay.appendChild(createSvgPath(
      buildCurve(connectionDraft.startRect.right, connectionDraft.startRect.top + connectionDraft.startRect.height / 2, connectionDraft.currentPoint.x, connectionDraft.currentPoint.y),
      `canvas-connection-line canvas-connection-draft${connectionDraft.targetType === 'employee' ? ' canvas-connection-draft-manager' : connectionDraft.targetType === 'project' ? ' canvas-connection-draft-assignment' : ''}`
    ));
  }

  canvasContent.appendChild(overlay);
};

const renderCanvas = () => {
  canvasContent.innerHTML = '';
  state.canvasNodeRects = new Map();
  state.employeeLayout = new Map();

  const stageRect = canvasStage.getBoundingClientRect();
  const stageWidth = stageRect.width || window.innerWidth;
  const stageHeight = stageRect.height || window.innerHeight;
  const currentWeek = getCurrentWeekRange();
  const orgBaseX = 64;
  const orgBaseY = 72;
  const orgWidth = 420;
  const orgGap = 28;
  const projectBaseX = 560;
  const projectBaseY = 72;
  const projectWidth = 320;
  const projectHeight = 210;
  const projectGapX = 34;
  const projectGapY = 34;
  const employeeNodeWidth = 184;
  const employeeNodeHeight = 72;
  const laneDepthGap = 196;

  let nextLaneY = orgBaseY;
  state.organizations.forEach((org) => {
    const orgEmployees = state.employees.filter((employee) => employee.organization_id === org.id);
    const layout = buildEmployeeTreeLayout(orgEmployees);
    const lane = document.createElement('section');
    lane.className = 'org-lane';
    lane.style.left = `${orgBaseX}px`;
    lane.style.top = `${nextLaneY}px`;
    lane.style.width = `${orgWidth}px`;
    lane.style.height = `${layout.height}px`;
    lane.dataset.nodeType = 'organization';
    lane.dataset.id = org.id;
    lane.dataset.dropType = 'organization';
    lane.innerHTML = `
      <div class="org-lane-head">
        <div>
          <h4>${escapeHtml(org.name)}</h4>
          <p class="muted small-text">${escapeHtml(org.description || 'Organization lane')}</p>
        </div>
        <span class="badge">${orgEmployees.length}</span>
      </div>`;
    canvasContent.appendChild(lane);
    state.canvasNodeRects.set(`organization-${org.id}`, { left: orgBaseX, top: nextLaneY, right: orgBaseX + orgWidth, bottom: nextLaneY + layout.height, width: orgWidth, height: layout.height });

    orgEmployees.forEach((employee) => {
      const pos = layout.positions.get(employee.id) || { depth: 0, y: 90 };
      const left = orgBaseX + 18 + pos.depth * laneDepthGap;
      const top = nextLaneY + pos.y;
      const allocation = getEmployeeCurrentAllocation(employee.id);
      const percent = Math.round(allocation * 100);
      const cap = Math.round((employee.capacity || 1) * 100);
      const node = document.createElement('article');
      node.className = `employee-node-canvas${allocation > (employee.capacity || 1) ? ' over' : ''}`;
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
      node.style.width = `${employeeNodeWidth}px`;
      node.style.height = `${employeeNodeHeight}px`;
      node.dataset.nodeType = 'employee';
      node.dataset.id = employee.id;
      node.innerHTML = `
        <div class="employee-node-copy">
          <strong>${escapeHtml(employee.name)}</strong>
          <span>${escapeHtml(employee.role || employee.employee_type || 'Employee')}</span>
          <span>${percent}% allocated · ${cap}% cap</span>
        </div>
        <button type="button" class="employee-connect-handle" data-connect-from="employee" data-id="${employee.id}" aria-label="Create connection from ${escapeHtml(employee.name)}">↗</button>`;
      canvasContent.appendChild(node);
      state.canvasNodeRects.set(`employee-${employee.id}`, { left, top, right: left + employeeNodeWidth, bottom: top + employeeNodeHeight, width: employeeNodeWidth, height: employeeNodeHeight });
      state.employeeLayout.set(employee.id, { depth: pos.depth, y: top, orgId: org.id });
    });

    nextLaneY += layout.height + orgGap;
  });

  const availableWidth = Math.max(stageWidth - (projectBaseX + projectWidth + 120), projectWidth);
  const projectCols = Math.max(1, Math.floor(availableWidth / (projectWidth + projectGapX)) + 1);
  state.projects.forEach((project, index) => {
    const col = index % projectCols;
    const row = Math.floor(index / projectCols);
    const left = projectBaseX + col * (projectWidth + projectGapX);
    const top = projectBaseY + row * (projectHeight + projectGapY);
    const projectAssignments = state.assignments.filter((asg) => asg.project_id === project.id);
    const activeFte = projectAssignments.reduce((sum, asg) => {
      const startValue = toDateValue(asg.start_date);
      const endValue = toDateValue(asg.end_date);
      if (Number.isNaN(startValue) || Number.isNaN(endValue)) return sum;
      return overlapsRange(startValue, endValue, currentWeek.weekStartValue, currentWeek.weekEndValue) ? sum + (asg.allocation || 0) : sum;
    }, 0);
    const box = document.createElement('article');
    box.className = 'project-box';
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${projectWidth}px`;
    box.style.minHeight = `${projectHeight}px`;
    box.dataset.nodeType = 'project';
    box.dataset.id = project.id;
    box.dataset.dropType = 'project';
    box.innerHTML = `
      <div class="project-head">
        <div>
          <h4>${escapeHtml(project.name)}</h4>
          <p class="muted small-text">${project.start_date || '—'} → ${project.end_date || '—'}</p>
          <p class="muted small-text">${activeFte.toFixed(2)} FTE active this week</p>
        </div>
        <button type="button" class="project-details">Show details</button>
      </div>
      <div class="assignment-nodes ${projectAssignments.length ? '' : 'assignment-nodes-empty'}"></div>`;
    const detailsBtn = box.querySelector('.project-details');
    detailsBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openProjectTimeline(project.id);
    });
    const assignmentGroup = box.querySelector('.assignment-nodes');
    if (!projectAssignments.length) {
      assignmentGroup.innerHTML = '<p class="muted small-text">Drop or connect an employee here to create an assignment.</p>';
    } else {
      projectAssignments.forEach((asg) => {
        const employee = getEmployeeById(asg.employee_id);
        const percent = Math.round(asg.allocation * 100);
        const hours = Math.round((employee?.capacity || 1) * HOURS_PER_FTE * asg.allocation);
        const chip = document.createElement('div');
        chip.className = `assignment-node${percent > Math.round((employee?.capacity || 1) * 100) ? ' over' : ''}`;
        chip.dataset.nodeType = 'assignment';
        chip.dataset.id = asg.id;
        chip.textContent = allocationUnits === 'percent-hours'
          ? `${employee?.name || 'Employee'} · ${percent}% (${hours}h)`
          : `${employee?.name || 'Employee'} · ${percent}%`;
        assignmentGroup.appendChild(chip);
      });
    }
    canvasContent.appendChild(box);
    state.canvasNodeRects.set(`project-${project.id}`, { left, top, right: left + projectWidth, bottom: top + projectHeight, width: projectWidth, height: projectHeight });
  });

  const projectRows = Math.ceil((state.projects.length || 1) / Math.max(1, Math.floor((Math.max(stageWidth - (projectBaseX + projectWidth + 120), projectWidth) / (projectWidth + projectGapX)) + 1)));
  const contentWidth = projectBaseX + Math.max(1, Math.min(state.projects.length || 1, Math.floor((Math.max(stageWidth - (projectBaseX + projectWidth + 120), projectWidth) / (projectWidth + projectGapX)) + 1))) * (projectWidth + projectGapX) + 120;
  const contentHeight = Math.max(nextLaneY + 80, projectBaseY + projectRows * (projectHeight + projectGapY) + 120);
  canvasContent.style.width = `${Math.max(contentWidth, stageWidth)}px`;
  canvasContent.style.height = `${Math.max(contentHeight, stageHeight)}px`;
  renderCanvasConnections();

  if (!panInitialized) {
    pan = { x: Math.max((stageWidth - contentWidth) / 2, 0), y: Math.max((stageHeight - contentHeight) / 2, 0) };
    applyTransform();
    panInitialized = true;
  }
};

const getConnectionTargetAtPointer = (event) => {
  const node = event.target.closest('.project-box, .employee-node-canvas');
  if (!node || !connectionDraft) return null;
  const id = Number(node.dataset.id);
  if (node.classList.contains('project-box')) {
    return { type: 'project', id, element: node, label: `Create assignment on ${getProjectById(id)?.name || 'project'}` };
  }
  if (node.classList.contains('employee-node-canvas') && id !== connectionDraft.employeeId) {
    return { type: 'employee', id, element: node, label: `Set ${getEmployeeById(id)?.name || 'employee'} as manager` };
  }
  return null;
};

const loadData = async () => {
  try {
    const [organizations, employees, projects, assignments] = await Promise.all([
      apiFetch('/organizations'),
      apiFetch('/employees'),
      apiFetch('/projects'),
      apiFetch('/assignments'),
    ]);
    state.organizations = organizations;
    state.employees = employees;
    state.projects = projects;
    state.assignments = assignments;
    const managerIds = new Set(state.employees.filter((employee) => employee.direct_report_count > 0).map((employee) => employee.id));
    state.expandedManagers = new Set([...state.expandedManagers].filter((id) => managerIds.has(id)));
    renderResources();
    renderCanvas();
  } catch (err) {
    alert(err.message);
  }
};

const openAssignmentRemovalModal = (assignmentId = null) => {
  if (!state.assignments.length) return alert('No assignments available to remove.');
  let currentAssignmentId = assignmentId || null;
  const options = ['<option value="">Select assignment...</option>']
    .concat(state.assignments.map((asg) => {
      const employee = getEmployeeById(asg.employee_id);
      const project = getProjectById(asg.project_id);
      return `<option value="${asg.id}" ${asg.id === currentAssignmentId ? 'selected' : ''}>${escapeHtml(`${employee?.name || 'Employee'} → ${project?.name || 'Project'}`)}</option>`;
    }))
    .join('');
  modalBody.innerHTML = `<h3>Remove assignment</h3><label class="muted small-text">Assignment<select id="assignment-picker">${options}</select></label><p class="muted small-text">Removing an assignment immediately frees up the allocation.</p><div class="modal-actions"><button type="button" id="assignment-remove-confirm" class="danger">Remove assignment</button></div>`;
  modal.classList.remove('hidden');
  const picker = document.querySelector('#assignment-picker');
  const confirmBtn = document.querySelector('#assignment-remove-confirm');
  picker.addEventListener('change', (event) => { currentAssignmentId = Number(event.target.value) || null; });
  confirmBtn.addEventListener('click', async () => {
    if (!currentAssignmentId) return alert('Select an assignment to remove.');
    const assignment = state.assignments.find((asg) => asg.id === currentAssignmentId);
    if (!assignment) return;
    if (!confirm(`Remove assignment ${getEmployeeById(assignment.employee_id)?.name || 'Employee'} → ${getProjectById(assignment.project_id)?.name || 'Project'}?`)) return;
    await apiFetch(`/assignments/${currentAssignmentId}`, { method: 'DELETE' });
    showToast('Assignment removed');
    closeModal();
    await loadData();
  });
};

const handleContextMenu = (event) => {
  event.preventDefault();
  hideContextMenu();
  const node = event.target.closest('[data-node-type]');
  contextTarget = node ? { type: node.dataset.nodeType, id: node.dataset.id } : { type: 'canvas', id: null };
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.classList.remove('hidden');
};

const handleMenuClick = (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  hideContextMenu();
  if (action === 'create-org') openOrganizationModal();
  else if (action === 'create-project') openProjectModal();
  else if (action === 'edit-project') openProjectEditModal(contextTarget.type === 'project' ? Number(contextTarget.id) : null);
  else if (action === 'add-assignment') openAssignmentModal();
  else if (action === 'remove-assignment') openAssignmentRemovalModal(contextTarget.type === 'assignment' ? Number(contextTarget.id) : null);
  else if (action === 'edit-employee') openEmployeeModal(contextTarget.type === 'employee' ? Number(contextTarget.id) : null);
};

const beginConnectionDraft = (employeeId) => {
  const startRect = state.canvasNodeRects.get(`employee-${employeeId}`);
  if (!startRect) return;
  connectionDraft = {
    employeeId,
    startRect,
    currentPoint: { x: startRect.right + 30, y: startRect.top + startRect.height / 2 },
    targetType: null,
    targetId: null,
  };
  canvasStage.classList.add('canvas-stage-connecting');
  updateConnectionHint('Drop on a project to create an assignment or on another employee to set manager');
  renderCanvas();
};

const endConnectionDraft = () => {
  connectionDraft = null;
  canvasStage.classList.remove('canvas-stage-connecting');
  clearConnectionHover();
  updateConnectionHint('');
  renderCanvas();
};

const handlePointerDown = (event) => {
  if (event.button !== 0) return;
  const connectHandle = event.target.closest('[data-connect-from="employee"]');
  if (connectHandle) {
    event.preventDefault();
    event.stopPropagation();
    beginConnectionDraft(Number(connectHandle.dataset.id));
    return;
  }
  if (connectionDraft) return;
  if (event.target.closest('button, input, select, textarea')) return;
  isPanning = true;
  pointerId = event.pointerId;
  panStart = { x: event.clientX, y: event.clientY };
  canvasContent.classList.add('dragging');
  canvasStage.setPointerCapture(pointerId);
};

const handlePointerMove = (event) => {
  if (connectionDraft) {
    connectionDraft.currentPoint = stagePointFromPointer(event);
    clearConnectionHover();
    const target = getConnectionTargetAtPointer(event);
    if (target) {
      connectionDraft.targetType = target.type;
      connectionDraft.targetId = target.id;
      target.element.classList.add('canvas-target-hover');
      updateConnectionHint(target.label);
    } else {
      connectionDraft.targetType = null;
      connectionDraft.targetId = null;
      updateConnectionHint('Drop on a project to create an assignment or on another employee to set manager');
    }
    renderCanvas();
    return;
  }
  if (!isPanning || event.pointerId !== pointerId) return;
  const dx = event.clientX - panStart.x;
  const dy = event.clientY - panStart.y;
  pan.x += dx;
  pan.y += dy;
  panStart = { x: event.clientX, y: event.clientY };
  applyTransform();
};

const finishConnectionDraft = async () => {
  if (!connectionDraft) return;
  const { employeeId, targetType, targetId } = connectionDraft;
  endConnectionDraft();
  if (targetType === 'project' && targetId) {
    openAssignmentModal({ employeeId, projectId: targetId });
    return;
  }
  if (targetType === 'employee' && targetId) {
    await updateEmployeeManager(employeeId, targetId);
  }
};

const handlePointerUp = async (event) => {
  if (connectionDraft) {
    await finishConnectionDraft(event);
    return;
  }
  if (!isPanning || event.pointerId !== pointerId) return;
  isPanning = false;
  canvasContent.classList.remove('dragging');
  canvasStage.releasePointerCapture(pointerId);
};

const handleDragStart = (event) => {
  const node = event.target.closest('[data-drag-type="employee"]');
  if (!node) return;
  if (event.target.closest('[data-manager-toggle]')) {
    event.preventDefault();
    return;
  }
  dragEmployeeId = Number(node.dataset.id);
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('text/plain', String(dragEmployeeId));
};

const handleDragEnd = () => {
  dragEmployeeId = null;
  clearDropHighlights();
};

const handleDragOver = (event) => {
  if (!dragEmployeeId) return;
  const dropTarget = event.target.closest('[data-drop-type]');
  if (!dropTarget) return;
  event.preventDefault();
};

const handleDragEnter = (event) => {
  if (!dragEmployeeId) return;
  const dropTarget = event.target.closest('[data-drop-type]');
  if (!dropTarget) return;
  event.preventDefault();
  dropTarget.classList.add(dropTarget.dataset.dropType === 'project' ? 'project-box-droppable' : 'org-box-droppable');
};

const handleDragLeave = (event) => {
  if (!dragEmployeeId) return;
  const dropTarget = event.target.closest('[data-drop-type]');
  if (!dropTarget || dropTarget.contains(event.relatedTarget)) return;
  dropTarget.classList.remove('project-box-droppable', 'org-box-droppable');
};

const handleDrop = async (event) => {
  if (!dragEmployeeId) return;
  const dropTarget = event.target.closest('[data-drop-type]');
  if (!dropTarget) return;
  event.preventDefault();
  const employeeId = dragEmployeeId;
  dragEmployeeId = null;
  clearDropHighlights();
  if (dropTarget.dataset.dropType === 'project') openAssignmentModal({ employeeId, projectId: Number(dropTarget.dataset.id) });
  if (dropTarget.dataset.dropType === 'organization') await updateEmployeeOrganization(employeeId, Number(dropTarget.dataset.id));
};

const handleResourceClick = (event) => {
  const toggle = event.target.closest('[data-manager-toggle]');
  if (!toggle) return;
  const managerId = Number(toggle.dataset.managerToggle);
  if (!managerId) return;
  if (state.expandedManagers.has(managerId)) state.expandedManagers.delete(managerId);
  else state.expandedManagers.add(managerId);
  renderResources();
};

if (typeof window !== 'undefined') {
  window.__canvasTest = {
    openAssignmentModal,
    openEmployeeModal,
    openProjectEditModal,
    openAssignmentRemovalModal,
    openOrganizationModal,
    getState: () => state,
  };
}

const init = () => {
  applyTransform();
  loadData();
  canvasStage.addEventListener('pointerdown', handlePointerDown);
  canvasStage.addEventListener('pointermove', handlePointerMove);
  canvasStage.addEventListener('pointerup', handlePointerUp);
  canvasStage.addEventListener('pointerleave', (event) => {
    if (connectionDraft) return;
    handlePointerUp(event);
  });
  canvasStage.addEventListener('contextmenu', handleContextMenu);
  canvasStage.addEventListener('dragstart', handleDragStart);
  canvasStage.addEventListener('dragend', handleDragEnd);
  canvasStage.addEventListener('dragover', handleDragOver);
  canvasStage.addEventListener('dragenter', handleDragEnter);
  canvasStage.addEventListener('dragleave', handleDragLeave);
  canvasStage.addEventListener('drop', handleDrop);
  document.addEventListener('dragstart', handleDragStart);
  document.addEventListener('dragend', handleDragEnd);
  resourceList?.addEventListener('click', handleResourceClick);
  allocationUnitsSelect?.addEventListener('change', (event) => {
    allocationUnits = event.target.value;
    renderCanvas();
  });
  contextMenu.addEventListener('click', handleMenuClick);
  document.addEventListener('click', hideContextMenu);
  contextMenu.addEventListener('click', (event) => event.stopPropagation());
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideContextMenu();
      closeModal();
      if (connectionDraft) endConnectionDraft();
    }
  });
  window.addEventListener('resize', () => renderCanvas());
  canvasOrgFilter?.addEventListener('change', renderResources);
  resetViewBtn.addEventListener('click', () => {
    pan = { x: 0, y: 0 };
    panInitialized = false;
    renderCanvas();
  });
};

init();
