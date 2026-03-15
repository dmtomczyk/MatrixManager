const runtimeSummary = document.getElementById('runtime-summary');
const runtimeRecommendations = document.getElementById('runtime-recommendations');
const runtimeServices = document.getElementById('runtime-services');
const runtimeVersionsTable = document.getElementById('runtime-versions-table');
const runtimeDbTable = document.getElementById('runtime-db-table');
const runtimeSnapshotTable = document.getElementById('runtime-snapshot-table');
const runtimeErrorGroupTable = document.getElementById('runtime-error-group-table');
const runtimeErrorTable = document.getElementById('runtime-error-table');
const refreshButton = document.getElementById('runtime-refresh');
const copyDiagnosticsButton = document.getElementById('runtime-copy-diagnostics');
const pollingButton = document.getElementById('runtime-toggle-polling');
const lastUpdated = document.getElementById('runtime-last-updated');
const snapshotFilter = document.getElementById('runtime-snapshot-filter');
const errorGroupFilter = document.getElementById('runtime-error-group-filter');
const errorFilter = document.getElementById('runtime-error-filter');
const toast = document.getElementById('toast');

let pollingEnabled = true;
let pollingHandle = null;
let latestDiagnostics = null;
const POLL_MS = 15000;

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
  if (normalized.includes('ok') || normalized.includes('running') || normalized.includes('healthy')) return 'assignment-status-approved';
  if (normalized.includes('starting') || normalized.includes('created') || normalized.includes('restarting') || normalized.includes('degraded') || normalized.includes('unknown')) return 'assignment-status-in-review';
  if (normalized.includes('exited') || normalized.includes('dead') || normalized.includes('error') || normalized.includes('fail')) return 'assignment-status-denied';
  return '';
};

const summaryToneClass = (status = '') => {
  const normalized = status.toLowerCase();
  if (normalized === 'ok') return 'runtime-summary-ok';
  if (normalized === 'error') return 'runtime-summary-error';
  return 'runtime-summary-warn';
};

const renderOverview = (overview) => {
  runtimeSummary.innerHTML = `
    <article class="flow-node runtime-summary-card ${summaryToneClass(overview.overall_status)}">
      <span class="flow-kicker">Overall</span>
      <strong><span class="badge ${stateBadgeClass(overview.overall_status)}">${escapeHtml(overview.overall_status)}</span></strong>
      <span>Checked: ${escapeHtml(formatDate(overview.checked_at))}</span>
      <span>Recent runtime errors (1h): ${escapeHtml(String(overview.recent_error_count || 0))}</span>
    </article>
    <article class="flow-node runtime-summary-card ${summaryToneClass(overview.control_db_status)}">
      <span class="flow-kicker">Control DB</span>
      <strong><span class="badge ${stateBadgeClass(overview.control_db_status)}">${escapeHtml(overview.control_db_status)}</span></strong>
      <span>${escapeHtml(overview.control_db_detail || 'No detail')}</span>
    </article>
    <article class="flow-node runtime-summary-card ${summaryToneClass(overview.active_data_db_status)}">
      <span class="flow-kicker">Active Data DB</span>
      <strong><span class="badge ${stateBadgeClass(overview.active_data_db_status)}">${escapeHtml(overview.active_data_db_status)}</span></strong>
      <span>${escapeHtml(overview.active_data_db_detail || 'No detail')}</span>
    </article>
    <article class="flow-node runtime-summary-card ${summaryToneClass(overview.docker_available ? 'ok' : (overview.docker_error ? 'degraded' : 'unknown'))}">
      <span class="flow-kicker">Docker</span>
      <strong>${overview.docker_available ? 'Available' : 'Unavailable'}</strong>
      <span>${escapeHtml(overview.docker_error || 'Docker Compose status read succeeded')}</span>
    </article>
    <article class="flow-node runtime-summary-card runtime-summary-neutral">
      <span class="flow-kicker">Environment</span>
      <strong>${escapeHtml(overview.runtime_environment)}</strong>
      <span>Install mode: ${escapeHtml(overview.install_mode)}</span>
      <span>Active DB: ${escapeHtml(overview.active_db_type)}</span>
    </article>
  `;

  runtimeRecommendations.innerHTML = (overview.recommended_actions || []).length
    ? `<article class="panel runtime-recommendations-panel"><strong>Recommended Actions</strong><ul>${overview.recommended_actions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article>`
    : '<article class="panel runtime-recommendations-panel"><strong>Recommended Actions</strong><p class="muted">No immediate action items. Current probes look healthy.</p></article>';

  if (!overview.services.length) {
    runtimeServices.innerHTML = '<article class="flow-node"><strong>No service data</strong><span>Docker status was unavailable or no Compose services were returned.</span></article>';
  } else {
    runtimeServices.innerHTML = overview.services.map((service) => `
      <article class="flow-node">
        <span class="flow-kicker">Service</span>
        <strong>${escapeHtml(service.name)}</strong>
        <span class="badge ${stateBadgeClass(service.state || service.health || '')}">${escapeHtml(service.state || 'unknown')}</span>
        <span>${escapeHtml(service.health || service.status_text || 'No extra status reported')}</span>
        <span>Image: ${escapeHtml(service.image || '—')}</span>
        <span>Uptime: ${escapeHtml(service.uptime || '—')}</span>
        <span>Restart count: ${escapeHtml(service.restart_count != null ? String(service.restart_count) : '—')}</span>
      </article>
    `).join('');
  }

  runtimeVersionsTable.innerHTML = (overview.installed_versions || []).length
    ? overview.installed_versions.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.version)}</td>
        <td>${escapeHtml(item.source || '—')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="3">No version information available.</td></tr>';

  if (!overview.db_connections.length) {
    runtimeDbTable.innerHTML = '<tr><td colspan="6">No database connections available.</td></tr>';
  } else {
    runtimeDbTable.innerHTML = overview.db_connections.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.db_type)}</td>
        <td>${item.is_active ? 'Yes' : 'No'}</td>
        <td><span class="badge ${stateBadgeClass(item.status)}">${escapeHtml(item.status)}</span></td>
        <td>${item.latency_ms != null ? `${escapeHtml(String(item.latency_ms))} ms` : '—'}</td>
        <td>${escapeHtml(item.detail || '—')}</td>
      </tr>
    `).join('');
  }
};

const renderSnapshots = (items) => {
  const filtered = items.filter((item) => snapshotFilter.value === 'all' || item.overall_status === snapshotFilter.value);
  if (!filtered.length) {
    runtimeSnapshotTable.innerHTML = '<tr><td colspan="6">No health snapshots match this filter.</td></tr>';
    return;
  }
  runtimeSnapshotTable.innerHTML = filtered.map((item) => `
    <tr>
      <td>${escapeHtml(formatDate(item.occurred_at))}</td>
      <td><span class="badge ${stateBadgeClass(item.overall_status)}">${escapeHtml(item.overall_status)}</span></td>
      <td><span class="badge ${stateBadgeClass(item.control_db_status)}">${escapeHtml(item.control_db_status)}</span></td>
      <td><span class="badge ${stateBadgeClass(item.active_data_db_status)}">${escapeHtml(item.active_data_db_status)}</span></td>
      <td><span class="badge ${stateBadgeClass(item.docker_status)}">${escapeHtml(item.docker_status)}</span></td>
      <td>${escapeHtml(String(item.error_count_last_hour || 0))}</td>
    </tr>
  `).join('');
};

const renderErrorGroups = (items) => {
  const minCount = Number(errorGroupFilter.value || 1);
  const filtered = items.filter((item) => Number(item.count || 0) >= minCount);
  if (!filtered.length) {
    runtimeErrorGroupTable.innerHTML = '<tr><td colspan="5">No recurring runtime error groups match this filter.</td></tr>';
    return;
  }
  runtimeErrorGroupTable.innerHTML = filtered.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.error_type)}</strong><div class="muted small-text">${escapeHtml(item.message)}</div></td>
      <td><span class="badge assignment-status-denied">${escapeHtml(String(item.count))}</span></td>
      <td>${escapeHtml(formatDate(item.last_seen_at))}</td>
      <td>${escapeHtml(item.sample_path || '—')}</td>
      <td>${escapeHtml(item.sample_username || '—')}</td>
    </tr>
  `).join('');
};

const renderErrors = (items) => {
  const query = (errorFilter.value || '').trim().toLowerCase();
  const filtered = !query ? items : items.filter((item) => [item.path, item.username, item.error_type, item.message, item.method].join(' ').toLowerCase().includes(query));
  if (!filtered.length) {
    runtimeErrorTable.innerHTML = '<tr><td colspan="5">No runtime errors match this filter.</td></tr>';
    return;
  }
  runtimeErrorTable.innerHTML = filtered.map((item) => `
    <tr>
      <td>${escapeHtml(formatDate(item.occurred_at))}</td>
      <td>${escapeHtml(item.method || '')} ${escapeHtml(item.path || '—')}</td>
      <td>${escapeHtml(item.username || '—')}</td>
      <td><span class="badge assignment-status-denied">${escapeHtml(item.error_type)}</span></td>
      <td><details><summary>${escapeHtml(item.message || '—')}</summary><pre class="small-pre">${escapeHtml(item.traceback_text || '')}</pre></details></td>
    </tr>
  `).join('');
};

const rerenderTables = () => {
  if (!latestDiagnostics) return;
  renderSnapshots(latestDiagnostics.snapshots || []);
  renderErrorGroups(latestDiagnostics.errorGroups || []);
  renderErrors(latestDiagnostics.errors || []);
};

const loadRuntime = async () => {
  const [overview, errors, errorGroups, snapshots] = await Promise.all([
    apiFetch('/health/details'),
    apiFetch('/runtime-errors'),
    apiFetch('/runtime-error-groups'),
    apiFetch('/runtime-health-snapshots'),
  ]);
  latestDiagnostics = { overview, errors, errorGroups, snapshots, exportedAt: new Date().toISOString() };
  renderOverview(overview);
  rerenderTables();
  lastUpdated.textContent = `Last updated ${formatDate(new Date().toISOString())}`;
};

const startPolling = () => {
  if (pollingHandle) clearInterval(pollingHandle);
  if (!pollingEnabled) return;
  pollingHandle = setInterval(() => {
    loadRuntime().catch(() => {});
  }, POLL_MS);
};

copyDiagnosticsButton.addEventListener('click', async () => {
  try {
    if (!latestDiagnostics) await loadRuntime();
    const text = JSON.stringify(latestDiagnostics, null, 2);
    await navigator.clipboard.writeText(text);
    showToast('Diagnostics copied');
  } catch (err) {
    alert(err.message || 'Failed to copy diagnostics');
  }
});

snapshotFilter.addEventListener('change', rerenderTables);
errorGroupFilter.addEventListener('change', rerenderTables);
errorFilter.addEventListener('input', rerenderTables);

pollingButton.addEventListener('click', () => {
  pollingEnabled = !pollingEnabled;
  pollingButton.textContent = pollingEnabled ? 'Pause Auto-Refresh' : 'Resume Auto-Refresh';
  startPolling();
  showToast(pollingEnabled ? 'Auto-refresh enabled' : 'Auto-refresh paused');
});

refreshButton.addEventListener('click', async () => {
  try {
    await loadRuntime();
    showToast('Runtime status refreshed');
  } catch (err) {
    alert(err.message);
  }
});

loadRuntime().then(startPolling).catch((err) => alert(err.message));
