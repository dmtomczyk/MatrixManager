const assignmentTable = document.querySelector('#assignment-table');
const assignmentForm = document.querySelector('#assignment-form');
const assignmentEmployeeSelect = document.querySelector('#assignment-employee');
const assignmentProjectSelect = document.querySelector('#assignment-project');
const assignmentDemandSelect = document.querySelector('#assignment-demand');
const assignmentExportBtn = document.querySelector('#assignment-export');
const toast = document.querySelector('#toast');

let employees = [];
let projects = [];
let demands = [];
let assignments = [];

const formatISODate = (date) => date.toISOString().split('T')[0];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const apiFetch = async (url, options = {}) => { const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options }); if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.detail || 'Request failed'); } if (response.status === 204) return null; return response.json(); };
const showToast = (message) => { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); };
const updateDemandOptions = (projectId = '', selectedDemandId = '') => {
  const filteredDemands = demands.filter((item) => !projectId || String(item.project_id) === String(projectId));
  assignmentDemandSelect.innerHTML = ['<option value="">No linked demand</option>'].concat(filteredDemands.map((item) => `<option value="${item.id}">${escapeHtml(item.title)} (${item.remaining_allocation.toFixed(1)} FTE remaining)</option>`)).join('');
  assignmentDemandSelect.value = selectedDemandId && filteredDemands.some((item) => String(item.id) === String(selectedDemandId)) ? String(selectedDemandId) : '';
};
const updateSelectOptions = () => {
  assignmentEmployeeSelect.innerHTML = ['<option value="">Select employee</option>'].concat(employees.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)).join('');
  assignmentProjectSelect.innerHTML = ['<option value="">Select project</option>'].concat(projects.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)).join('');
  updateDemandOptions(assignmentProjectSelect.value, assignmentDemandSelect.value);
};
const renderAssignments = () => {
  assignmentTable.innerHTML = assignments.map((asg) => `<tr><td>${escapeHtml(asg.employee_name || String(asg.employee_id))}</td><td>${escapeHtml(asg.project_name || String(asg.project_id))}</td><td>${escapeHtml(asg.demand_title || '—')}</td><td>${escapeHtml(`${asg.start_date} → ${asg.end_date}`)}</td><td><span class="badge">${Math.round(asg.allocation * 100)}%</span></td><td>${escapeHtml(asg.status || 'approved')}</td><td>${escapeHtml(asg.submitted_by_username || '—')}</td><td>${escapeHtml(asg.notes || '')}</td><td class="actions"><button type="button" data-action="edit-assignment" data-id="${asg.id}">Edit</button><button type="button" class="secondary" data-action="delete-assignment" data-id="${asg.id}">Delete</button></td></tr>`).join('');
};
const resetForm = () => { assignmentForm.reset(); assignmentForm.querySelector('input[name="entity_id"]').value = ''; assignmentForm.querySelector('button[type="submit"]').textContent = 'Save Assignment'; assignmentForm.start_date.value = formatISODate(new Date()); assignmentForm.end_date.value = formatISODate(new Date()); updateDemandOptions(); };
const loadEmployees = async () => { employees = await apiFetch('/employees'); updateSelectOptions(); };
const loadProjects = async () => { projects = await apiFetch('/projects'); updateSelectOptions(); };
const loadDemands = async () => { demands = await apiFetch('/demands-api'); updateDemandOptions(assignmentProjectSelect.value, assignmentDemandSelect.value); };
const loadAssignments = async () => { assignments = await apiFetch('/assignments'); renderAssignments(); };
const populateAssignmentForm = (id) => { const assignment = assignments.find((a) => a.id === Number(id)); if (!assignment) return; assignmentEmployeeSelect.value = assignment.employee_id; assignmentProjectSelect.value = assignment.project_id; updateDemandOptions(assignment.project_id, assignment.demand_id || ''); assignmentDemandSelect.value = assignment.demand_id || ''; assignmentForm.start_date.value = assignment.start_date; assignmentForm.end_date.value = assignment.end_date; assignmentForm.allocation.value = Math.round(assignment.allocation * 100); assignmentForm.notes.value = assignment.notes || ''; assignmentForm.querySelector('input[name="entity_id"]').value = assignment.id; assignmentForm.querySelector('button[type="submit"]').textContent = 'Update Assignment'; };
const exportAssignmentsCsv = () => { if (!assignments.length) return alert('No assignments to export yet.'); const rows = assignments.map((asg) => [asg.employee_name || `Employee ${asg.employee_id}`, asg.project_name || `Project ${asg.project_id}`, asg.demand_title || '', asg.start_date, asg.end_date, Math.round(asg.allocation * 100)]); const csv = [['Employee','Project','Demand','Start Date','End Date','Allocation (%)']].concat(rows).map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `assignments_${formatISODate(new Date())}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); };
assignmentForm.addEventListener('submit', async (event) => { event.preventDefault(); const formData = new FormData(assignmentForm); const payload = { employee_id: Number(formData.get('employee_id')), project_id: Number(formData.get('project_id')), demand_id: formData.get('demand_id') ? Number(formData.get('demand_id')) : null, start_date: formData.get('start_date'), end_date: formData.get('end_date'), allocation: (Number(formData.get('allocation')) || 0) / 100, notes: String(formData.get('notes') || '').trim() || null }; const id = formData.get('entity_id'); try { if (id) { await apiFetch(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); showToast('Assignment updated'); } else { await apiFetch('/assignments', { method: 'POST', body: JSON.stringify(payload) }); showToast('Assignment submitted for review'); } resetForm(); await Promise.all([loadAssignments(), loadDemands()]); } catch (err) { alert(err.message); } });
assignmentTable.addEventListener('click', async (event) => { const btn = event.target.closest('button[data-action]'); if (!btn) return; const { action, id } = btn.dataset; if (action === 'edit-assignment') populateAssignmentForm(id); if (action === 'delete-assignment') { if (!confirm('Remove this assignment?')) return; await apiFetch(`/assignments/${id}`, { method: 'DELETE' }); showToast('Assignment removed'); await Promise.all([loadAssignments(), loadDemands()]); } });
assignmentProjectSelect.addEventListener('change', () => { const project = projects.find((p) => p.id === Number(assignmentProjectSelect.value)); updateDemandOptions(assignmentProjectSelect.value, ''); if (project?.end_date) assignmentForm.end_date.value = project.end_date; if (!assignmentForm.start_date.value) assignmentForm.start_date.value = formatISODate(new Date()); });
assignmentExportBtn.addEventListener('click', exportAssignmentsCsv);
(async function init() { await Promise.all([loadEmployees(), loadProjects(), loadDemands()]); await loadAssignments(); resetForm(); })();
