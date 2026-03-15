const projectTable = document.querySelector('#project-table');
const projectForm = document.querySelector('#project-form');
const scheduleEmployeeSelect = document.querySelector('#schedule-employee');
const scheduleProjectSelect = document.querySelector('#schedule-project');
const employeeScheduleList = document.querySelector('#employee-schedule');
const projectScheduleList = document.querySelector('#project-schedule');
const assignmentGraph = document.querySelector('#assignment-graph');
const assignmentGraphEmpty = document.querySelector('#assignment-graph-empty');
const allocationCanvas = document.querySelector('#allocation-chart');
const allocationEmpty = document.querySelector('#allocation-chart-empty');
const allocationPresetSelect = document.querySelector('#allocation-preset');
const allocationStartInput = document.querySelector('#allocation-start');
const allocationEndInput = document.querySelector('#allocation-end');
const allocationApplyBtn = document.querySelector('#allocation-apply');
const allocationRangeLabel = document.querySelector('#allocation-range-label');
const toast = document.querySelector('#toast');

const DEFAULT_WINDOW_DAYS = 28;
const DAY_MS = 86400000;
const COLOR_PALETTE = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#14b8a6', '#ef4444', '#eab308', '#0ea5e9', '#f472b6', '#8b5cf6'];
let allocationChart;
let allocationWindow = { mode: 'preset', days: DEFAULT_WINDOW_DAYS };

let employees = [];
let projects = [];
let assignments = [];

const formatISODate = (date) => date.toISOString().split('T')[0];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  if (response.status === 204) return null;
  return response.json();
};
const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
};
const resetForm = (form, label = 'Save') => {
  form.reset();
  const hidden = form.querySelector('input[name="entity_id"]');
  if (hidden) hidden.value = '';
  form.querySelector('button[type="submit"]').textContent = label;
};
const renderProjects = () => {
  projectTable.innerHTML = projects.map((proj) => `
    <tr>
      <td>${escapeHtml(proj.name)}</td>
      <td>${escapeHtml([proj.start_date, proj.end_date].filter(Boolean).join(' → ') || '—')}</td>
      <td>${escapeHtml(proj.description || '')}</td>
      <td class="actions">
        <button type="button" data-action="edit-project" data-id="${proj.id}">Edit</button>
        <button type="button" class="secondary" data-action="delete-project" data-id="${proj.id}">Delete</button>
      </td>
    </tr>`).join('');
};
const updateScheduleOptions = () => {
  const employeeOptions = ['<option value="">Select employee</option>'].concat(employees.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)).join('');
  const projectOptions = ['<option value="">Select project</option>'].concat(projects.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)).join('');
  scheduleEmployeeSelect.innerHTML = employeeOptions;
  scheduleProjectSelect.innerHTML = projectOptions;
};
const renderScheduleList = (items, container, labelKey) => {
  if (!items.length) {
    container.innerHTML = '<li>No scheduled items.</li>';
    return;
  }
  container.innerHTML = items.map((item) => `<li><strong>${escapeHtml(item[labelKey] || '')}</strong><div class="subtitle">${escapeHtml(item.start_date)} → ${escapeHtml(item.end_date)} · ${Math.round(item.allocation * 100)}%</div><div class="subtitle">${escapeHtml(item.notes || '')}</div></li>`).join('');
};
const loadEmployeeSchedule = async (id) => {
  if (!id) return (employeeScheduleList.innerHTML = '<li>Select an employee</li>');
  renderScheduleList(await apiFetch(`/schedule/employee/${id}`), employeeScheduleList, 'project_name');
};
const loadProjectSchedule = async (id) => {
  if (!id) return (projectScheduleList.innerHTML = '<li>Select a project</li>');
  renderScheduleList(await apiFetch(`/schedule/project/${id}`), projectScheduleList, 'employee_name');
};
const renderAssignmentGraph = () => {
  if (!assignmentGraph) return;
  assignmentGraph.innerHTML = '';
  if (!(assignments.length && employees.length && projects.length)) {
    assignmentGraphEmpty?.classList.remove('hidden');
    return;
  }
  assignmentGraphEmpty?.classList.add('hidden');
  const width = assignmentGraph.clientWidth || 760;
  const leftX = 140;
  const rightX = Math.max(leftX + 260, width - 140);
  const rowGap = 70;
  const topPadding = 50;
  const employeePositions = employees.map((emp, idx) => ({ id: emp.id, name: emp.name || `Employee ${emp.id}`, x: leftX, y: topPadding + idx * rowGap, capacity: emp.capacity || 1 }));
  const projectPositions = projects.map((proj, idx) => ({ id: proj.id, name: proj.name || `Project ${proj.id}`, x: rightX, y: topPadding + idx * rowGap }));
  const employeeById = new Map(employeePositions.map((node) => [node.id, node]));
  const projectById = new Map(projectPositions.map((node) => [node.id, node]));
  const edges = assignments.map((asg) => {
    const employeeNode = employeeById.get(asg.employee_id);
    const projectNode = projectById.get(asg.project_id);
    if (!employeeNode || !projectNode) return null;
    const percent = Math.round(asg.allocation * 100);
    const employeeCap = Math.round((employeeNode.capacity || 1) * 100);
    return { employeeNode, projectNode, percent, isOver: percent > employeeCap };
  }).filter(Boolean);
  const height = Math.max(employeePositions.length, projectPositions.length) > 1 ? topPadding * 2 + (Math.max(employeePositions.length, projectPositions.length) - 1) * rowGap : 220;
  assignmentGraph.innerHTML = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${edges.map(({ employeeNode, projectNode, percent, isOver }) => `<line x1="${employeeNode.x + 18}" y1="${employeeNode.y}" x2="${projectNode.x - 18}" y2="${projectNode.y}" stroke="${isOver ? '#ef4444' : '#94a3b8'}" stroke-width="${Math.max(2, percent / 25)}" stroke-linecap="round"></line>`).join('')}${employeePositions.map((node) => `<g class="node employee"><circle cx="${node.x}" cy="${node.y}" r="18"></circle><text x="${node.x - 28}" y="${node.y + 4}" text-anchor="end">${escapeHtml(node.name)}</text></g>`).join('')}${projectPositions.map((node) => `<g class="node project"><circle cx="${node.x}" cy="${node.y}" r="18"></circle><text x="${node.x + 28}" y="${node.y + 4}" text-anchor="start">${escapeHtml(node.name)}</text></g>`).join('')}</svg>`;
};
const normalizeDate = (value) => { const d = new Date(value); if (Number.isNaN(d.valueOf())) return null; d.setHours(0,0,0,0); return d; };
const getAllocationBounds = () => {
  const today = normalizeDate(new Date());
  if (allocationWindow.mode === 'custom' && allocationWindow.start && allocationWindow.end) return { start: normalizeDate(allocationWindow.start), end: normalizeDate(allocationWindow.end) };
  if (allocationWindow.mode === 'all') {
    let minDate = null, maxDate = null;
    assignments.forEach((asg) => { const start = normalizeDate(asg.start_date); const end = normalizeDate(asg.end_date); if (!start || !end) return; if (!minDate || start < minDate) minDate = start; if (!maxDate || end > maxDate) maxDate = end; });
    if (minDate && maxDate) return { start: minDate, end: maxDate };
  }
  const end = new Date(today); end.setDate(end.getDate() + ((allocationWindow.days || DEFAULT_WINDOW_DAYS) - 1));
  return { start: today, end };
};
const updateRangeLabel = (bounds) => { const days = Math.max(1, Math.floor((bounds.end - bounds.start) / DAY_MS) + 1); allocationRangeLabel.textContent = `Window: ${formatISODate(bounds.start)} → ${formatISODate(bounds.end)} (${days} days)`; };
const computeAllocationDataset = () => {
  const bounds = getAllocationBounds();
  const windowStart = new Date(bounds.start); windowStart.setHours(0,0,0,0);
  const windowEnd = new Date(bounds.end); windowEnd.setHours(0,0,0,0);
  const dayCount = Math.max(1, Math.floor((windowEnd - windowStart) / DAY_MS) + 1);
  const labels = Array.from({ length: dayCount }, (_, idx) => { const d = new Date(windowStart); d.setDate(d.getDate() + idx); return formatISODate(d); });
  const loadMap = new Map(); employees.forEach((emp) => loadMap.set(emp.id, { info: emp, buckets: new Array(dayCount).fill(0) }));
  assignments.forEach((asg) => { const entry = loadMap.get(asg.employee_id); if (!entry) return; let startIdx = Math.floor((new Date(asg.start_date) - windowStart) / DAY_MS); let endIdx = Math.floor((new Date(asg.end_date) - windowStart) / DAY_MS); if (endIdx < 0 || startIdx > dayCount - 1) return; startIdx = Math.max(0, startIdx); endIdx = Math.min(dayCount - 1, endIdx); for (let i = startIdx; i <= endIdx; i += 1) entry.buckets[i] += asg.allocation; });
  return { labels, datasets: Array.from(loadMap.values()).map(({ info, buckets }, idx) => ({ label: info.name, data: buckets.map((value) => Math.round(((value / (info.capacity || 1)) * 100) * 10) / 10), color: COLOR_PALETTE[idx % COLOR_PALETTE.length], capacity: info.capacity || 1 })), bounds };
};
const renderAllocationChart = () => {
  const dataset = computeAllocationDataset();
  updateRangeLabel(dataset.bounds);
  if (!dataset.labels.length || !dataset.datasets.length) { if (allocationChart) allocationChart.destroy(); allocationEmpty.classList.remove('hidden'); return; }
  allocationEmpty.classList.add('hidden');
  const ctx = allocationCanvas.getContext('2d');
  if (allocationChart) allocationChart.destroy();
  allocationChart = new Chart(ctx, { type: 'line', data: { labels: dataset.labels, datasets: dataset.datasets.map((series) => ({ label: series.label, data: series.data, borderColor: series.color, backgroundColor: 'transparent', borderWidth: 2, tension: 0.25, pointRadius: 0, spanGaps: true, segment: { borderColor: (ctx) => ((ctx.p0.parsed.y > 100 || ctx.p1.parsed.y > 100) ? '#ef4444' : series.color) } })).concat([{ label: '100% capacity', data: new Array(dataset.labels.length).fill(100), borderColor: '#1d4ed8', borderDash: [6,4], pointRadius: 0, borderWidth: 1.5 }]) }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: (value) => `${value}%` } } } } });
};
const loadProjects = async () => { projects = await apiFetch('/projects'); renderProjects(); updateScheduleOptions(); };
const loadEmployees = async () => { employees = await apiFetch('/employees'); updateScheduleOptions(); };
const loadAssignments = async () => { assignments = await apiFetch('/assignments'); renderAssignmentGraph(); renderAllocationChart(); };
const handleProjectSubmit = async (event) => { event.preventDefault(); const formData = new FormData(projectForm); const payload = { name: formData.get('name').trim(), description: formData.get('description').trim() || null, start_date: formData.get('start_date') || null, end_date: formData.get('end_date') || null }; const id = formData.get('entity_id'); try { if (id) { await apiFetch(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); showToast('Project updated'); } else { await apiFetch('/projects', { method: 'POST', body: JSON.stringify(payload) }); showToast('Project added'); } resetForm(projectForm, 'Save Project'); await loadProjects(); await loadAssignments(); } catch (err) { alert(err.message); } };
const handleProjectTableClick = async (event) => { const btn = event.target.closest('button[data-action]'); if (!btn) return; const { action, id } = btn.dataset; if (action === 'edit-project') { const project = projects.find((p) => p.id === Number(id)); if (!project) return; projectForm.name.value = project.name; projectForm.description.value = project.description || ''; projectForm.start_date.value = project.start_date || ''; projectForm.end_date.value = project.end_date || ''; projectForm.querySelector('input[name="entity_id"]').value = project.id; projectForm.querySelector('button[type="submit"]').textContent = 'Update Project'; } if (action === 'delete-project') { if (!confirm('Delete this project and related assignments?')) return; await apiFetch(`/projects/${id}`, { method: 'DELETE' }); showToast('Project deleted'); await loadProjects(); await loadAssignments(); } };
projectForm.addEventListener('submit', handleProjectSubmit);
projectTable.addEventListener('click', handleProjectTableClick);
scheduleEmployeeSelect.addEventListener('change', (event) => loadEmployeeSchedule(event.target.value));
scheduleProjectSelect.addEventListener('change', (event) => loadProjectSchedule(event.target.value));
allocationPresetSelect.addEventListener('change', (event) => { const value = event.target.value; if (value === 'all') allocationWindow = { mode: 'all' }; else if (value !== 'custom') allocationWindow = { mode: 'preset', days: Number(value) || DEFAULT_WINDOW_DAYS }; renderAllocationChart(); });
allocationApplyBtn.addEventListener('click', () => { if (!allocationStartInput.value || !allocationEndInput.value) return; allocationWindow = { mode: 'custom', start: allocationStartInput.value, end: allocationEndInput.value }; allocationPresetSelect.value = 'custom'; renderAllocationChart(); });
(async function init() { await Promise.all([loadEmployees(), loadProjects()]); await loadAssignments(); projectForm.start_date.value = formatISODate(new Date()); employeeScheduleList.innerHTML = '<li>Select an employee</li>'; projectScheduleList.innerHTML = '<li>Select a project</li>'; })();
