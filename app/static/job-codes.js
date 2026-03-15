const jobCodeTable = document.querySelector('#job-code-table');
const jobCodeForm = document.querySelector('#job-code-form');
const jobCodeFormTitle = document.querySelector('#job-code-form-title');
const jobCodeFormReset = document.querySelector('#job-code-form-reset');
const toast = document.querySelector('#toast');

let jobCodes = [];
let employees = [];

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  if (response.status === 204) return null;
  return response.json();
};

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));

const showToast = (message) => {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
};

const clearForm = () => {
  jobCodeForm.reset();
  jobCodeForm.querySelector('input[name="entity_id"]').value = '';
  jobCodeFormTitle.textContent = 'Add Job Code';
  jobCodeForm.querySelector('button[type="submit"]').textContent = 'Save Job Code';
};

const renderJobCodes = () => {
  if (!jobCodeTable) return;
  if (!jobCodes.length) {
    jobCodeTable.innerHTML = '<tr><td colspan="4">Add a job code to get started.</td></tr>';
    return;
  }
  const assignmentCounts = employees.reduce((acc, employee) => {
    if (!employee.job_code_id) return acc;
    acc[employee.job_code_id] = (acc[employee.job_code_id] || 0) + 1;
    return acc;
  }, {});
  jobCodeTable.innerHTML = jobCodes.map((jobCode) => `
    <tr>
      <td>${escapeHtml(jobCode.name)}</td>
      <td>${jobCode.is_leader ? 'Yes' : 'No'}</td>
      <td>${assignmentCounts[jobCode.id] || 0}</td>
      <td class="actions">
        <button type="button" data-action="edit-job-code" data-id="${jobCode.id}">Edit</button>
        <button type="button" class="secondary" data-action="delete-job-code" data-id="${jobCode.id}">Delete</button>
      </td>
    </tr>
  `).join('');
};

const loadData = async () => {
  [jobCodes, employees] = await Promise.all([
    apiFetch('/job-codes-api'),
    apiFetch('/employees'),
  ]);
  renderJobCodes();
};

jobCodeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(jobCodeForm);
  const payload = {
    name: String(formData.get('name') || '').trim(),
    is_leader: jobCodeForm.querySelector('#job-code-is-leader').checked,
  };
  if (!payload.name) {
    alert('Job code name is required.');
    return;
  }
  const id = formData.get('entity_id');
  try {
    if (id) {
      await apiFetch(`/job-codes-api/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Job code updated');
    } else {
      await apiFetch('/job-codes-api', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Job code added');
    }
    clearForm();
    await loadData();
  } catch (err) {
    alert(err.message);
  }
});

jobCodeTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  const jobCode = jobCodes.find((item) => String(item.id) === String(id));
  if (!jobCode) return;
  if (action === 'edit-job-code') {
    jobCodeForm.querySelector('input[name="entity_id"]').value = jobCode.id;
    jobCodeForm.querySelector('#job-code-name').value = jobCode.name;
    jobCodeForm.querySelector('#job-code-is-leader').checked = Boolean(jobCode.is_leader);
    jobCodeFormTitle.textContent = 'Update Job Code';
    jobCodeForm.querySelector('button[type="submit"]').textContent = 'Update Job Code';
    return;
  }
  if (action === 'delete-job-code') {
    if (!confirm(`Delete the job code "${jobCode.name}"?`)) return;
    try {
      await apiFetch(`/job-codes-api/${jobCode.id}`, { method: 'DELETE' });
      showToast('Job code deleted');
      clearForm();
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  }
});

jobCodeFormReset.addEventListener('click', clearForm);

(async function init() {
  clearForm();
  await loadData();
})();
