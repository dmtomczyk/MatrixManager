const projectTable = document.querySelector('#project-table');
const projectForm = document.querySelector('#project-form');
const projectFormTitle = document.querySelector('#project-form-title');
const projectFormStatus = document.querySelector('#project-form-status');
const projectFormReset = document.querySelector('#project-form-reset');
const createProjectButton = document.querySelector('#create-project');
const projectModal = document.querySelector('#project-modal');
const projectModalClose = document.querySelector('#project-modal-close');
const projectSubmit = document.querySelector('#project-submit');
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
let lastFocusedElement = null;

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
const openModal = () => {
  lastFocusedElement = document.activeElement;
  projectModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(() => projectForm.querySelector('input[name="name"]')?.focus(), 0);
};
const closeModal = ({ reset = false, restoreFocus = true } = {}) => {
  projectModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  if (reset) resetForm(projectForm, 'Save Project');
  if (restoreFocus && lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
};
const resetForm = (form, label = 'Save Project') => {
  form.reset();
  const hidden = form.querySelector('input[name="entity_id"]');
  if (hidden) hidden.value = '';
  projectSubmit.textContent = label;
  projectFormTitle.textContent = label === 'Save Project' ? 'Add Project' : 'Update Project';
  projectFormStatus.textContent = 'Create or update one project at a time.';
};
const renderProjects = () => {
  projectTable.innerHTML = projects.length ? projects.map((proj) => `
    <tr>
      <td>${escapeHtml(proj.name)}</td>
      <td>${escapeHtml([proj.start_date, proj.end_date].filter(Boolean).join(' → ') || '—')}</td>
      <td>${escapeHtml(proj.description || '')}</td>
      <td class="actions">
        <button type="button" class="table-action-button" data-action="edit-project" data-id="${proj.id}">Edit</button>
        <button type="button" class="table-action-button table-action-button-secondary" data-action="delete-project" data-id="${proj.id}">Delete</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="4">No projects yet.</td></tr>';
};
const normalizeDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};
const getAllocationBounds = () => {
  const today = normalizeDate(new Date());
  if (allocationWindow.mode === 'custom' && allocationWindow.start && allocationWindow.end) return { start: normalizeDate(allocationWindow.start), end: normalizeDate(allocationWindow.end) };
  if (allocationWindow.mode === 'all') {
    let minDate = null; let maxDate = null;
    assignments.forEach((asg) => {
      const start = normalizeDate(asg.start_date); const end = normalizeDate(asg.end_date);
      if (!start || !end) return;
      if (!minDate || start < minDate) minDate = start;
      if (!maxDate || end > maxDate) maxDate = end;
    });
    if (minDate && maxDate) return { start: minDate, end: maxDate };
  }
  const end = new Date(today); end.setDate(end.getDate() + ((allocationWindow.days || DEFAULT_WINDOW_DAYS) - 1));
  return { start: today, end };
};
const updateRangeLabel = (bounds) => {
  const days = Math.max(1, Math.floor((bounds.end - bounds.start) / DAY_MS) + 1);
  allocationRangeLabel.textContent = `Window: ${formatISODate(bounds.start)} → ${formatISODate(bounds.end)} (${days} days)`;
};
const computeAllocationDataset = () => {
  const bounds = getAllocationBounds(); const windowStart = new Date(bounds.start); windowStart.setHours(0,0,0,0); const windowEnd = new Date(bounds.end); windowEnd.setHours(0,0,0,0);
  const dayCount = Math.max(1, Math.floor((windowEnd - windowStart) / DAY_MS) + 1);
  const labels = Array.from({ length: dayCount }, (_, idx) => { const d = new Date(windowStart); d.setDate(d.getDate() + idx); return formatISODate(d); });
  const loadMap = new Map(); employees.forEach((emp) => loadMap.set(emp.id, { info: emp, buckets: new Array(dayCount).fill(0) }));
  assignments.forEach((asg) => { const entry = loadMap.get(asg.employee_id); if (!entry) return; let startIdx = Math.floor((new Date(asg.start_date) - windowStart) / DAY_MS); let endIdx = Math.floor((new Date(asg.end_date) - windowStart) / DAY_MS); if (endIdx < 0 || startIdx > dayCount - 1) return; startIdx = Math.max(0, startIdx); endIdx = Math.min(dayCount - 1, endIdx); for (let i = startIdx; i <= endIdx; i += 1) entry.buckets[i] += asg.allocation; });
  return { labels, datasets: Array.from(loadMap.values()).map(({ info, buckets }, idx) => ({ label: info.name, data: buckets.map((value) => Math.round(((value / (info.capacity || 1)) * 100) * 10) / 10), color: COLOR_PALETTE[idx % COLOR_PALETTE.length] })), bounds };
};
const renderAllocationChart = () => {
  const dataset = computeAllocationDataset(); updateRangeLabel(dataset.bounds);
  if (!dataset.labels.length || !dataset.datasets.length) { if (allocationChart) allocationChart.destroy(); allocationEmpty.classList.remove('hidden'); return; }
  allocationEmpty.classList.add('hidden'); const ctx = allocationCanvas.getContext('2d'); if (allocationChart) allocationChart.destroy();
  allocationChart = new Chart(ctx, { type: 'line', data: { labels: dataset.labels, datasets: dataset.datasets.map((series) => ({ label: series.label, data: series.data, borderColor: series.color, backgroundColor: 'transparent', borderWidth: 2, tension: 0.25, pointRadius: 0, spanGaps: true, segment: { borderColor: (ctx) => ((ctx.p0.parsed.y > 100 || ctx.p1.parsed.y > 100) ? '#ef4444' : series.color) } })).concat([{ label: '100% capacity', data: new Array(dataset.labels.length).fill(100), borderColor: '#1d4ed8', borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 }]) }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: (value) => `${value}%` } } } } });
};
const loadProjects = async () => { projects = await apiFetch('/projects'); renderProjects(); };
const loadEmployees = async () => { employees = await apiFetch('/employees'); };
const loadAssignments = async () => { assignments = await apiFetch('/assignments'); renderAllocationChart(); };
const handleProjectSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(projectForm);
  const payload = { name: String(formData.get('name') || '').trim(), description: String(formData.get('description') || '').trim() || null, start_date: formData.get('start_date') || null, end_date: formData.get('end_date') || null };
  const id = formData.get('entity_id');
  try { if (id) { await apiFetch(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); showToast('Project updated'); } else { await apiFetch('/projects', { method: 'POST', body: JSON.stringify(payload) }); showToast('Project added'); } closeModal({ reset: true, restoreFocus: false }); await loadProjects(); await loadAssignments(); } catch (err) { alert(err.message); }
};
const handleProjectTableClick = async (event) => {
  const btn = event.target.closest('button[data-action]'); if (!btn) return; const { action, id } = btn.dataset;
  if (action === 'edit-project') {
    const project = projects.find((p) => p.id === Number(id)); if (!project) return;
    projectForm.name.value = project.name; projectForm.description.value = project.description || ''; projectForm.start_date.value = project.start_date || ''; projectForm.end_date.value = project.end_date || ''; projectForm.querySelector('input[name="entity_id"]').value = project.id; projectSubmit.textContent = 'Update Project'; projectFormTitle.textContent = 'Update Project'; projectFormStatus.textContent = 'Update one project at a time.'; openModal();
  }
  if (action === 'delete-project') {
    if (!confirm('Delete this project and related assignments?')) return; await apiFetch(`/projects/${id}`, { method: 'DELETE' }); showToast('Project deleted'); await loadProjects(); await loadAssignments();
  }
};
projectForm.addEventListener('submit', handleProjectSubmit);
projectTable.addEventListener('click', handleProjectTableClick);
createProjectButton?.addEventListener('click', () => { resetForm(projectForm, 'Save Project'); projectForm.start_date.value = formatISODate(new Date()); openModal(); });
projectFormReset?.addEventListener('click', () => resetForm(projectForm, 'Save Project'));
projectModalClose?.addEventListener('click', () => closeModal({ reset: true }));
projectModal?.addEventListener('click', (event) => { if (event.target === projectModal) closeModal({ reset: true }); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && projectModal && !projectModal.classList.contains('hidden')) closeModal({ reset: true }); });
allocationPresetSelect.addEventListener('change', (event) => { const value = event.target.value; if (value === 'all') allocationWindow = { mode: 'all' }; else if (value !== 'custom') allocationWindow = { mode: 'preset', days: Number(value) || DEFAULT_WINDOW_DAYS }; renderAllocationChart(); });
allocationApplyBtn.addEventListener('click', () => { if (!allocationStartInput.value || !allocationEndInput.value) return; allocationWindow = { mode: 'custom', start: allocationStartInput.value, end: allocationEndInput.value }; allocationPresetSelect.value = 'custom'; renderAllocationChart(); });
(async function init() { await Promise.all([loadEmployees(), loadProjects()]); await loadAssignments(); projectForm.start_date.value = formatISODate(new Date()); })();
