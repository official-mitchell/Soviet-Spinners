// Entity factories, default session shape, and normalization on load.
// Updated: 2026-08-05 — per-slot eliminateOnSpin flag (default false).

import {
  DEFAULT_SLOT_TITLE,
  DEFAULT_TOTAL_ROUNDS,
  REVEAL_MODES,
} from './constants.js';

/** @returns {string} */
export function generateId() {
  return crypto.randomUUID();
}

/**
 * @param {string} label
 * @returns {import('./types.js').Option}
 */
export function createOptionEntity(label) {
  return {
    id: generateId(),
    label: label.trim(),
    highlighted: false,
  };
}

/**
 * @param {string} [title]
 * @param {number} [order]
 * @returns {import('./types.js').Slot}
 */
export function createSlotEntity(title = DEFAULT_SLOT_TITLE, order = 0) {
  return {
    id: generateId(),
    title,
    options: [],
    eliminatedOptions: [],
    frozen: false,
    eliminateOnSpin: false,
    revealMode: REVEAL_MODES.IMMEDIATE,
    order,
  };
}

/**
 * @param {number} roundNumber
 * @returns {import('./types.js').Round}
 */
export function createRoundEntity(roundNumber) {
  return {
    roundNumber,
    results: [],
    forcedSlotIds: [],
    timestamp: Date.now(),
  };
}

/** @returns {import('./types.js').SessionState} */
export function createDefaultSession() {
  return {
    slots: [createSlotEntity(DEFAULT_SLOT_TITLE, 0)],
    totalRounds: DEFAULT_TOTAL_ROUNDS,
    currentRound: 1,
    roundHistory: [],
    currentRoundForcedSlotIds: [],
  };
}

/**
 * @param {unknown} value
 * @returns {import('./types.js').SessionState}
 */
export function normalizeSession(value) {
  const defaults = createDefaultSession();

  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const session = /** @type {Record<string, unknown>} */ (value);
  const rawSlots = Array.isArray(session.slots) ? session.slots : [];
  const slots = rawSlots
    .map((slot, index) => normalizeSlot(slot, index))
    .filter(Boolean);

  if (slots.length === 0) {
    return defaults;
  }

  /** @type {import('./types.js').Slot[]} */
  const normalizedSlots = slots;

  normalizedSlots.forEach((slot, index) => {
    slot.order = index;
  });

  const roundHistory = Array.isArray(session.roundHistory)
    ? session.roundHistory.map(normalizeRound).filter(Boolean)
    : [];

  const slotsWithEliminated = reconcileEliminatedOptions(normalizedSlots, roundHistory);

  return {
    slots: slotsWithEliminated,
    totalRounds: normalizePositiveNumber(session.totalRounds, defaults.totalRounds),
    currentRound: normalizePositiveNumber(session.currentRound, defaults.currentRound),
    roundHistory,
    currentRoundForcedSlotIds: Array.isArray(session.currentRoundForcedSlotIds)
      ? session.currentRoundForcedSlotIds.filter((id) => typeof id === 'string')
      : [],
  };
}

/**
 * @param {unknown} raw
 * @param {number} index
 * @returns {import('./types.js').Slot | null}
 */
function normalizeSlot(raw, index) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const slot = /** @type {Record<string, unknown>} */ (raw);
  const options = Array.isArray(slot.options)
    ? slot.options.map(normalizeOption).filter(Boolean)
    : [];
  const eliminatedOptions = Array.isArray(slot.eliminatedOptions)
    ? slot.eliminatedOptions.map(normalizeOption).filter(Boolean)
    : [];

  const title =
    typeof slot.title === 'string' && slot.title.trim()
      ? slot.title.trim().slice(0, 40)
      : DEFAULT_SLOT_TITLE;

  return {
    id: typeof slot.id === 'string' && slot.id ? slot.id : generateId(),
    title,
    options,
    eliminatedOptions,
    frozen: Boolean(slot.frozen),
    eliminateOnSpin: Boolean(slot.eliminateOnSpin),
    revealMode:
      slot.revealMode === REVEAL_MODES.GATED
        ? REVEAL_MODES.GATED
        : REVEAL_MODES.IMMEDIATE,
    order: typeof slot.order === 'number' ? slot.order : index,
    currentResult: normalizeSlotResult(slot.currentResult),
  };
}

/**
 * @param {unknown} raw
 * @returns {import('./types.js').SlotResult | null}
 */
function normalizeSlotResult(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const result = /** @type {Record<string, unknown>} */ (raw);
  const label = typeof result.label === 'string' ? result.label.trim() : '';
  const optionId = typeof result.optionId === 'string' ? result.optionId : '';

  if (!label || !optionId) {
    return null;
  }

  return {
    optionId,
    label,
    forced: Boolean(result.forced),
    revealed: Boolean(result.revealed),
  };
}

/**
 * @param {unknown} raw
 * @returns {import('./types.js').Option | null}
 */
function normalizeOption(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const option = /** @type {Record<string, unknown>} */ (raw);
  const label = typeof option.label === 'string' ? option.label.trim() : '';

  if (!label) {
    return null;
  }

  return {
    id: typeof option.id === 'string' && option.id ? option.id : generateId(),
    label,
    highlighted: Boolean(option.highlighted),
  };
}

/**
 * @param {unknown} raw
 * @returns {import('./types.js').Round | null}
 */
function normalizeRound(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const round = /** @type {Record<string, unknown>} */ (raw);
  const results = Array.isArray(round.results)
    ? round.results
        .map((result) => {
          if (!result || typeof result !== 'object') {
            return null;
          }

          const entry = /** @type {Record<string, unknown>} */ (result);
          if (typeof entry.slotId !== 'string' || typeof entry.optionId !== 'string') {
            return null;
          }

          return {
            slotId: entry.slotId,
            optionId: entry.optionId,
            label: typeof entry.label === 'string' ? entry.label : undefined,
            slotTitle: typeof entry.slotTitle === 'string' ? entry.slotTitle : undefined,
          };
        })
        .filter(Boolean)
    : [];

  const forcedSlotIds = Array.isArray(round.forcedSlotIds)
    ? round.forcedSlotIds.filter((id) => typeof id === 'string')
    : [];

  if (typeof round.roundNumber !== 'number') {
    return null;
  }

  return {
    roundNumber: round.roundNumber,
    results,
    forcedSlotIds,
    timestamp: typeof round.timestamp === 'number' ? round.timestamp : Date.now(),
  };
}

/**
 * @param {unknown} value
 * @param {number} fallback
 */
function normalizePositiveNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? value
    : fallback;
}

/**
 * @param {import('./types.js').Slot[]} slots
 * @param {import('./types.js').Round[]} roundHistory
 * @returns {import('./types.js').Slot[]}
 */
function reconcileEliminatedOptions(slots, roundHistory) {
  return slots.map((slot) => {
    /** @type {import('./types.js').Option[]} */
    const eliminated = [...slot.eliminatedOptions];
    const knownIds = new Set([
      ...slot.options.map((option) => option.id),
      ...eliminated.map((option) => option.id),
    ]);

    for (const round of roundHistory) {
      for (const result of round.results) {
        if (result.slotId !== slot.id || knownIds.has(result.optionId)) {
          continue;
        }

        const restored = normalizeOption({
          id: result.optionId,
          label: result.label ?? 'Unknown',
        });

        if (restored) {
          eliminated.push(restored);
          knownIds.add(result.optionId);
        }
      }
    }

    return {
      ...slot,
      eliminatedOptions: eliminated,
    };
  });
}

/**
 * @param {unknown} value
 * @returns {value is import('./types.js').SessionState}
 */
export function isValidSession(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = /** @type {Record<string, unknown>} */ (value);

  return (
    Array.isArray(session.slots) &&
    session.slots.length >= 1 &&
    typeof session.totalRounds === 'number' &&
    typeof session.currentRound === 'number' &&
    Array.isArray(session.roundHistory)
  );
}
