const userTable = document.getElementById('user-table');
const userForm = document.getElementById('user-form');
const resetButton = document.getElementById('user-form-reset');
const userEmployeeSelect = document.getElementById('user-employee');
const toast = document.getElementById('toast');

let users = [];
let employees = [];

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
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

const renderEmployeeOptions = () => {
  userEmployeeSelect.innerHTML = ['<option value="">No linked employee</option>']
    .concat(employees.map((employee) => `<option value="${employee.id}">${employee.name}</option>`))
    .join('');
};

const resetForm = () => {
  userForm.reset();
  userForm.entity_id.value = '';
  userForm.is_active.checked = true;
  userForm.username.disabled = false;
  userEmployeeSelect.value = '';
  document.getElementById('user-form-title').textContent = 'Add User';
  userForm.querySelector('button[type="submit"]').textContent = 'Save User';
};

const renderUsers = () => {
  if (!users.length) {
    userTable.innerHTML = '<tr><td colspan="5">No database users created yet.</td></tr>';
    return;
  }
  userTable.innerHTML = users.map((user) => `
    <tr>
      <td>${user.username}</td>
      <td>${user.employee_name || '—'}</td>
      <td>${user.is_admin ? 'Yes' : 'No'}</td>
      <td>${user.is_active ? 'Yes' : 'No'}</td>
      <td class="actions">
        <button type="button" data-action="edit" data-id="${user.id}">Edit</button>
        <button type="button" class="secondary" data-action="delete" data-id="${user.id}">Delete</button>
      </td>
    </tr>
  `).join('');
};

const loadUsers = async () => {
  users = await apiFetch('/users-api');
  renderUsers();
};

const loadEmployees = async () => {
  employees = await apiFetch('/employees');
  renderEmployeeOptions();
};

userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(userForm);
  const id = formData.get('entity_id');
  try {
    if (id) {
      const payload = {
        employee_id: formData.get('employee_id') ? Number(formData.get('employee_id')) : null,
        is_admin: userForm.is_admin.checked,
        is_active: userForm.is_active.checked,
      };
      if (formData.get('password')) payload.password = formData.get('password');
      await apiFetch(`/users-api/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('User updated');
    } else {
      await apiFetch('/users-api', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.get('username').trim(),
          password: formData.get('password'),
          employee_id: formData.get('employee_id') ? Number(formData.get('employee_id')) : null,
          is_admin: userForm.is_admin.checked,
        }),
      });
      showToast('User created');
    }
    resetForm();
    await loadUsers();
  } catch (err) {
    alert(err.message);
  }
});

userTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const user = users.find((entry) => entry.id === Number(button.dataset.id));
  if (!user) return;
  try {
    if (button.dataset.action === 'edit') {
      userForm.entity_id.value = user.id;
      userForm.username.value = user.username;
      userForm.username.disabled = true;
      userForm.password.value = '';
      userEmployeeSelect.value = user.employee_id || '';
      userForm.is_admin.checked = user.is_admin;
      userForm.is_active.checked = user.is_active;
      document.getElementById('user-form-title').textContent = 'Update User';
      userForm.querySelector('button[type="submit"]').textContent = 'Update User';
    }
    if (button.dataset.action === 'delete') {
      if (!confirm(`Delete user ${user.username}?`)) return;
      await apiFetch(`/users-api/${user.id}`, { method: 'DELETE' });
      showToast('User deleted');
      await loadUsers();
    }
  } catch (err) {
    alert(err.message);
  }
});

resetButton.addEventListener('click', resetForm);

(async function init() {
  await loadEmployees();
  resetForm();
  await loadUsers();
})().catch((err) => alert(err.message));
