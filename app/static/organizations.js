const orgTable = document.querySelector('#org-table');
const orgForm = document.querySelector('#org-form');
const orgFormTitle = document.querySelector('#org-form-title');
const orgFormStatus = document.querySelector('#org-form-status');
const orgSubmitButton = document.querySelector('#org-submit-button');
const orgFormSecondaryAction = document.querySelector('#org-form-secondary-action');
const rosterTable = document.querySelector('#org-roster-table');
const orgParentSelect = document.querySelector('#org-parent-organization');
const orgOwnerSelect = document.querySelector('#org-owner-employee');
const createOrgButton = document.querySelector('#create-org');
const orgModal = document.querySelector('#org-modal');
const orgModalCloseButton = document.querySelector('#org-modal-close');
const toast = document.querySelector('#toast');

let organizations = [];
let employees = [];
let lastFocusedElement = null;

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

const isManagerCandidate = (employee) => employee.employee_type === 'L' || employee.direct_report_count > 0;

const openOrgModal = () => {
  if (!orgModal) return;
  lastFocusedElement = document.activeElement;
  orgModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  window.setTimeout(() => orgForm?.querySelector('input[name="name"]')?.focus(), 0);
};

const closeOrgModal = ({ reset = false, restoreFocus = true } = {}) => {
  if (!orgModal) return;
  orgModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  if (reset) resetForm(orgForm, 'Save Organization');
  if (restoreFocus && lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
};

const buildOrganizationTree = () => {
  const byId = new Map(organizations.map((org) => [org.id, org]));
  const children = new Map(organizations.map((org) => [org.id, []]));
  const roots = [];
  organizations.forEach((org) => {
    if (org.parent_organization_id && byId.has(org.parent_organization_id)) children.get(org.parent_organization_id).push(org);
    else roots.push(org);
  });
  const sorter = (a, b) => a.name.localeCompare(b.name);
  roots.sort(sorter);
  children.forEach((items) => items.sort(sorter));
  return { roots, children };
};

const renderParentOptions = (selectedOrgId = '', editingOrgId = null) => {
  if (!orgParentSelect) return;
  const options = organizations
    .filter((org) => String(org.id) !== String(editingOrgId || ''))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((org) => `<option value="${org.id}">${org.name}</option>`)
    .join('');
  orgParentSelect.innerHTML = `<option value="">No parent</option>${options}`;
  if (selectedOrgId) orgParentSelect.value = String(selectedOrgId);
};

const renderOwnerOptions = (selectedEmployeeId = '') => {
  if (!orgOwnerSelect) return;
  const options = employees
    .filter(isManagerCandidate)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((employee) => `<option value="${employee.id}">${employee.name}${employee.organization_name ? ` · ${employee.organization_name}` : ''}</option>`)
    .join('');
  orgOwnerSelect.innerHTML = `<option value="">No owner</option>${options}`;
  if (selectedEmployeeId) orgOwnerSelect.value = String(selectedEmployeeId);
};

const resetForm = (form, label = 'Save Organization') => {
  form.reset();
  const hidden = form.querySelector('input[name="entity_id"]');
  if (hidden) hidden.value = '';
  if (orgFormTitle) orgFormTitle.textContent = 'Add Organization';
  if (orgFormStatus) orgFormStatus.textContent = 'Create or update one organization at a time.';
  if (orgSubmitButton) orgSubmitButton.textContent = label;
  if (orgFormSecondaryAction) orgFormSecondaryAction.textContent = 'Clear Form';
  renderParentOptions();
  renderOwnerOptions();
};

const renderOrganizations = () => {
  if (!orgTable) return;
  const headcounts = employees.reduce((acc, emp) => {
    if (!acc[emp.organization_id]) acc[emp.organization_id] = 0;
    acc[emp.organization_id] += 1;
    return acc;
  }, {});
  if (!organizations.length) {
    orgTable.innerHTML = '<tr><td colspan="6">Add an organization to get started.</td></tr>';
    return;
  }
  const { roots, children } = buildOrganizationTree();
  const rows = [];
  const appendRow = (org, level = 0) => {
    const childItems = children.get(org.id) || [];
    const indent = level * 20;
    rows.push(`
      <tr>
        <td>
          <div class="employee-name-cell" style="padding-left:${indent}px">
            ${level > 0 ? '<span class="hierarchy-leaf hierarchy-leaf-small"></span>' : '<span class="hierarchy-leaf hierarchy-leaf-small"></span>'}
            <div class="employee-name-stack">
              <div class="employee-name-row">
                <strong>${org.name}</strong>
                ${org.parent_organization_name ? `<span class="badge">Child org</span>` : `<span class="badge">Top level</span>`}
              </div>
              ${org.parent_organization_name ? `<span class="employee-subtle">Parent: ${org.parent_organization_name}</span>` : ''}
            </div>
          </div>
        </td>
        <td>${org.owner_employee_name ? `<span class="badge assignment-status-approved">${org.owner_employee_name}</span>` : '—'}</td>
        <td>${org.description || ''}</td>
        <td>${headcounts[org.id] || 0}</td>
        <td>${org.child_organization_count || 0}</td>
        <td class="actions employee-row-actions">
          <button type="button" class="table-action-button" data-action="edit-org" data-id="${org.id}">Edit</button>
          <button type="button" class="table-action-button table-action-button-secondary" data-action="delete-org" data-id="${org.id}">Delete</button>
        </td>
      </tr>`);
    childItems.forEach((child) => appendRow(child, level + 1));
  };
  roots.forEach((org) => appendRow(org, 0));
  orgTable.innerHTML = rows.join('');
};

const renderRoster = () => {
  if (!rosterTable) return;
  if (!employees.length) {
    rosterTable.innerHTML = '<tr><td colspan="5">Add employees on the main dashboard to start assigning organizations.</td></tr>';
    return;
  }
  if (!organizations.length) {
    rosterTable.innerHTML = '<tr><td colspan="5">Create at least one organization to assign employees.</td></tr>';
    return;
  }
  const optionsMarkup = organizations
    .map((org) => `<option value="${org.id}">${org.name}</option>`)
    .join('');
  const ownedOrgNamesByEmployee = organizations.reduce((acc, org) => {
    if (!org.owner_employee_id) return acc;
    acc[org.owner_employee_id] = acc[org.owner_employee_id] || [];
    acc[org.owner_employee_id].push(org.name);
    return acc;
  }, {});
  rosterTable.innerHTML = employees
    .map((emp) => {
      const ownedOrgs = ownedOrgNamesByEmployee[emp.id] || [];
      return `
        <tr>
          <td>${emp.name}</td>
          <td>${emp.role || ''}</td>
          <td>
            <select data-employee-id="${emp.id}">
              ${optionsMarkup.replace(`value="${emp.organization_id}"`, `value="${emp.organization_id}" selected`)}
            </select>
          </td>
          <td>${ownedOrgs.length ? ownedOrgs.map((name) => `<span class="badge assignment-status-approved">${name}</span>`).join(' ') : '<span class="muted small-text">—</span>'}</td>
          <td class="muted small-text">${emp.location || ''}</td>
        </tr>`;
    })
    .join('');
  rosterTable
    .querySelectorAll('select[data-employee-id]')
    .forEach((select) => {
      const employeeId = Number(select.dataset.employeeId);
      const employee = employees.find((e) => e.id === employeeId);
      if (employee) select.value = employee.organization_id || '';
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
    renderParentOptions();
    renderOwnerOptions();
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
    name: String(formData.get('name') || '').trim(),
    description: String(formData.get('description') || '').trim() || null,
    parent_organization_id: formData.get('parent_organization_id') ? Number(formData.get('parent_organization_id')) : null,
    owner_employee_id: formData.get('owner_employee_id') ? Number(formData.get('owner_employee_id')) : null,
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
    closeOrgModal({ reset: true, restoreFocus: false });
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
    renderParentOptions(org.parent_organization_id || '', org.id);
    renderOwnerOptions(org.owner_employee_id || '');
    if (orgFormTitle) orgFormTitle.textContent = 'Update Organization';
    if (orgFormStatus) orgFormStatus.textContent = 'Update one organization, including its parent and owner.';
    if (orgSubmitButton) orgSubmitButton.textContent = 'Update Organization';
    openOrgModal();
    return;
  }
  if (action === 'delete-org') {
    if (!confirm('Delete this organization? Employees and child orgs must be reassigned first.')) return;
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
createOrgButton?.addEventListener('click', () => {
  resetForm(orgForm, 'Save Organization');
  openOrgModal();
});
orgFormSecondaryAction?.addEventListener('click', () => {
  resetForm(orgForm, 'Save Organization');
});
orgModalCloseButton?.addEventListener('click', () => {
  closeOrgModal({ reset: true });
});
orgModal?.addEventListener('click', (event) => {
  if (event.target === orgModal) closeOrgModal({ reset: true });
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && orgModal && !orgModal.classList.contains('hidden')) {
    closeOrgModal({ reset: true });
  }
});

loadData();
