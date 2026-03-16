const form = document.getElementById('account-settings-form');
const avatarPreview = document.getElementById('account-avatar-preview');
const avatarFallback = document.getElementById('account-avatar-fallback');
const displayName = document.getElementById('account-display-name');
const displayUsername = document.getElementById('account-display-username');
const mmUserBadge = document.getElementById('account-mm-user-badge');
const helpText = document.getElementById('account-settings-help');
const submitButton = document.getElementById('account-settings-submit');
const toast = document.getElementById('toast');

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

const renderAvatar = (url) => {
  const cleanUrl = String(url || '').trim();
  if (cleanUrl) {
    avatarPreview.src = cleanUrl;
    avatarPreview.hidden = false;
    avatarFallback.hidden = true;
  } else {
    avatarPreview.hidden = true;
    avatarFallback.hidden = false;
    avatarPreview.removeAttribute('src');
  }
};

const renderAccount = (account) => {
  form.username.value = account.username || '';
  form.first_name.value = account.first_name || '';
  form.last_name.value = account.last_name || '';
  form.email.value = account.email || '';
  form.profile_picture_url.value = account.profile_picture_url || '';
  form.mm_user_account.value = account.mm_user_account ? 'Yes' : 'No';
  displayName.textContent = [account.first_name, account.last_name].filter(Boolean).join(' ') || account.username || 'Signed-in user';
  displayUsername.textContent = account.username ? `@${account.username}` : '';
  mmUserBadge.textContent = account.mm_user_account ? 'MM User Account' : 'Env Bootstrap Account';
  mmUserBadge.classList.toggle('assignment-status-approved', account.mm_user_account);
  mmUserBadge.classList.toggle('assignment-status-in-review', !account.mm_user_account);
  renderAvatar(account.profile_picture_url);

  const editable = Boolean(account.mm_user_account);
  ['first_name', 'last_name', 'email', 'profile_picture_url'].forEach((field) => {
    form[field].disabled = !editable;
  });
  submitButton.disabled = !editable;
  helpText.textContent = editable
    ? 'This account is backed by a Matrix Manager user record, so profile details can be updated here.'
    : 'This signed-in account is using the bootstrap env login, so these profile fields are read-only until you use a Matrix Manager user account.';
};

form.profile_picture_url.addEventListener('input', () => {
  renderAvatar(form.profile_picture_url.value);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const account = await apiFetch('/account-settings-api', {
      method: 'PUT',
      body: JSON.stringify({
        first_name: form.first_name.value.trim() || null,
        last_name: form.last_name.value.trim() || null,
        email: form.email.value.trim() || null,
        profile_picture_url: form.profile_picture_url.value.trim() || null,
      }),
    });
    renderAccount(account);
    showToast('Account settings updated');
  } catch (err) {
    alert(err.message);
  }
});

(async function init() {
  try {
    const account = await apiFetch('/account-settings-api');
    renderAccount(account);
  } catch (err) {
    alert(err.message);
  }
})();
