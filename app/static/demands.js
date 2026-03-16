const demandTable = document.querySelector('#demand-table');
const demandForm = document.querySelector('#demand-form');
const demandFormTitle = document.querySelector('#demand-form-title');
const demandFormStatus = document.querySelector('#demand-form-status');
const demandFormReset = document.querySelector('#demand-form-reset');
const demandProjectSelect = document.querySelector('#demand-project');
const demandOrganizationSelect = document.querySelector('#demand-organization');
const demandJobCodeSelect = document.querySelector('#demand-job-code');
const demandModal = document.querySelector('#demand-modal');
const demandModalClose = document.querySelector('#demand-modal-close');
const createDemandButton = document.querySelector('#create-demand');
const demandSubmit = document.querySelector('#demand-submit');
const toast = document.querySelector('#toast');

let projects = [];
let organizations = [];
let jobCodes = [];
let demands = [];
let lastFocusedElement = null;

const formatISODate = (date) => date.toISOString().split('T')[0];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const apiFetch = async (url, options = {}) => { const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options }); if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.detail || 'Request failed'); } if (response.status === 204) return null; return response.json(); };
const showToast = (message) => { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); };
const openModal = () => { lastFocusedElement = document.activeElement; demandModal.classList.remove('hidden'); document.body.classList.add('modal-open'); setTimeout(() => demandProjectSelect?.focus(), 0); };
const closeModal = ({ reset = false, restoreFocus = true } = {}) => { demandModal.classList.add('hidden'); document.body.classList.remove('modal-open'); if (reset) clearForm(); if (restoreFocus && lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus(); };
const updateSelects = () => {
  const previousProject = demandProjectSelect.value; const previousOrg = demandOrganizationSelect.value; const previousJobCode = demandJobCodeSelect.value;
  demandProjectSelect.innerHTML = ['<option value="">Select project</option>'].concat(projects.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)).join('');
  demandOrganizationSelect.innerHTML = ['<option value="">Unassigned</option>'].concat(organizations.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)).join('');
  demandJobCodeSelect.innerHTML = ['<option value="">Any job code</option>'].concat(jobCodes.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)).join('');
  if (previousProject) demandProjectSelect.value = previousProject;
  if (previousOrg) demandOrganizationSelect.value = previousOrg;
  if (previousJobCode) demandJobCodeSelect.value = previousJobCode;
};
const renderDemands = () => { demandTable.innerHTML = demands.length ? demands.map((item) => `
    <tr>
      <td>${escapeHtml(item.project_name || '')}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.organization_name || 'Unassigned')}</td>
      <td>${escapeHtml(item.job_code_name || 'Any')}</td>
      <td>${escapeHtml(item.skill_notes || '')}</td>
      <td>${escapeHtml(`${item.start_date} → ${item.end_date}`)}</td>
      <td><span class="badge">${item.required_allocation.toFixed(1)} FTE</span></td>
      <td>${item.fulfilled_allocation.toFixed(1)} FTE</td>
      <td>${item.remaining_allocation.toFixed(1)} FTE</td>
      <td class="actions">
        <button type="button" class="table-action-button" data-action="edit-demand" data-id="${item.id}">Edit</button>
        <button type="button" class="table-action-button table-action-button-secondary" data-action="delete-demand" data-id="${item.id}">Delete</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="10">No demand rows yet.</td></tr>'; };
const loadData = async () => { [projects, organizations, jobCodes, demands] = await Promise.all([apiFetch('/projects'), apiFetch('/organizations'), apiFetch('/job-codes-api'), apiFetch('/demands-api')]); updateSelects(); renderDemands(); };
const clearForm = () => {
  demandForm.reset(); demandForm.querySelector('input[name="entity_id"]').value = ''; demandSubmit.textContent = 'Save Demand'; demandFormTitle.textContent = 'Add Demand'; demandFormStatus.textContent = 'Create or update one demand row at a time.'; demandForm.start_date.value = formatISODate(new Date()); demandForm.end_date.value = formatISODate(new Date()); demandForm.required_allocation.value = '1'; updateSelects();
};
const populateDemandForm = (id) => {
  const demand = demands.find((item) => item.id === Number(id)); if (!demand) return; clearForm(); demandForm.querySelector('input[name="entity_id"]').value = demand.id; demandProjectSelect.value = String(demand.project_id); demandOrganizationSelect.value = demand.organization_id || ''; demandJobCodeSelect.value = demand.job_code_id || ''; demandForm.title.value = demand.title; demandForm.skill_notes.value = demand.skill_notes || ''; demandForm.start_date.value = demand.start_date; demandForm.end_date.value = demand.end_date; demandForm.required_allocation.value = demand.required_allocation; demandForm.notes.value = demand.notes || ''; demandSubmit.textContent = 'Update Demand'; demandFormTitle.textContent = 'Update Demand'; demandFormStatus.textContent = 'Update one demand row at a time.'; openModal();
};
demandForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(demandForm);
  const payload = { project_id: Number(formData.get('project_id')), title: String(formData.get('title') || '').trim(), organization_id: formData.get('organization_id') ? Number(formData.get('organization_id')) : null, job_code_id: formData.get('job_code_id') ? Number(formData.get('job_code_id')) : null, skill_notes: String(formData.get('skill_notes') || '').trim() || null, start_date: formData.get('start_date'), end_date: formData.get('end_date'), required_allocation: Number(formData.get('required_allocation')) || 0, notes: String(formData.get('notes') || '').trim() || null };
  const id = formData.get('entity_id');
  try { if (id) { await apiFetch(`/demands-api/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); showToast('Demand updated'); } else { await apiFetch('/demands-api', { method: 'POST', body: JSON.stringify(payload) }); showToast('Demand added'); } closeModal({ reset: true, restoreFocus: false }); await loadData(); } catch (err) { alert(err.message); }
});
demandTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]'); if (!button) return; const { action, id } = button.dataset; if (action === 'edit-demand') return populateDemandForm(id); if (action === 'delete-demand') { if (!confirm('Delete this demand?')) return; try { await apiFetch(`/demands-api/${id}`, { method: 'DELETE' }); showToast('Demand deleted'); clearForm(); await loadData(); } catch (err) { alert(err.message); } }
});
createDemandButton?.addEventListener('click', () => { clearForm(); openModal(); });
demandFormReset.addEventListener('click', clearForm);
demandModalClose?.addEventListener('click', () => closeModal({ reset: true }));
demandModal?.addEventListener('click', (event) => { if (event.target === demandModal) closeModal({ reset: true }); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && demandModal && !demandModal.classList.contains('hidden')) closeModal({ reset: true }); });
(async function init() { await loadData(); clearForm(); })();
