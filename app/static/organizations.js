const orgTable = document.querySelector('#org-table');
const orgForm = document.querySelector('#org-form');
const rosterTable = document.querySelector('#org-roster-table');
const toast = document.querySelector('#toast');

let organizations = [];
let employees = [];

const apiFetch = async (url, options = {}) => {
  const opts = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  const response = await fetch(url, opts);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  if (response.status === 204) return null;
  return response.json();
};

const showToast = (message) => {
  if (!toast) {
    alert(message);
    return;
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
};

const resetForm = (form, label = 'Save') => {
  form.reset();
  const hidden = form.querySelector('input[name="entity_id"]');
  if (hidden) hidden.value = '';
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = label;
};

const renderOrganizations = () => {
  if (!orgTable) return;
  const headcounts = employees.reduce((acc, emp) => {
    if (!acc[emp.organization_id]) acc[emp.organization_id] = 0;
    acc[emp.organization_id] += 1;
    return acc;
  }, {});
  if (!organizations.length) {
    orgTable.innerHTML = '<tr><td colspan="4">Add an organization to get started.</td></tr>';
    return;
  }
  orgTable.innerHTML = organizations
    .map((org) => {
      const count = headcounts[org.id] || 0;
      return `
        <tr>
          <td>${org.name}</td>
          <td>${org.description || ''}</td>
          <td>${count}</td>
          <td class="actions">
            <button type="button" data-action="edit-org" data-id="${org.id}">Edit</button>
            <button type="button" class="secondary" data-action="delete-org" data-id="${org.id}">Delete</button>
          </td>
        </tr>`;
    })
    .join('');
};

const renderRoster = () => {
  if (!rosterTable) return;
  if (!employees.length) {
    rosterTable.innerHTML = '<tr><td colspan="4">Add employees on the main dashboard to start assigning organizations.</td></tr>';
    return;
  }
  if (!organizations.length) {
    rosterTable.innerHTML = '<tr><td colspan="4">Create at least one organization to assign employees.</td></tr>';
    return;
  }
  const optionsMarkup = organizations
    .map((org) => `<option value="${org.id}">${org.name}</option>`)
    .join('');
  rosterTable.innerHTML = employees
    .map((emp) => {
      return `
        <tr>
          <td>${emp.name}</td>
          <td>${emp.role || ''}</td>
          <td>
            <select data-employee-id="${emp.id}">
              ${optionsMarkup.replace(`value="${emp.organization_id}"`, `value="${emp.organization_id}" selected`)}
            </select>
          </td>
          <td class="muted small-text">${emp.location || ''}</td>
        </tr>`;
    })
    .join('');
  rosterTable
    .querySelectorAll('select[data-employee-id]')
    .forEach((select) => {
      const employeeId = Number(select.dataset.employeeId);
      const employee = employees.find((e) => e.id === employeeId);
      if (employee) {
        select.value = employee.organization_id || '';
      }
    });
};

const loadData = async () => {
  try {
    const [orgData, employeeData] = await Promise.all([
      apiFetch('/organizations'),
      apiFetch('/employees'),
    ]);
    organizations = orgData;
    employees = employeeData;
    renderOrganizations();
    renderRoster();
  } catch (err) {
    alert(err.message);
  }
};

const handleOrgSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(orgForm);
  const payload = {
    name: formData.get('name').trim(),
    description: formData.get('description').trim() || null,
  };
  const id = formData.get('entity_id');
  try {
    if (id) {
      await apiFetch(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Organization updated');
    } else {
      await apiFetch('/organizations', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Organization added');
    }
    resetForm(orgForm, 'Save Organization');
    await loadData();
  } catch (err) {
    alert(err.message);
  }
};

const handleOrgTableClick = (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!id) return;
  if (action === 'edit-org') {
    const org = organizations.find((o) => o.id === Number(id));
    if (!org) return;
    orgForm.name.value = org.name;
    orgForm.description.value = org.description || '';
    orgForm.querySelector('input[name="entity_id"]').value = org.id;
    orgForm.querySelector('button[type="submit"]').textContent = 'Update Organization';
  }
  if (action === 'delete-org') {
    if (!confirm('Delete this organization? Employees must be reassigned first.')) return;
    apiFetch(`/organizations/${id}`, { method: 'DELETE' })
      .then(() => {
        showToast('Organization deleted');
        loadData();
      })
      .catch((err) => alert(err.message));
  }
};

const handleRosterChange = (event) => {
  const select = event.target.closest('select[data-employee-id]');
  if (!select) return;
  const employeeId = Number(select.dataset.employeeId);
  const organizationId = Number(select.value);
  if (!employeeId || !organizationId) {
    alert('Select a valid organization.');
    return;
  }
  apiFetch(`/employees/${employeeId}`, { method: 'PUT', body: JSON.stringify({ organization_id: organizationId }) })
    .then(() => {
      showToast('Employee reassigned');
      loadData();
    })
    .catch((err) => {
      alert(err.message);
      loadData();
    });
};

orgForm.addEventListener('submit', handleOrgSubmit);
orgTable.addEventListener('click', handleOrgTableClick);
rosterTable.addEventListener('change', handleRosterChange);

loadData();
