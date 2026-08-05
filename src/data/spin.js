// Pure spin planning and shuffle helpers — checklist §4.1.
// Updated: 2026-08-05 — added countDrawableSlots for spin control disable logic.

/**
 * @typedef {Object} SpinDraw
 * @property {string} slotId
 * @property {string} optionId
 * @property {string} label
 */

/**
 * @typedef {Object} SpinPlan
 * @property {SpinDraw[]} draws
 * @property {string[]} skippedFrozenSlotIds
 * @property {string[]} skippedEmptySlotIds
 */

/**
 * @param {import('./types.js').Option[]} options
 * @returns {import('./types.js').Option[]}
 */
export function shuffleArray(options) {
  const copy = [...options];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

/**
 * @param {number} length
 * @returns {number}
 */
export function pickRandomIndex(length) {
  if (length <= 0) {
    throw new Error('Cannot draw from an empty pool');
  }
  return Math.floor(Math.random() * length);
}

/**
 * @param {import('./types.js').Slot[]} slots
 * @param {{ includeFrozen?: boolean }} [options]
 * @returns {SpinPlan}
 */
export function buildSpinPlan(slots, options = {}) {
  const includeFrozen = options.includeFrozen ?? false;
  /** @type {SpinDraw[]} */
  const draws = [];
  /** @type {string[]} */
  const skippedFrozenSlotIds = [];
  /** @type {string[]} */
  const skippedEmptySlotIds = [];

  for (const slot of slots) {
    if (!includeFrozen && slot.frozen) {
      skippedFrozenSlotIds.push(slot.id);
      continue;
    }

    if (slot.options.length === 0) {
      skippedEmptySlotIds.push(slot.id);
      continue;
    }

    const index = pickRandomIndex(slot.options.length);
    const option = slot.options[index];
    draws.push({
      slotId: slot.id,
      optionId: option.id,
      label: option.label,
    });
  }

  return { draws, skippedFrozenSlotIds, skippedEmptySlotIds };
}

/**
 * @param {import('./types.js').Slot[]} slots
 * @param {boolean} [includeFrozen]
 * @returns {number}
 */
export function countDrawableSlots(slots, includeFrozen = false) {
  return slots.filter((slot) => {
    if (!includeFrozen && slot.frozen) {
      return false;
    }
    return slot.options.length > 0;
  }).length;
}

/**
 * @param {SpinPlan} plan
 * @returns {boolean}
 */
export function hasSpinDraws(plan) {
  return plan.draws.length > 0;
}
