let _activeToast = null;
let _activeTimer  = null;

export function showToast(message, undoCallback, duration = 4000) {
  // Remove existing toast immediately
  if (_activeToast) {
    clearTimeout(_activeTimer);
    _activeToast.remove();
    _activeToast = null;
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-msg">${message}</span>
    <button class="toast-undo">Undo</button>
  `;

  toast.querySelector('.toast-undo').addEventListener('click', () => {
    undoCallback();
    dismiss();
  });

  document.body.appendChild(toast);
  _activeToast = toast;

  requestAnimationFrame(() => toast.classList.add('is-visible'));

  _activeTimer = setTimeout(dismiss, duration);

  function dismiss() {
    clearTimeout(_activeTimer);
    toast.classList.remove('is-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    if (_activeToast === toast) _activeToast = null;
  }
}
