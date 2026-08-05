// Reel display rules for immediate vs gated reveal — checklist §4.3.
// Updated: 2026-08-05 — gated idle hides pool preview labels.

/** @typedef {'empty' | 'result' | 'gated-prompt' | 'preview'} ReelDisplayKind */

/**
 * @typedef {Object} ReelDisplayState
 * @property {ReelDisplayKind} kind
 * @property {string} text
 * @property {boolean} showsOptionLabel
 * @property {boolean} forced
 */

const URL_PATTERN = /(https?:\/\/|www\.|\.com|\.org|\.net|slides|presentation)/i;

/**
 * @param {import('./types.js').Slot} slot
 * @returns {ReelDisplayState}
 */
export function getReelDisplayState(slot) {
  if (!slot.currentResult) {
    if (slot.options.length === 0) {
      return {
        kind: 'empty',
        text: 'Add options below',
        showsOptionLabel: false,
        forced: false,
      };
    }

    if (slot.revealMode === 'gated') {
      return {
        kind: 'empty',
        text: 'No result yet',
        showsOptionLabel: false,
        forced: false,
      };
    }

    return {
      kind: 'preview',
      text: slot.options[0].label,
      showsOptionLabel: true,
      forced: false,
    };
  }

  const { currentResult, revealMode } = slot;

  if (revealMode === 'gated' && !currentResult.revealed) {
    return {
      kind: 'gated-prompt',
      text: 'Reveal & Launch',
      showsOptionLabel: false,
      forced: currentResult.forced,
    };
  }

  return {
    kind: 'result',
    text: currentResult.label,
    showsOptionLabel: true,
    forced: currentResult.forced,
  };
}

/**
 * @param {import('./types.js').Slot} slot
 * @returns {boolean}
 */
export function reelLeaksGatedContent(slot) {
  const display = getReelDisplayState(slot);
  if (slot.revealMode !== 'gated' || !slot.currentResult || slot.currentResult.revealed) {
    return false;
  }

  if (display.showsOptionLabel) {
    return true;
  }

  return URL_PATTERN.test(display.text);
}
