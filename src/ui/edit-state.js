// Tracks inline edits and scroll position across re-renders — review follow-up.
// Created: 2026-08-05.

/**
 * @returns {boolean}
 */
export function shouldDeferRender() {
  return hasInlineOptionEdit() || hasFocusedSlotTitleEdit();
}

/**
 * @returns {boolean}
 */
export function hasInlineOptionEdit() {
  return document.querySelector('.option-row__label-input') instanceof HTMLInputElement;
}

/**
 * @returns {boolean}
 */
export function hasFocusedSlotTitleEdit() {
  const active = document.activeElement;
  return (
    active instanceof HTMLInputElement &&
    active.dataset.action === 'edit-slot-title'
  );
}

/**
 * @returns {{ left: number } | null}
 */
export function captureScrollState() {
  const editors = document.getElementById('slot-editors');
  if (!(editors instanceof HTMLElement)) {
    return null;
  }

  return { left: editors.scrollLeft };
}

/**
 * @param {{ left: number } | null} scrollState
 */
export function restoreScrollState(scrollState) {
  if (!scrollState) {
    return;
  }

  const editors = document.getElementById('slot-editors');
  if (editors instanceof HTMLElement) {
    editors.scrollLeft = scrollState.left;
  }
}

/**
 * @param {() => void} renderFn
 * @param {() => boolean} isDeferred
 */
export function flushDeferredRender(renderFn, isDeferred = shouldDeferRender) {
  requestAnimationFrame(() => {
    if (!isDeferred()) {
      renderFn();
    }
  });
}
