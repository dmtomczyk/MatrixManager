const table = document.getElementById('db-connection-table');
const form = document.getElementById('db-connection-form');
const formTitle = document.getElementById('db-form-title');
const formStatus = document.getElementById('db-form-status');
const typeSelect = document.getElementById('db-type');
const sqliteFields = document.getElementById('sqlite-fields');
const postgresFields = document.getElementById('postgres-fields');
const clearButton = document.getElementById('db-clear-form');
const createButton = document.getElementById('create-db-connection');
const seedDefaultDataButton = document.getElementById('seed-default-data');
const wipeDataDbButton = document.getElementById('wipe-data-db');
const modal = document.getElementById('db-connection-modal');
const modalClose = document.getElementById('db-modal-close');
const toast = document.getElementById('toast');

let connections = [];
let lastFocusedElement = null;

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  if (response.status === 204) return null;
  return response.json();
};
const showToast = (message) => { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); };
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const openModal = () => { lastFocusedElement = document.activeElement; modal.classList.remove('hidden'); document.body.classList.add('modal-open'); setTimeout(() => document.getElementById('db-name')?.focus(), 0); };
const closeModal = ({ reset = false, restoreFocus = true } = {}) => { modal.classList.add('hidden'); document.body.classList.remove('modal-open'); if (reset) resetForm(); if (restoreFocus && lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus(); };
const syncTypeFields = () => {
  const type = typeSelect.value; sqliteFields.classList.toggle('hidden', type !== 'sqlite'); postgresFields.classList.toggle('hidden', type !== 'postgresql');
  const sqliteRequired = type === 'sqlite'; document.getElementById('db-sqlite-path').required = sqliteRequired; document.getElementById('db-sqlite-path-label').classList.toggle('required-field', sqliteRequired);
  ['host', 'database', 'username'].forEach((field) => { const input = document.getElementById(`db-postgres-${field}`); const label = document.getElementById(`db-postgres-${field}-label`); const required = type === 'postgresql'; input.required = required; label.classList.toggle('required-field', required); });
};
const resetForm = () => {
  form.reset(); form.entity_id.value = ''; formTitle.textContent = 'Add Connection'; formStatus.textContent = 'Create or update one database connection at a time.'; document.getElementById('db-submit').textContent = 'Save Connection'; document.getElementById('db-postgres-port').value = '5432'; document.getElementById('db-postgres-sslmode').value = 'prefer'; typeSelect.value = 'sqlite'; syncTypeFields();
};
const renderTable = () => {
  if (!connections.length) { table.innerHTML = '<tr><td colspan="5">No database connections configured yet.</td></tr>'; return; }
  table.innerHTML = connections.map((connection) => `
    <tr>
      <td><strong>${escapeHtml(connection.name)}</strong></td>
      <td>${escapeHtml(connection.db_type)}</td>
      <td>${escapeHtml(connection.connection_summary)}</td>
      <td>${connection.is_active ? '<span class="badge">Active</span>' : '<span class="muted">Inactive</span>'}</td>
      <td class="actions">
        ${connection.is_active ? '' : `<button type="button" class="table-action-button" data-action="activate" data-id="${connection.id}">Activate</button>`}
        <button type="button" class="table-action-button" data-action="edit" data-id="${connection.id}">Edit</button>
        ${connection.is_active ? '' : `<button type="button" class="table-action-button table-action-button-secondary" data-action="delete" data-id="${connection.id}">Delete</button>`}
      </td>
    </tr>`).join('');
};
const loadConnections = async () => { connections = await apiFetch('/db-connections'); renderTable(); };
const populateForm = (id) => { const connection = connections.find((item) => item.id === Number(id)); if (!connection) return; form.entity_id.value = connection.id; form.name.value = connection.name; typeSelect.value = connection.db_type; form.sqlite_path.value = connection.sqlite_path || ''; form.postgres_host.value = connection.postgres_host || ''; form.postgres_port.value = connection.postgres_port || 5432; form.postgres_database.value = connection.postgres_database || ''; form.postgres_username.value = connection.postgres_username || ''; form.postgres_password.value = connection.postgres_password || ''; form.postgres_sslmode.value = connection.postgres_sslmode || 'prefer'; formTitle.textContent = 'Update Connection'; formStatus.textContent = 'Update one database connection at a time.'; document.getElementById('db-submit').textContent = 'Update Connection'; syncTypeFields(); openModal(); };
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = { name: String(formData.get('name') || '').trim(), db_type: formData.get('db_type'), sqlite_path: String(formData.get('sqlite_path') || '').trim() || null, postgres_host: String(formData.get('postgres_host') || '').trim() || null, postgres_port: Number(formData.get('postgres_port')) || 5432, postgres_database: String(formData.get('postgres_database') || '').trim() || null, postgres_username: String(formData.get('postgres_username') || '').trim() || null, postgres_password: formData.get('postgres_password') || null, postgres_sslmode: String(formData.get('postgres_sslmode') || '').trim() || 'prefer' };
  const id = formData.get('entity_id');
  try { if (id) { await apiFetch(`/db-connections/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); showToast('Connection updated'); } else { await apiFetch('/db-connections', { method: 'POST', body: JSON.stringify(payload) }); showToast('Connection added'); } closeModal({ reset: true, restoreFocus: false }); await loadConnections(); } catch (err) { alert(err.message); }
});
table.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]'); if (!button) return; const { action, id } = button.dataset;
  try {
    if (action === 'edit') return populateForm(id);
    if (action === 'activate') { await apiFetch(`/db-connections/${id}/activate`, { method: 'POST' }); showToast('Connection activated'); await loadConnections(); }
    if (action === 'delete') { if (!confirm('Delete this database connection?')) return; await apiFetch(`/db-connections/${id}`, { method: 'DELETE' }); showToast('Connection deleted'); await loadConnections(); }
  } catch (err) { alert(err.message); }
});
typeSelect.addEventListener('change', syncTypeFields);
createButton?.addEventListener('click', () => { resetForm(); openModal(); });
seedDefaultDataButton?.addEventListener('click', async () => {
  if (!confirm('Re-run the default starter seed data in the active data DB? Existing matching starter records may be updated or recreated.')) return;
  try {
    await apiFetch('/seed-default-data', { method: 'POST' });
    showToast('Default data seeded');
  } catch (err) {
    alert(err.message);
  }
});
wipeDataDbButton?.addEventListener('click', async () => {
  const confirmation = window.prompt('This will permanently erase all rows from the active data DB tables, but will keep the database and schema. Type WIPE DATA DB to continue.');
  if (confirmation === null) return;
  try {
    await apiFetch('/db-management/wipe-data-db', { method: 'POST', body: JSON.stringify({ confirmation_text: confirmation }) });
    showToast('Data DB tables emptied');
  } catch (err) {
    alert(err.message);
  }
});
clearButton.addEventListener('click', resetForm);
modalClose?.addEventListener('click', () => closeModal({ reset: true }));
modal?.addEventListener('click', (event) => { if (event.target === modal) closeModal({ reset: true }); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeModal({ reset: true }); });
resetForm();
loadConnections().catch((err) => alert(err.message));
