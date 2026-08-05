// Modal dialog helper for destructive confirmations — checklist §2.2.
// Updated: 2026-08-05 — remove keydown listener on all exit paths.

/** @type {HTMLElement | null} */
let root = null;

/**
 * @param {HTMLElement} modalRoot
 */
export function initModal(modalRoot) {
  root = modalRoot;
}

/**
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmLabel]
 * @param {string} [options.cancelLabel]
 * @param {boolean} [options.destructive]
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title,
  message,
  confirmLabel = 'Delete anyway',
  cancelLabel = 'Cancel',
  destructive = true,
}) {
  if (!root) {
    throw new Error('Modal root not initialized');
  }

  return new Promise((resolve) => {
    root.hidden = false;
    root.innerHTML = `
      <div class="modal-scrim" data-action="cancel"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 class="modal__title" id="modal-title">${escapeHtml(title)}</h2>
        <p class="modal__body">${escapeHtml(message)}</p>
        <div class="modal__actions">
          <button type="button" class="btn btn--secondary" data-action="cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${destructive ? 'btn--danger' : 'btn--primary'}" data-action="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    const cancelButton = root.querySelector('[data-action="cancel"].btn');
    const confirmButton = root.querySelector('[data-action="confirm"]');

    /** @param {boolean} value */
    function finish(value) {
      document.removeEventListener('keydown', onKeyDown);
      root.hidden = true;
      root.innerHTML = '';
      resolve(value);
    }

    root.querySelectorAll('[data-action="cancel"]').forEach((element) => {
      element.addEventListener('click', () => finish(false), { once: true });
    });

    confirmButton?.addEventListener('click', () => finish(true), { once: true });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    cancelButton?.focus();
  });
}

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * @returns {boolean}
 */
export function isModalOpen() {
  return Boolean(root && !root.hidden);
}
