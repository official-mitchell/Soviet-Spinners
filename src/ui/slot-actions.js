// Pure helpers for slot delete confirmation flow — checklist §2.2.
// Created: 2026-08-05.

/**
 * @param {import('../data/types.js').Slot} slot
 * @returns {boolean}
 */
export function shouldConfirmSlotDelete(slot) {
  return slot.options.length > 0;
}

/**
 * @param {import('../data/types.js').Slot} slot
 * @returns {string}
 */
export function getDeleteSlotMessage(slot) {
  const count = slot.options.length;
  const optionWord = count === 1 ? 'option' : 'options';
  return `Slot '${slot.title}' has ${count} ${optionWord} — delete anyway?`;
}
