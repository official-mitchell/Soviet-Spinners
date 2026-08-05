// Tracks inline edits and scroll position across re-renders — review follow-up.
// Updated: 2026-08-05 — defer render while editing manual CSV textarea.

/**
 * @returns {boolean}
 */
export function shouldDeferRender() {
  return (
    hasInlineOptionEdit() ||
    hasFocusedSlotTitleEdit() ||
    hasFocusedTotalRoundsEdit() ||
    hasFocusedManualCsvEdit()
  );
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
export function hasFocusedTotalRoundsEdit() {
  const active = document.activeElement;
  return active instanceof HTMLInputElement && active.dataset.action === 'edit-total-rounds';
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
 * @returns {boolean}
 */
export function hasFocusedManualCsvEdit() {
  const active = document.activeElement;
  return active instanceof HTMLTextAreaElement && active.dataset.action === 'manual-csv-input';
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
