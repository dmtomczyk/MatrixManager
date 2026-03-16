const form = document.getElementById('account-settings-form');
const avatarPreview = document.getElementById('account-avatar-preview');
const avatarFallback = document.getElementById('account-avatar-fallback');
const displayName = document.getElementById('account-display-name');
const displayUsername = document.getElementById('account-display-username');
const mmUserBadge = document.getElementById('account-mm-user-badge');
const helpText = document.getElementById('account-settings-help');
const submitButton = document.getElementById('account-settings-submit');
const avatarFileInput = document.getElementById('account-profile-picture-file');
const toast = document.getElementById('toast');

const apiFetch = async (url, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(url, (options.headers || isFormData) ? options : { headers: { 'Content-Type': 'application/json' }, ...options });
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

const notifyIdentityChanged = () => {
  document.dispatchEvent(new CustomEvent('account-identity-changed'));
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
  form.current_password.value = '';
  form.new_password.value = '';
  form.mm_user_account.value = account.mm_user_account ? 'Yes' : 'No';
  displayName.textContent = account.display_name || [account.first_name, account.last_name].filter(Boolean).join(' ') || account.username || 'Signed-in user';
  displayUsername.textContent = account.username ? `@${account.username}` : '';
  mmUserBadge.textContent = account.mm_user_account ? 'MM User Account' : 'Env Bootstrap Account';
  mmUserBadge.classList.toggle('assignment-status-approved', account.mm_user_account);
  mmUserBadge.classList.toggle('assignment-status-in-review', !account.mm_user_account);
  renderAvatar(account.profile_picture_url);

  const editable = Boolean(account.mm_user_account);
  ['first_name', 'last_name', 'email', 'profile_picture_url', 'current_password', 'new_password'].forEach((field) => {
    form[field].disabled = !editable;
  });
  avatarFileInput.disabled = !editable;
  submitButton.disabled = !editable;
  helpText.textContent = editable
    ? 'This account is backed by a Matrix Manager user record, so profile details, password, and profile picture can be updated here.'
    : 'This signed-in account is using the bootstrap env login, so these profile fields are read-only until you use a Matrix Manager user account.';
};

form.profile_picture_url.addEventListener('input', () => {
  renderAvatar(form.profile_picture_url.value);
});

avatarFileInput.addEventListener('change', async () => {
  const file = avatarFileInput.files?.[0];
  if (!file) return;
  if (file.size >= 20 * 1024 * 1024) {
    alert('Profile picture must be smaller than 20MB.');
    avatarFileInput.value = '';
    return;
  }
  const payload = new FormData();
  payload.append('file', file);
  try {
    const account = await apiFetch('/account-settings-api/profile-picture', {
      method: 'POST',
      body: payload,
    });
    renderAccount(account);
    notifyIdentityChanged();
    showToast('Profile picture updated');
    avatarFileInput.value = '';
  } catch (err) {
    alert(err.message);
  }
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
        current_password: form.current_password.value || null,
        new_password: form.new_password.value || null,
      }),
    });
    renderAccount(account);
    notifyIdentityChanged();
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
