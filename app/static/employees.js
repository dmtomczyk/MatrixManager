const employeeOrganizationSelect = document.querySelector('#employee-organization');
const employeeManagerSelect = document.querySelector('#employee-manager');
const employeeTypeSelect = document.querySelector('#employee-type');
const employeeManagerHelp = document.querySelector('#employee-manager-help');
const employeeTable = document.querySelector('#employee-table');
const employeeOrgFilter = document.querySelector('#employee-org-filter');
const employeeForm = document.querySelector('#employee-form');
const employeeFormTitle = document.querySelector('#employee-form-title');
const employeeFormStatus = document.querySelector('#employee-form-status');
const employeeSubmitButton = document.querySelector('#employee-submit-button');
const employeeFormSecondaryAction = document.querySelector('#employee-form-secondary-action');
const employeeNameInput = document.querySelector('#employee-name');
const employeeRoleInput = document.querySelector('#employee-role');
const employeeLocationInput = document.querySelector('#employee-location');
const employeeCapacityInput = document.querySelector('#employee-capacity');
const selectAllEmployeesCheckbox = document.querySelector('#select-all-employees');
const expandAllVisibleButton = document.querySelector('#expand-all-visible');
const collapseAllVisibleButton = document.querySelector('#collapse-all-visible');
const toast = document.querySelector('#toast');

let organizations = [];
let employees = [];
let expandedEmployees = new Set();
let selectedEmployees = new Set();
let activeEmployeeMode = 'create';

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
const getLeaderEmployees = (currentEmployeeId = null) => employees.filter((emp) => emp.employee_type === 'L' && emp.id !== currentEmployeeId).sort((a, b) => a.name.localeCompare(b.name));
const getCurrentEmployeeTypeValue = () => employeeTypeSelect?.value || 'IC';
const getVisibleEmployees = () => {
  const selectedOrg = employeeOrgFilter?.value || '';
  return employees.filter((emp) => !selectedOrg || String(emp.organization_id) === selectedOrg);
};
const buildHierarchy = (items) => {
  const byId = new Map(items.map((employee) => [employee.id, employee]));
  const directReports = new Map(items.map((employee) => [employee.id, []]));
  const roots = [];
  items.forEach((employee) => {
    if (employee.manager_id && byId.has(employee.manager_id)) {
      directReports.get(employee.manager_id).push(employee);
    } else {
      roots.push(employee);
    }
  });
  const sorter = (a, b) => {
    if (a.employee_type !== b.employee_type) return a.employee_type === 'L' ? -1 : 1;
    return a.name.localeCompare(b.name);
  };
  roots.sort(sorter);
  directReports.forEach((list) => list.sort(sorter));
  return { roots, directReports };
};
const getDescendantIds = (employeeId, directReports) => {
  const descendants = [];
  const walk = (id) => {
    const children = directReports.get(id) || [];
    children.forEach((child) => {
      descendants.push(child.id);
      walk(child.id);
    });
  };
  walk(employeeId);
  return descendants;
};
const expandEmployeeBranch = (employeeId, directReports) => {
  expandedEmployees.add(employeeId);
  getDescendantIds(employeeId, directReports).forEach((id) => expandedEmployees.add(id));
};
const collapseEmployeeBranch = (employeeId, directReports) => {
  expandedEmployees.delete(employeeId);
  getDescendantIds(employeeId, directReports).forEach((id) => expandedEmployees.delete(id));
};
const getCurrentEmployeeId = () => Number(employeeForm?.querySelector('input[name="entity_id"]')?.value) || null;
const getEmployeeFormMode = () => {
  if (selectedEmployees.size > 1) return 'bulk';
  if (getCurrentEmployeeId()) return 'edit';
  return 'create';
};
const setEmployeeTypeModeOptions = (mode) => {
  const previousValue = employeeTypeSelect.value;
  const options = mode === 'bulk'
    ? ['<option value="">No change</option>', '<option value="IC">Set to IC</option>', '<option value="L">Set to L</option>']
    : ['<option value="IC">IC</option>', '<option value="L">L</option>'];
  employeeTypeSelect.innerHTML = options.join('');
  if ([...employeeTypeSelect.options].some((option) => option.value === previousValue)) {
    employeeTypeSelect.value = previousValue;
  } else {
    employeeTypeSelect.value = mode === 'bulk' ? '' : 'IC';
  }
};
const updateOrganizationSelect = () => {
  const options = organizations.map((org) => `<option value="${org.id}">${escapeHtml(org.name)}</option>`).join('');
  const previousOrg = employeeOrganizationSelect.value;
  const placeholder = getEmployeeFormMode() === 'bulk' ? 'No change' : 'Select organization';
  employeeOrganizationSelect.innerHTML = `<option value="">${placeholder}</option>${options}`;
  if (previousOrg && organizations.some((org) => String(org.id) === previousOrg)) employeeOrganizationSelect.value = previousOrg;
  const previousFilter = employeeOrgFilter.value;
  employeeOrgFilter.innerHTML = ['<option value="">All organizations</option>'].concat(organizations.map((org) => `<option value="${org.id}">${escapeHtml(org.name)}</option>`)).join('');
  if (previousFilter && organizations.some((org) => String(org.id) === previousFilter)) employeeOrgFilter.value = previousFilter;
};
const updateManagerSelect = (selectedId = '', currentEmployeeId = null) => {
  const leaders = getLeaderEmployees(currentEmployeeId);
  const mode = getEmployeeFormMode();
  const options = mode === 'bulk'
    ? ['<option value="">No change</option>', '<option value="__CLEAR__">Clear manager</option>']
    : ['<option value="">No manager</option>'];
  employeeManagerSelect.innerHTML = options.concat(leaders.map((emp) => `<option value="${emp.id}">${escapeHtml(emp.name + (emp.organization_name ? ` · ${emp.organization_name}` : ''))}</option>`)).join('');
  employeeManagerSelect.value = selectedId && [...employeeManagerSelect.options].some((option) => option.value === String(selectedId)) ? String(selectedId) : '';
  syncManagerFieldState();
};
const syncManagerFieldState = () => {
  const mode = getEmployeeFormMode();
  const isIc = getCurrentEmployeeTypeValue() === 'IC';
  employeeOrganizationSelect.required = mode !== 'bulk';
  const managerRequired = mode !== 'bulk' && isIc;
  employeeManagerSelect.required = managerRequired;
  if (managerRequired) employeeManagerSelect.setAttribute('aria-required', 'true');
  else employeeManagerSelect.removeAttribute('aria-required');
  if (!employeeManagerHelp) return;
  if (mode === 'bulk') {
    employeeManagerHelp.textContent = 'Choose fields to apply to all selected employees. Leave anything blank for no change.';
    return;
  }
  employeeManagerHelp.textContent = isIc ? 'Required for ICs. Optional for leaders without reports above them.' : 'Optional for leaders.';
};
const resetEmployeeFormFields = () => {
  employeeForm.reset();
  employeeForm.querySelector('input[name="entity_id"]').value = '';
  employeeNameInput.disabled = false;
  employeeNameInput.required = true;
  employeeNameInput.placeholder = '';
  employeeRoleInput.placeholder = '';
  employeeLocationInput.placeholder = '';
  employeeCapacityInput.placeholder = '';
  employeeCapacityInput.value = '1';
  setEmployeeTypeModeOptions('create');
  updateOrganizationSelect();
  updateManagerSelect();
  syncManagerFieldState();
};
const syncEmployeeFormMode = () => {
  const mode = getEmployeeFormMode();
  if (activeEmployeeMode === mode) {
    syncManagerFieldState();
    return;
  }
  activeEmployeeMode = mode;
  if (mode === 'bulk') {
    employeeFormTitle.textContent = 'Bulk Edit Selected Employees';
    employeeFormStatus.textContent = `${selectedEmployees.size} employees selected. Name is disabled because it must stay unique per employee.`;
    employeeSubmitButton.textContent = 'Apply to Selected';
    employeeFormSecondaryAction.textContent = 'Clear Selection';
    employeeForm.querySelector('input[name="entity_id"]').value = '';
    employeeNameInput.value = '';
    employeeNameInput.disabled = true;
    employeeNameInput.required = false;
    employeeNameInput.placeholder = 'Disabled for multi-edit';
    employeeRoleInput.value = '';
    employeeRoleInput.placeholder = 'Leave blank for no change';
    employeeLocationInput.value = '';
    employeeLocationInput.placeholder = 'Leave blank for no change';
    employeeCapacityInput.value = '';
    employeeCapacityInput.placeholder = 'Leave blank for no change';
    setEmployeeTypeModeOptions('bulk');
    updateOrganizationSelect();
    updateManagerSelect();
    return;
  }
  if (mode === 'edit') {
    employeeFormTitle.textContent = 'Update Employee';
    employeeFormStatus.textContent = 'Edit one employee using the same form.';
    employeeSubmitButton.textContent = 'Update Employee';
    employeeFormSecondaryAction.textContent = 'Clear Form';
    employeeNameInput.disabled = false;
    employeeNameInput.required = true;
    employeeNameInput.placeholder = '';
    employeeRoleInput.placeholder = '';
    employeeLocationInput.placeholder = '';
    employeeCapacityInput.placeholder = '';
    setEmployeeTypeModeOptions('edit');
    updateOrganizationSelect();
    updateManagerSelect(employeeManagerSelect.value || '', getCurrentEmployeeId());
    return;
  }
  employeeFormTitle.textContent = 'Add Employee';
  employeeFormStatus.textContent = 'Use this form to add a new employee.';
  employeeSubmitButton.textContent = 'Save Employee';
  employeeFormSecondaryAction.textContent = 'Clear Form';
  employeeNameInput.disabled = false;
  employeeNameInput.required = true;
  employeeNameInput.placeholder = '';
  employeeRoleInput.placeholder = '';
  employeeLocationInput.placeholder = '';
  employeeCapacityInput.placeholder = '';
  employeeCapacityInput.value = employeeCapacityInput.value || '1';
  setEmployeeTypeModeOptions('create');
  updateOrganizationSelect();
  updateManagerSelect();
};
const clearEmployeeForm = () => {
  employeeForm.reset();
  employeeForm.querySelector('input[name="entity_id"]').value = '';
  activeEmployeeMode = '';
  syncEmployeeFormMode();
};
const updateBulkSelectionState = () => {
  const visibleEmployeeIds = new Set(getVisibleEmployees().map((employee) => employee.id));
  selectedEmployees = new Set([...selectedEmployees].filter((id) => employees.some((employee) => employee.id === id)));
  const visibleSelectedCount = [...selectedEmployees].filter((id) => visibleEmployeeIds.has(id)).length;
  if (!visibleEmployeeIds.size) {
    selectAllEmployeesCheckbox.checked = false;
    selectAllEmployeesCheckbox.indeterminate = false;
  } else {
    selectAllEmployeesCheckbox.checked = visibleSelectedCount === visibleEmployeeIds.size;
    selectAllEmployeesCheckbox.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < visibleEmployeeIds.size;
  }
  syncEmployeeFormMode();
};
const renderEmployees = () => {
  const filteredEmployees = getVisibleEmployees();
  if (!filteredEmployees.length) {
    employeeTable.innerHTML = '<tr><td colspan="9">No employees match this filter.</td></tr>';
    updateBulkSelectionState();
    return;
  }
  const { roots, directReports } = buildHierarchy(filteredEmployees);
  const rows = [];
  const appendEmployeeRow = (employee, level = 0) => {
    const children = directReports.get(employee.id) || [];
    const hasChildren = children.length > 0;
    const expanded = hasChildren && expandedEmployees.has(employee.id);
    const indent = level * 20;
    rows.push(`
      <tr data-employee-row="${employee.id}" data-level="${level}">
        <td class="checkbox-cell">
          <input type="checkbox" class="employee-select-checkbox" data-id="${employee.id}" ${selectedEmployees.has(employee.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(employee.name)}" />
        </td>
        <td>
          <div class="employee-name-cell" style="padding-left:${indent}px">
            ${hasChildren ? `<button type="button" class="hierarchy-toggle hierarchy-toggle-small" data-action="toggle-employee" data-id="${employee.id}" aria-expanded="${expanded ? 'true' : 'false'}" title="Toggle direct reports"><span class="chevron-mark"></span></button>` : '<span class="hierarchy-leaf hierarchy-leaf-small"></span>'}
            <div class="employee-name-stack">
              <div class="employee-name-row">
                <strong>${escapeHtml(employee.name)}</strong>
                ${hasChildren ? `<button type="button" class="tree-inline-action" data-action="toggle-employee-recursive" data-id="${employee.id}">${expanded ? 'Collapse all' : 'Expand all'}</button>` : ''}
              </div>
              ${hasChildren ? `<span class="employee-subtle">${children.length} direct report${children.length === 1 ? '' : 's'}</span>` : ''}
            </div>
          </div>
        </td>
        <td>${escapeHtml(employee.role || '')}</td>
        <td>${escapeHtml(employee.employee_type || 'IC')}</td>
        <td>${escapeHtml(employee.organization_name || '')}</td>
        <td>${escapeHtml(employee.manager_name || '—')}</td>
        <td>${escapeHtml(employee.location || '')}</td>
        <td>${employee.capacity?.toFixed(1) || '1.0'}</td>
        <td class="actions employee-row-actions">
          <button type="button" class="table-action-button" data-action="edit-employee" data-id="${employee.id}">Edit</button>
          <button type="button" class="table-action-button table-action-button-secondary" data-action="delete-employee" data-id="${employee.id}">Delete</button>
        </td>
      </tr>`);
    if (expanded) {
      children.forEach((child) => appendEmployeeRow(child, level + 1));
    }
  };
  roots.forEach((employee) => appendEmployeeRow(employee, 0));
  employeeTable.innerHTML = rows.join('');
  updateBulkSelectionState();
};
const loadOrganizations = async () => {
  organizations = await apiFetch('/organizations');
  updateOrganizationSelect();
};
const loadEmployees = async () => {
  employees = await apiFetch('/employees');
  const managerIds = new Set(employees.filter((employee) => employee.direct_report_count > 0).map((employee) => employee.id));
  const preservedExpanded = new Set([...expandedEmployees].filter((id) => managerIds.has(id)));
  expandedEmployees = preservedExpanded.size ? preservedExpanded : managerIds;
  selectedEmployees = new Set([...selectedEmployees].filter((id) => employees.some((employee) => employee.id === id)));
  renderEmployees();
  if (getCurrentEmployeeId()) {
    const current = employees.find((employee) => employee.id === getCurrentEmployeeId());
    if (current) populateEmployeeForm(current.id);
    else clearEmployeeForm();
  } else {
    updateManagerSelect(employeeManagerSelect?.value || '', null);
  }
};
const populateEmployeeForm = (id) => {
  const employee = employees.find((e) => e.id === Number(id));
  if (!employee) return;
  selectedEmployees.clear();
  employeeForm.name.value = employee.name;
  employeeForm.role.value = employee.role || '';
  employeeTypeSelect.value = employee.employee_type || 'IC';
  employeeOrganizationSelect.value = employee.organization_id || '';
  employeeForm.location.value = employee.location || '';
  employeeForm.capacity.value = employee.capacity || 1;
  employeeForm.querySelector('input[name="entity_id"]').value = employee.id;
  activeEmployeeMode = '';
  syncEmployeeFormMode();
  updateManagerSelect(employee.manager_id || '', employee.id);
  syncManagerFieldState();
  renderEmployees();
};
const buildBulkUpdatePayload = () => {
  const payload = {};
  if (employeeTypeSelect.value) payload.employee_type = employeeTypeSelect.value;
  if (employeeOrganizationSelect.value) payload.organization_id = Number(employeeOrganizationSelect.value);
  if (employeeManagerSelect.value === '__CLEAR__') payload.manager_id = null;
  else if (employeeManagerSelect.value) payload.manager_id = Number(employeeManagerSelect.value);
  const roleValue = employeeRoleInput.value.trim();
  if (roleValue) payload.role = roleValue;
  const locationValue = employeeLocationInput.value.trim();
  if (locationValue) payload.location = locationValue;
  const capacityValue = employeeCapacityInput.value;
  if (capacityValue) payload.capacity = Number(capacityValue);
  return payload;
};
employeeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const mode = getEmployeeFormMode();
  if (mode === 'bulk') {
    if (selectedEmployees.size < 2) {
      alert('Select at least two employees to use multi-edit.');
      return;
    }
    const payload = buildBulkUpdatePayload();
    if (!Object.keys(payload).length) {
      alert('Choose at least one field to update.');
      return;
    }
    try {
      for (const employeeId of selectedEmployees) {
        await apiFetch(`/employees/${employeeId}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      showToast(`Updated ${selectedEmployees.size} employees`);
      selectedEmployees.clear();
      clearEmployeeForm();
      await loadEmployees();
    } catch (err) {
      alert(err.message);
    }
    return;
  }
  const formData = new FormData(employeeForm);
  const organizationId = Number(formData.get('organization_id'));
  if (!organizationId) return alert('Select an organization for this employee.');
  const payload = {
    name: formData.get('name').trim(),
    role: formData.get('role').trim() || null,
    employee_type: getCurrentEmployeeTypeValue(),
    location: formData.get('location').trim() || null,
    capacity: Number(formData.get('capacity')) || 1,
    organization_id: organizationId,
    manager_id: employeeManagerSelect.value ? Number(employeeManagerSelect.value) : null,
  };
  const id = formData.get('entity_id');
  try {
    if (id) {
      await apiFetch(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Employee updated');
    } else {
      await apiFetch('/employees', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Employee added');
    }
    clearEmployeeForm();
    await loadEmployees();
  } catch (err) {
    alert(err.message);
  }
});
employeeTable.addEventListener('click', async (event) => {
  const checkbox = event.target.closest('.employee-select-checkbox');
  if (checkbox) {
    const employeeId = Number(checkbox.dataset.id);
    if (checkbox.checked) selectedEmployees.add(employeeId);
    else selectedEmployees.delete(employeeId);
    updateBulkSelectionState();
    return;
  }
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'toggle-employee') {
    const employeeId = Number(id);
    if (expandedEmployees.has(employeeId)) expandedEmployees.delete(employeeId);
    else expandedEmployees.add(employeeId);
    renderEmployees();
    return;
  }
  if (action === 'toggle-employee-recursive') {
    const filteredEmployees = getVisibleEmployees();
    const { directReports } = buildHierarchy(filteredEmployees);
    const employeeId = Number(id);
    const currentlyExpanded = expandedEmployees.has(employeeId);
    if (currentlyExpanded) collapseEmployeeBranch(employeeId, directReports);
    else expandEmployeeBranch(employeeId, directReports);
    renderEmployees();
    return;
  }
  if (action === 'edit-employee') populateEmployeeForm(id);
  if (action === 'delete-employee') {
    if (!confirm('Delete this employee and related assignments? Direct reports will become unassigned.')) return;
    await apiFetch(`/employees/${id}`, { method: 'DELETE' });
    selectedEmployees.delete(Number(id));
    if (String(getCurrentEmployeeId()) === String(id)) clearEmployeeForm();
    showToast('Employee deleted');
    await loadEmployees();
  }
});
employeeTable.addEventListener('change', (event) => {
  const checkbox = event.target.closest('.employee-select-checkbox');
  if (!checkbox) return;
  const employeeId = Number(checkbox.dataset.id);
  if (checkbox.checked) selectedEmployees.add(employeeId);
  else selectedEmployees.delete(employeeId);
  updateBulkSelectionState();
});
selectAllEmployeesCheckbox.addEventListener('change', () => {
  const visibleEmployees = getVisibleEmployees();
  if (selectAllEmployeesCheckbox.checked) visibleEmployees.forEach((employee) => selectedEmployees.add(employee.id));
  else visibleEmployees.forEach((employee) => selectedEmployees.delete(employee.id));
  renderEmployees();
});
employeeFormSecondaryAction.addEventListener('click', () => {
  if (getEmployeeFormMode() === 'bulk') {
    selectedEmployees.clear();
    renderEmployees();
    clearEmployeeForm();
    return;
  }
  clearEmployeeForm();
});
expandAllVisibleButton.addEventListener('click', () => {
  const filteredEmployees = getVisibleEmployees();
  const { roots, directReports } = buildHierarchy(filteredEmployees);
  roots.forEach((employee) => expandEmployeeBranch(employee.id, directReports));
  renderEmployees();
});
collapseAllVisibleButton.addEventListener('click', () => {
  const filteredEmployees = getVisibleEmployees();
  const { roots, directReports } = buildHierarchy(filteredEmployees);
  roots.forEach((employee) => collapseEmployeeBranch(employee.id, directReports));
  renderEmployees();
});
employeeTypeSelect.addEventListener('change', syncManagerFieldState);
employeeOrgFilter.addEventListener('change', () => {
  renderEmployees();
});
(async function init() {
  await loadOrganizations();
  clearEmployeeForm();
  await loadEmployees();
  syncManagerFieldState();
})();
