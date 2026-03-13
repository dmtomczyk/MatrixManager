const employeeTable = document.querySelector('#employee-table');
const projectTable = document.querySelector('#project-table');
const assignmentTable = document.querySelector('#assignment-table');
const employeeForm = document.querySelector('#employee-form');
const projectForm = document.querySelector('#project-form');
const assignmentForm = document.querySelector('#assignment-form');
const assignmentEmployeeSelect = document.querySelector('#assignment-employee');
const assignmentProjectSelect = document.querySelector('#assignment-project');
const scheduleEmployeeSelect = document.querySelector('#schedule-employee');
const scheduleProjectSelect = document.querySelector('#schedule-project');
const employeeScheduleList = document.querySelector('#employee-schedule');
const projectScheduleList = document.querySelector('#project-schedule');
const toast = document.querySelector('#toast');

let employees = [];
let projects = [];
let assignments = [];

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
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
};

const resetForm = (form, buttonLabel = 'Save') => {
  form.reset();
  const hidden = form.querySelector('input[type="hidden"][name="entity_id"]');
  if (hidden) hidden.value = '';
  form.querySelector('button[type="submit"]').textContent = buttonLabel;
};

const renderEmployees = () => {
  employeeTable.innerHTML = employees
    .map(
      (emp) => `
      <tr>
        <td>${emp.name}</td>
        <td>${emp.role || ''}</td>
        <td>${emp.location || ''}</td>
        <td>${emp.capacity?.toFixed(1) || '1.0'}</td>
        <td class="actions">
          <button type="button" data-action="edit-employee" data-id="${emp.id}">Edit</button>
          <button type="button" class="secondary" data-action="delete-employee" data-id="${emp.id}">Delete</button>
        </td>
      </tr>`
    )
    .join('');
};

const renderProjects = () => {
  projectTable.innerHTML = projects
    .map((proj) => {
      const dates = [proj.start_date, proj.end_date].filter(Boolean).join(' → ');
      return `
        <tr>
          <td>${proj.name}</td>
          <td>${dates || '—'}</td>
          <td>${proj.description || ''}</td>
          <td class="actions">
            <button type="button" data-action="edit-project" data-id="${proj.id}">Edit</button>
            <button type="button" class="secondary" data-action="delete-project" data-id="${proj.id}">Delete</button>
          </td>
        </tr>`;
    })
    .join('');
};

const renderAssignments = () => {
  assignmentTable.innerHTML = assignments
    .map((asg) => {
      const dates = `${asg.start_date} → ${asg.end_date}`;
      return `
        <tr>
          <td>${asg.employee_name || asg.employee_id}</td>
          <td>${asg.project_name || asg.project_id}</td>
          <td>${dates}</td>
          <td><span class="badge">${Math.round(asg.allocation * 100)}%</span></td>
          <td>${asg.notes || ''}</td>
          <td class="actions">
            <button type="button" data-action="edit-assignment" data-id="${asg.id}">Edit</button>
            <button type="button" class="secondary" data-action="delete-assignment" data-id="${asg.id}">Delete</button>
          </td>
        </tr>`;
    })
    .join('');
};

const updateSelectOptions = () => {
  const buildOptions = (items, placeholder) =>
    [`<option value="">${placeholder}</option>`]
      .concat(items.map((item) => `<option value="${item.id}">${item.name}</option>`))
      .join('');

  const employeeOptions = buildOptions(employees, 'Select employee');
  const projectOptions = buildOptions(projects, 'Select project');

  assignmentEmployeeSelect.innerHTML = employeeOptions;
  scheduleEmployeeSelect.innerHTML = employeeOptions;
  assignmentProjectSelect.innerHTML = projectOptions;
  scheduleProjectSelect.innerHTML = projectOptions;
};

const renderScheduleList = (items, container, labelKey = 'project_name') => {
  if (!items.length) {
    container.innerHTML = '<li>No scheduled items.</li>';
    return;
  }
  container.innerHTML = items
    .map(
      (item) => `
      <li>
        <strong>${item[labelKey] || ''}</strong>
        <div class="subtitle">${item.start_date} → ${item.end_date} · ${Math.round(item.allocation * 100)}%</div>
        <div class="subtitle">${item.notes || ''}</div>
      </li>`
    )
    .join('');
};

const loadEmployees = async () => {
  employees = await apiFetch('/employees');
  renderEmployees();
  updateSelectOptions();
};

const loadProjects = async () => {
  projects = await apiFetch('/projects');
  renderProjects();
  updateSelectOptions();
};

const loadAssignments = async () => {
  assignments = await apiFetch('/assignments');
  renderAssignments();
};

const handleEmployeeSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(employeeForm);
  const payload = {
    name: formData.get('name').trim(),
    role: formData.get('role').trim() || null,
    location: formData.get('location').trim() || null,
    capacity: Number(formData.get('capacity')) || 1,
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
    resetForm(employeeForm, 'Save Employee');
    await loadEmployees();
    await loadAssignments();
  } catch (err) {
    alert(err.message);
  }
};

const handleProjectSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(projectForm);
  const payload = {
    name: formData.get('name').trim(),
    description: formData.get('description').trim() || null,
    start_date: formData.get('start_date') || null,
    end_date: formData.get('end_date') || null,
  };
  const id = formData.get('entity_id');
  try {
    if (id) {
      await apiFetch(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Project updated');
    } else {
      await apiFetch('/projects', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Project added');
    }
    resetForm(projectForm, 'Save Project');
    await loadProjects();
    await loadAssignments();
  } catch (err) {
    alert(err.message);
  }
};

const handleAssignmentSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(assignmentForm);
  const payload = {
    employee_id: Number(formData.get('employee_id')),
    project_id: Number(formData.get('project_id')),
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    allocation: (Number(formData.get('allocation')) || 0) / 100,
    notes: formData.get('notes').trim() || null,
  };
  const id = formData.get('entity_id');
  try {
    if (id) {
      await apiFetch(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Assignment updated');
    } else {
      await apiFetch('/assignments', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Assignment added');
    }
    resetForm(assignmentForm, 'Save Assignment');
    await loadAssignments();
  } catch (err) {
    alert(err.message);
  }
};

const tableClickHandler = (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!id) return;

  if (action === 'delete-employee') return deleteEmployee(id);
  if (action === 'edit-employee') return populateEmployeeForm(id);
  if (action === 'delete-project') return deleteProject(id);
  if (action === 'edit-project') return populateProjectForm(id);
  if (action === 'delete-assignment') return deleteAssignment(id);
  if (action === 'edit-assignment') return populateAssignmentForm(id);
};

const deleteEmployee = async (id) => {
  if (!confirm('Delete this employee and related assignments?')) return;
  try {
    await apiFetch(`/employees/${id}`, { method: 'DELETE' });
    await loadEmployees();
    await loadAssignments();
    showToast('Employee deleted');
  } catch (err) {
    alert(err.message);
  }
};

const deleteProject = async (id) => {
  if (!confirm('Delete this project and related assignments?')) return;
  try {
    await apiFetch(`/projects/${id}`, { method: 'DELETE' });
    await loadProjects();
    await loadAssignments();
    showToast('Project deleted');
  } catch (err) {
    alert(err.message);
  }
};

const deleteAssignment = async (id) => {
  if (!confirm('Remove this assignment?')) return;
  try {
    await apiFetch(`/assignments/${id}`, { method: 'DELETE' });
    await loadAssignments();
    showToast('Assignment removed');
  } catch (err) {
    alert(err.message);
  }
};

const populateEmployeeForm = (id) => {
  const employee = employees.find((e) => e.id === Number(id));
  if (!employee) return;
  employeeForm.name.value = employee.name;
  employeeForm.role.value = employee.role || '';
  employeeForm.location.value = employee.location || '';
  employeeForm.capacity.value = employee.capacity || 1;
  employeeForm.querySelector('input[name="entity_id"]').value = employee.id;
  employeeForm.querySelector('button[type="submit"]').textContent = 'Update Employee';
};

const populateProjectForm = (id) => {
  const project = projects.find((p) => p.id === Number(id));
  if (!project) return;
  projectForm.name.value = project.name;
  projectForm.description.value = project.description || '';
  projectForm.start_date.value = project.start_date || '';
  projectForm.end_date.value = project.end_date || '';
  projectForm.querySelector('input[name="entity_id"]').value = project.id;
  projectForm.querySelector('button[type="submit"]').textContent = 'Update Project';
};

const populateAssignmentForm = (id) => {
  const assignment = assignments.find((a) => a.id === Number(id));
  if (!assignment) return;
  assignmentEmployeeSelect.value = assignment.employee_id;
  assignmentProjectSelect.value = assignment.project_id;
  assignmentForm.start_date.value = assignment.start_date;
  assignmentForm.end_date.value = assignment.end_date;
  assignmentForm.allocation.value = Math.round(assignment.allocation * 100);
  assignmentForm.notes.value = assignment.notes || '';
  assignmentForm.querySelector('input[name="entity_id"]').value = assignment.id;
  assignmentForm.querySelector('button[type="submit"]').textContent = 'Update Assignment';
};

const loadEmployeeSchedule = async (id) => {
  if (!id) {
    employeeScheduleList.innerHTML = '<li>Select an employee</li>';
    return;
  }
  try {
    const data = await apiFetch(`/schedule/employee/${id}`);
    renderScheduleList(data, employeeScheduleList, 'project_name');
  } catch (err) {
    alert(err.message);
  }
};

const loadProjectSchedule = async (id) => {
  if (!id) {
    projectScheduleList.innerHTML = '<li>Select a project</li>';
    return;
  }
  try {
    const data = await apiFetch(`/schedule/project/${id}`);
    renderScheduleList(data, projectScheduleList, 'employee_name');
  } catch (err) {
    alert(err.message);
  }
};

employeeForm.addEventListener('submit', handleEmployeeSubmit);
projectForm.addEventListener('submit', handleProjectSubmit);
assignmentForm.addEventListener('submit', handleAssignmentSubmit);
employeeTable.addEventListener('click', tableClickHandler);
projectTable.addEventListener('click', tableClickHandler);
assignmentTable.addEventListener('click', tableClickHandler);
scheduleEmployeeSelect.addEventListener('change', (event) => loadEmployeeSchedule(event.target.value));
scheduleProjectSelect.addEventListener('change', (event) => loadProjectSchedule(event.target.value));

const init = async () => {
  await Promise.all([loadEmployees(), loadProjects()]);
  await loadAssignments();
};

init();
