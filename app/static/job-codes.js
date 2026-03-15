const toast = document.querySelector('#toast');

const showToast = (message) => {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
};

window.addEventListener('load', () => {
  showToast('Job Codes page ready for CRUD wiring.');
});
