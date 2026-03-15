const runtimeSummary = document.getElementById('runtime-summary');
const runtimeServices = document.getElementById('runtime-services');
const runtimeErrorTable = document.getElementById('runtime-error-table');
const refreshButton = document.getElementById('runtime-refresh');
const toast = document.getElementById('toast');

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  return response.json();
};

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const showToast = (message) => { if (!toast) return; toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); };
const formatDate = (value) => { try { return new Date(value).toLocaleString(); } catch { return value; } };

const stateBadgeClass = (state = '') => {
  const normalized = state.toLowerCase();
  if (normalized.includes('running') || normalized.includes('healthy')) return 'assignment-status-approved';
  if (normalized.includes('starting') || normalized.includes('created') || normalized.includes('restarting')) return 'assignment-status-in-review';
  if (normalized.includes('exited') || normalized.includes('dead') || normalized.includes('error')) return 'assignment-status-denied';
  return '';
};

const renderOverview = (overview) => {
  runtimeSummary.innerHTML = `
    <article class="flow-node">
      <span class="flow-kicker">Environment</span>
      <strong>${escapeHtml(overview.runtime_environment)}</strong>
      <span>Install mode: ${escapeHtml(overview.install_mode)}</span>
      <span>Active DB: ${escapeHtml(overview.active_db_type)}</span>
    </article>
    <article class="flow-node">
      <span class="flow-kicker">Docker</span>
      <strong>${overview.docker_available ? 'Available' : 'Unavailable'}</strong>
      <span>${escapeHtml(overview.docker_error || 'Docker Compose status read succeeded')}</span>
    </article>
  `;
  if (!overview.services.length) {
    runtimeServices.innerHTML = '<article class="flow-node"><strong>No service data</strong><span>Docker status was unavailable or no Compose services were returned.</span></article>';
    return;
  }
  runtimeServices.innerHTML = overview.services.map((service) => `
    <article class="flow-node">
      <span class="flow-kicker">Service</span>
      <strong>${escapeHtml(service.name)}</strong>
      <span class="badge ${stateBadgeClass(service.state || service.health || '')}">${escapeHtml(service.state || 'unknown')}</span>
      <span>${escapeHtml(service.health || service.status_text || 'No extra status reported')}</span>
    </article>
  `).join('');
};

const renderErrors = (items) => {
  if (!items.length) {
    runtimeErrorTable.innerHTML = '<tr><td colspan="5">No runtime errors captured.</td></tr>';
    return;
  }
  runtimeErrorTable.innerHTML = items.map((item) => `
    <tr>
      <td>${escapeHtml(formatDate(item.occurred_at))}</td>
      <td>${escapeHtml(item.method || '')} ${escapeHtml(item.path || '—')}</td>
      <td>${escapeHtml(item.username || '—')}</td>
      <td><span class="badge assignment-status-denied">${escapeHtml(item.error_type)}</span></td>
      <td><details><summary>${escapeHtml(item.message || '—')}</summary><pre class="small-pre">${escapeHtml(item.traceback_text || '')}</pre></details></td>
    </tr>
  `).join('');
};

const loadRuntime = async () => {
  const [overview, errors] = await Promise.all([apiFetch('/runtime-overview'), apiFetch('/runtime-errors')]);
  renderOverview(overview);
  renderErrors(errors);
};

refreshButton.addEventListener('click', async () => {
  try {
    await loadRuntime();
    showToast('Runtime status refreshed');
  } catch (err) {
    alert(err.message);
  }
});

loadRuntime().catch((err) => alert(err.message));
