// History table display helpers — checklist §7.2.
// Created: 2026-08-05 — slot title snapshots for results and forced flags.

/**
 * @param {import('../data/types.js').RoundResult | { slotId: string, slotTitle?: string }} result
 * @param {Map<string, import('../data/types.js').Slot>} slotById
 * @returns {string}
 */
export function resolveHistorySlotTitle(result, slotById) {
  if (result.slotTitle) {
    return result.slotTitle;
  }

  return slotById.get(result.slotId)?.title ?? 'Slot';
}

/**
 * @param {import('../data/types.js').Round} round
 * @param {Map<string, import('../data/types.js').Slot>} slotById
 * @returns {string[]}
 */
export function getForcedSlotTitles(round, slotById) {
  const resultBySlotId = new Map(round.results.map((result) => [result.slotId, result]));

  return round.forcedSlotIds.map((slotId) => {
    const result = resultBySlotId.get(slotId);
    if (result) {
      return resolveHistorySlotTitle(result, slotById);
    }

    return slotById.get(slotId)?.title ?? 'Slot';
  });
}

/**
 * @param {import('../data/types.js').Round} round
 * @param {string} slotId
 * @returns {boolean}
 */
export function isForcedRoundResult(round, slotId) {
  return round.forcedSlotIds.includes(slotId);
}
