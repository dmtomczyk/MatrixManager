const inboxList = document.querySelector('#inbox-list');
const toast = document.querySelector('#toast');
const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('matrixmanager-sync') : null;

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

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const notifyAccountCountsChanged = () => {
  document.dispatchEvent(new CustomEvent('account-notifications-changed'));
};

const broadcastAssignmentsChanged = () => {
  const payload = { type: 'assignments-changed', at: Date.now() };
  if (syncChannel) syncChannel.postMessage(payload);
  try {
    localStorage.setItem('matrixmanager-assignments-changed', JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
};

const renderInbox = (items) => {
  if (!items.length) {
    inboxList.innerHTML = '<div class="panel"><p class="muted">No notifications yet.</p></div>';
    return;
  }
  inboxList.innerHTML = items.map((item) => `
    <article class="panel inbox-item ${item.is_read ? 'inbox-item-read' : 'inbox-item-unread'}">
      <div class="inbox-item-top">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="muted small-text">${escapeHtml(formatDate(item.created_at))}</p>
        </div>
        <div class="panel-actions-row">
          ${item.payload?.kind === 'assignment_review' && item.is_actionable ? `<button type="button" class="table-action-button table-action-button-approve" data-action="approve" data-id="${item.id}">Approve</button><button type="button" class="table-action-button table-action-button-deny" data-action="deny" data-id="${item.id}">Deny</button>` : ''}
          ${item.is_read ? '' : `<button type="button" data-action="mark-read" data-id="${item.id}">Mark read</button>`}
          <button type="button" class="secondary" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </div>
      <p>${escapeHtml(item.message)}</p>
    </article>
  `).join('');
};

const loadInbox = async () => {
  renderInbox(await apiFetch('/inbox-api'));
};

inboxList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === 'approve') {
      await apiFetch(`/inbox-api/${id}/approve`, { method: 'POST' });
      showToast('Assignment approved');
      broadcastAssignmentsChanged();
    }
    if (action === 'deny') {
      await apiFetch(`/inbox-api/${id}/deny`, { method: 'POST' });
      showToast('Assignment denied');
      broadcastAssignmentsChanged();
    }
    if (action === 'mark-read') {
      await apiFetch(`/inbox-api/${id}/read`, { method: 'POST' });
      showToast('Notification marked read');
    }
    if (action === 'delete') {
      await apiFetch(`/inbox-api/${id}`, { method: 'DELETE' });
      showToast('Notification deleted');
    }
    await loadInbox();
    notifyAccountCountsChanged();
  } catch (err) {
    alert(err.message);
  }
});

loadInbox().catch((err) => alert(err.message));
