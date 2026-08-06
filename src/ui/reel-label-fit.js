// Shrinks reel drum option labels when they overflow their card cell.
// Updated: 2026-08-06 — initial fit-to-cell measurement and resize hook.

const MIN_FONT_PX = 9;

/**
 * @param {HTMLElement} label
 * @param {HTMLElement} cell
 */
function labelFitsCell(label, cell) {
  const cellStyle = getComputedStyle(cell);
  const padX = parseFloat(cellStyle.paddingLeft) + parseFloat(cellStyle.paddingRight);
  const padY = parseFloat(cellStyle.paddingTop) + parseFloat(cellStyle.paddingBottom);
  const maxWidth = cell.clientWidth - padX;
  const maxHeight = cell.clientHeight - padY;

  return label.scrollWidth <= maxWidth + 1 && label.scrollHeight <= maxHeight + 1;
}

/**
 * @param {HTMLElement} label
 * @param {HTMLElement} cell
 */
function fitLabelToCell(label, cell) {
  label.style.fontSize = '';

  const defaultSize = parseFloat(getComputedStyle(label).fontSize);
  if (!Number.isFinite(defaultSize) || defaultSize <= MIN_FONT_PX) {
    return;
  }

  if (labelFitsCell(label, cell)) {
    label.removeAttribute('data-fit-shrunk');
    return;
  }

  let low = MIN_FONT_PX;
  let high = Math.floor(defaultSize);
  let best = MIN_FONT_PX;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    label.style.fontSize = `${mid}px`;

    if (labelFitsCell(label, cell)) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best >= defaultSize - 0.5) {
    label.style.fontSize = '';
    label.removeAttribute('data-fit-shrunk');
    return;
  }

  label.style.fontSize = `${best}px`;
  label.dataset.fitShrunk = 'true';
}

/**
 * @param {ParentNode} [root]
 */
export function fitReelDrumLabels(root = document) {
  root.querySelectorAll('.reel-drum__cell-label').forEach((label) => {
    if (!(label instanceof HTMLElement)) {
      return;
    }

    const cell = label.closest('.reel-drum__cell');
    if (!(cell instanceof HTMLElement)) {
      return;
    }

    fitLabelToCell(label, cell);
  });
}

/** @type {boolean} */
let resizeHooked = false;

/** @type {boolean} */
let resizeScheduled = false;

export function initReelLabelFit() {
  if (resizeHooked) {
    return;
  }

  resizeHooked = true;

  window.addEventListener('resize', () => {
    if (resizeScheduled) {
      return;
    }

    resizeScheduled = true;
    requestAnimationFrame(() => {
      resizeScheduled = false;
      fitReelDrumLabels();
    });
  });
}

// ---
// Changelog
// 2026-08-06 — Added binary-search label fitting for reel drum cells with resize hook.
