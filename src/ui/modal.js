// Modal dialog helper for destructive confirmations — checklist §2.2.
// Updated: 2026-08-05 — spin link results dialog with open-link actions.

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

/**
 * @typedef {{ slotTitle: string, label: string, url: string }} LinkResultEntry
 */

/**
 * @param {LinkResultEntry[]} results
 * @returns {Promise<void>}
 */
export function showLinkResultsDialog(results) {
  if (!root || results.length === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    root.hidden = false;
    root.innerHTML = `
      <div class="modal-scrim" data-action="dismiss-link-results"></div>
      <div class="modal modal--link-results" role="dialog" aria-modal="true" aria-labelledby="link-results-title">
        <h2 class="modal__title" id="link-results-title">Spin results</h2>
        <p class="modal__body">Open a linked result below, or close when you are done.</p>
        <ul class="link-results-list">
          ${results
            .map(
              (result, index) => `
            <li class="link-results-list__item">
              <div class="link-results-list__copy">
                <span class="link-results-list__slot">${escapeHtml(result.slotTitle)}</span>
                <span class="link-results-list__label">${escapeHtml(result.label)}</span>
              </div>
              <a
                class="btn btn--primary link-results-list__open"
                href="${escapeAttr(result.url)}"
                target="_blank"
                rel="noopener noreferrer"
                data-action="open-link-result"
                data-result-index="${index}"
              >Open link</a>
            </li>`,
            )
            .join('')}
        </ul>
        <div class="modal__actions">
          <button type="button" class="btn btn--secondary" data-action="dismiss-link-results">Close</button>
        </div>
      </div>
    `;

  /** @param {boolean} [shouldResolve] */
    function finish(shouldResolve = true) {
      document.removeEventListener('keydown', onKeyDown);
      root.hidden = true;
      root.innerHTML = '';
      if (shouldResolve) {
        resolve();
      }
    }

    root.querySelectorAll('[data-action="dismiss-link-results"]').forEach((element) => {
      element.addEventListener('click', () => finish(), { once: true });
    });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    root.querySelector('[data-action="dismiss-link-results"].btn')?.focus();
  });
}

/** @param {string} value */
function escapeAttr(value) {
  return escapeHtml(value);
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
