// Session store: Slot/option CRUD, CSV import, spin mechanics, and localStorage persistence.
// Updated: 2026-08-06 — shuffle advances reel preview offset for neighbor rotation.

import { DEFAULT_SLOT_TITLE, REVEAL_MODES } from './constants.js';
import {
  createDefaultSession,
  createOptionEntity,
  createRoundEntity,
  createSlotEntity,
  normalizeSession,
} from './models.js';
import { clearRaw, readRaw, writeRaw } from './storage.js';
import { processCsvForImport, processLinkCsvForImport, normalizeOptionUrl } from './csv-import.js';
import { buildSpinPlan, shuffleArray } from './spin.js';

/** @type {import('./types.js').SessionState} */
let state = createDefaultSession();

function normalizeOrders() {
  state.slots = [...state.slots]
    .sort((a, b) => a.order - b.order)
    .map((slot, index) => ({ ...slot, order: index }));
}

function findSlotIndex(id) {
  return state.slots.findIndex((slot) => slot.id === id);
}

function requireSlot(id) {
  const index = findSlotIndex(id);
  if (index === -1) {
    throw new Error(`Slot not found: ${id}`);
  }
  return index;
}

/** @returns {import('./types.js').SessionState} */
export function getState() {
  return structuredClone(state);
}

/** @returns {import('./types.js').Slot[]} */
export function getSlots() {
  return structuredClone(state.slots);
}

export function getCurrentRound() {
  return state.currentRound;
}

export function getTotalRounds() {
  return state.totalRounds;
}

export function getActiveSlotCount() {
  return state.slots.filter((slot) => !slot.frozen).length;
}

export function getFrozenSlotCount() {
  return state.slots.filter((slot) => slot.frozen).length;
}

/** @returns {import('./types.js').Round[]} */
export function getRoundHistory() {
  return structuredClone(state.roundHistory);
}

/**
 * @param {string} [title]
 * @returns {import('./types.js').Slot}
 */
export function createSlot(title = DEFAULT_SLOT_TITLE) {
  const slot = createSlotEntity(title, state.slots.length);
  state.slots.push(slot);
  normalizeOrders();
  saveSession();
  return structuredClone(slot);
}

/**
 * @param {string} id
 */
export function deleteSlot(id) {
  if (state.slots.length <= 1) {
    throw new Error('Cannot delete the last remaining slot');
  }

  requireSlot(id);
  state.slots = state.slots.filter((slot) => slot.id !== id);
  normalizeOrders();
  saveSession();
}

/**
 * @param {string} id
 * @param {string} title
 * @returns {import('./types.js').Slot}
 */
export function updateSlotTitle(id, title) {
  const index = requireSlot(id);
  state.slots[index] = { ...state.slots[index], title };
  saveSession();
  return structuredClone(state.slots[index]);
}

/**
 * @param {string[]} ids
 * @returns {import('./types.js').Slot[]}
 */
export function reorderSlots(ids) {
  if (ids.length !== state.slots.length) {
    throw new Error('Reorder ids must include every slot exactly once');
  }

  const slotMap = new Map(state.slots.map((slot) => [slot.id, slot]));
  const uniqueIds = new Set(ids);

  if (uniqueIds.size !== ids.length) {
    throw new Error('Reorder ids must not contain duplicates');
  }

  state.slots = ids.map((id, index) => {
    const slot = slotMap.get(id);
    if (!slot) {
      throw new Error(`Unknown slot id: ${id}`);
    }
    return { ...slot, order: index };
  });

  saveSession();
  return getSlots();
}

function requireOption(slotId, optionId) {
  const slotIndex = requireSlot(slotId);
  const optionIndex = state.slots[slotIndex].options.findIndex(
    (option) => option.id === optionId,
  );
  if (optionIndex === -1) {
    throw new Error(`Option not found: ${optionId}`);
  }
  return { slotIndex, optionIndex };
}

/**
 * @param {number} slotIndex
 * @param {number} optionIndex
 * @returns {import('./types.js').Option}
 */
function eliminateOption(slotIndex, optionIndex) {
  const slot = state.slots[slotIndex];
  const [option] = slot.options.splice(optionIndex, 1);

  if (!option) {
    throw new Error('Option not found for elimination');
  }

  slot.eliminatedOptions = [...(slot.eliminatedOptions ?? []), { ...option }];
  return option;
}

/**
 * @param {string} slotId
 * @param {string} label
 * @param {string} [url]
 * @returns {import('./types.js').Option}
 */
export function addOption(slotId, label, url) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error('Option label cannot be empty');
  }

  const slotIndex = requireSlot(slotId);
  const option = createOptionEntity(trimmed, url);
  state.slots[slotIndex].options.push(option);
  saveSession();
  return structuredClone(option);
}

/**
 * @param {string} slotId
 * @param {string} optionId
 * @param {string} label
 * @param {string} [url]
 * @returns {import('./types.js').Option}
 */
export function updateOption(slotId, optionId, label, url) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error('Option label cannot be empty');
  }

  const { slotIndex, optionIndex } = requireOption(slotId, optionId);
  const current = state.slots[slotIndex].options[optionIndex];
  /** @type {import('./types.js').Option} */
  const next = {
    ...current,
    label: trimmed,
  };

  if (url !== undefined) {
    const normalizedUrl = normalizeOptionUrl(url);
    if (normalizedUrl) {
      next.url = normalizedUrl;
    } else {
      delete next.url;
    }
  }

  state.slots[slotIndex].options[optionIndex] = next;

  const slot = state.slots[slotIndex];
  if (slot.currentResult?.optionId === optionId) {
    slot.currentResult = {
      ...slot.currentResult,
      label: trimmed,
    };
  }

  saveSession();
  return structuredClone(next);
}

/**
 * @param {string} slotId
 */
export function resetEliminatedOptions(slotId) {
  const index = requireSlot(slotId);
  const slot = state.slots[index];
  const eliminated = slot.eliminatedOptions ?? [];

  if (eliminated.length === 0) {
    return;
  }

  state.slots[index] = {
    ...slot,
    options: [...slot.options, ...eliminated],
    eliminatedOptions: [],
  };
  saveSession();
}

/**
 * @param {string} slotId
 * @param {string} optionId
 */
export function deleteOption(slotId, optionId) {
  const { slotIndex, optionIndex } = requireOption(slotId, optionId);
  state.slots[slotIndex].options.splice(optionIndex, 1);
  saveSession();
}

/**
 * @param {string} slotId
 * @param {string[]} optionIds
 * @returns {import('./types.js').Option[]}
 */
export function reorderOptions(slotId, optionIds) {
  const slotIndex = requireSlot(slotId);
  const options = state.slots[slotIndex].options;

  if (optionIds.length !== options.length) {
    throw new Error('Reorder ids must include every option exactly once');
  }

  const optionMap = new Map(options.map((option) => [option.id, option]));
  const uniqueIds = new Set(optionIds);

  if (uniqueIds.size !== optionIds.length) {
    throw new Error('Reorder ids must not contain duplicates');
  }

  state.slots[slotIndex].options = optionIds.map((id) => {
    const option = optionMap.get(id);
    if (!option) {
      throw new Error(`Unknown option id: ${id}`);
    }
    return option;
  });

  saveSession();
  return structuredClone(state.slots[slotIndex].options);
}

/**
 * @param {string} slotId
 * @param {string} optionId
 * @returns {import('./types.js').Option}
 */
export function toggleOptionHighlight(slotId, optionId) {
  const { slotIndex, optionIndex } = requireOption(slotId, optionId);
  const option = state.slots[slotIndex].options[optionIndex];
  state.slots[slotIndex].options[optionIndex] = {
    ...option,
    highlighted: !option.highlighted,
  };
  saveSession();
  return structuredClone(state.slots[slotIndex].options[optionIndex]);
}

/**
 * @param {string} slotId
 * @param {string} csvText
 * @returns {import('./types.js').CsvImportSummary}
 */
export function importCsvOptions(slotId, csvText) {
  const slotIndex = requireSlot(slotId);
  const existingLabels = state.slots[slotIndex].options.map((option) => option.label);
  const { added, summary } = processCsvForImport(csvText, existingLabels);

  for (const label of added) {
    state.slots[slotIndex].options.push(createOptionEntity(label));
  }

  saveSession();
  return structuredClone(summary);
}

/**
 * @param {string} slotId
 * @param {string} csvText
 * @returns {import('./types.js').CsvImportSummary}
 */
export function importLinkCsvOptions(slotId, csvText) {
  const slotIndex = requireSlot(slotId);
  const existingLabels = state.slots[slotIndex].options.map((option) => option.label);
  const { added, summary } = processLinkCsvForImport(csvText, existingLabels);

  for (const entry of added) {
    state.slots[slotIndex].options.push(createOptionEntity(entry.label, entry.url));
  }

  saveSession();
  return structuredClone(summary);
}

/**
 * @param {string} slotId
 */
export function clearSlotOptions(slotId) {
  const index = requireSlot(slotId);
  state.slots[index] = {
    ...state.slots[index],
    options: [],
    eliminatedOptions: [],
    currentResult: null,
  };
  saveSession();
}

/** @param {number} totalRounds */
export function setTotalRounds(totalRounds) {
  const parsed = Number(totalRounds);

  if (!Number.isFinite(parsed)) {
    throw new Error('Total rounds must be a number');
  }

  const normalized = Math.max(1, Math.floor(parsed));
  state.totalRounds = normalized;
  saveSession();
  return normalized;
}

/**
 * @param {string} slotId
 * @param {boolean} frozen
 */
export function setSlotFrozen(slotId, frozen) {
  const index = requireSlot(slotId);
  state.slots[index] = { ...state.slots[index], frozen };
  saveSession();
}

export function unlockAll() {
  state.slots = state.slots.map((slot) => ({ ...slot, frozen: false }));
  saveSession();
}

/**
 * @param {string} slotId
 * @param {'immediate' | 'gated'} revealMode
 */
export function setSlotRevealMode(slotId, revealMode) {
  const index = requireSlot(slotId);
  state.slots[index] = { ...state.slots[index], revealMode };
  saveSession();
}

/**
 * @param {string} slotId
 * @param {boolean} eliminateOnSpin
 */
export function setSlotEliminateOnSpin(slotId, eliminateOnSpin) {
  const index = requireSlot(slotId);
  state.slots[index] = { ...state.slots[index], eliminateOnSpin };
  saveSession();
}

/**
 * @param {string} slotId
 * @param {boolean} linksMode
 */
export function setSlotLinksMode(slotId, linksMode) {
  const index = requireSlot(slotId);
  state.slots[index] = { ...state.slots[index], linksMode };
  saveSession();
}

/**
 * @param {string} slotId
 * @param {string} optionId
 * @param {string} url
 * @returns {import('./types.js').Option}
 */
export function updateOptionLink(slotId, optionId, url) {
  const slotIndex = requireSlot(slotId);
  const normalizedUrl = normalizeOptionUrl(url);
  const activeIndex = state.slots[slotIndex].options.findIndex((option) => option.id === optionId);

  if (activeIndex !== -1) {
    const current = state.slots[slotIndex].options[activeIndex];
    /** @type {import('./types.js').Option} */
    const next = { ...current };
    if (normalizedUrl) {
      next.url = normalizedUrl;
    } else {
      delete next.url;
    }
    state.slots[slotIndex].options[activeIndex] = next;
    saveSession();
    return structuredClone(next);
  }

  const eliminated = state.slots[slotIndex].eliminatedOptions ?? [];
  const eliminatedIndex = eliminated.findIndex((option) => option.id === optionId);
  if (eliminatedIndex === -1) {
    throw new Error(`Option not found: ${optionId}`);
  }

  const current = eliminated[eliminatedIndex];
  /** @type {import('./types.js').Option} */
  const next = { ...current };
  if (normalizedUrl) {
    next.url = normalizedUrl;
  } else {
    delete next.url;
  }

  state.slots[slotIndex].eliminatedOptions = eliminated.map((option, index) =>
    index === eliminatedIndex ? next : option,
  );
  saveSession();
  return structuredClone(next);
}

export function shuffleAll() {
  state.slots = state.slots.map((slot) => {
    const labels = slot.options.map((option) => option.label);
    const centerLabel = slot.currentResult?.label ?? labels[0] ?? '';
    const neighborCount = Math.max(
      1,
      labels.filter((label) => label !== centerLabel).length,
    );

    return {
      ...slot,
      options: shuffleArray(slot.options),
      previewOffset: ((slot.previewOffset ?? 0) + 1) % neighborCount,
    };
  });
  saveSession();
}

/**
 * @param {boolean} [includeFrozen]
 * @returns {import('./spin.js').SpinPlan}
 */
export function planSpin(includeFrozen = false) {
  return buildSpinPlan(state.slots, { includeFrozen });
}

/**
 * @param {import('./types.js').Slot} slot
 * @param {string} optionId
 * @param {string} label
 * @returns {import('./types.js').RoundResult}
 */
function createRoundResult(slot, optionId, label) {
  return {
    slotId: slot.id,
    optionId,
    label,
    slotTitle: slot.title,
  };
}

/**
 * @param {import('./spin.js').SpinDraw[]} draws
 * @returns {import('./types.js').Round}
 */
export function commitSpinDraws(draws) {
  if (draws.length === 0) {
    throw new Error('Cannot commit an empty spin');
  }

  const snapshot = structuredClone(state);

  try {
    /** @type {import('./types.js').RoundResult[]} */
    const results = [];
    const forcedSlotIds = [...state.currentRoundForcedSlotIds];
    const spunSlotIds = new Set(draws.map((draw) => draw.slotId));

    /** @type {Array<{ slotIndex: number, optionIndex: number, draw: import('./spin.js').SpinDraw, revealMode: string }>} */
    const validatedDraws = [];

    for (const draw of draws) {
      const slotIndex = requireSlot(draw.slotId);
      const slot = state.slots[slotIndex];
      const optionIndex = slot.options.findIndex((option) => option.id === draw.optionId);

      if (optionIndex === -1) {
        throw new Error(`Draw option not found in slot: ${draw.optionId}`);
      }

      validatedDraws.push({
        slotIndex,
        optionIndex,
        draw,
        revealMode: slot.revealMode,
      });
    }

    for (const { slotIndex, optionIndex, draw, revealMode } of validatedDraws) {
      const slot = state.slots[slotIndex];

      if (slot.eliminateOnSpin) {
        eliminateOption(slotIndex, optionIndex);
      }

      state.slots[slotIndex].currentResult = {
        optionId: draw.optionId,
        label: draw.label,
        forced: false,
        revealed: revealMode === REVEAL_MODES.IMMEDIATE,
      };

      results.push(createRoundResult(state.slots[slotIndex], draw.optionId, draw.label));

      const forcedIndex = forcedSlotIds.indexOf(draw.slotId);
      if (forcedIndex !== -1) {
        forcedSlotIds.splice(forcedIndex, 1);
      }
    }

    for (const slot of state.slots) {
      if (spunSlotIds.has(slot.id)) {
        continue;
      }

      if (slot.currentResult?.forced) {
        results.push(
          createRoundResult(slot, slot.currentResult.optionId, slot.currentResult.label),
        );
        if (!forcedSlotIds.includes(slot.id)) {
          forcedSlotIds.push(slot.id);
        }
        continue;
      }

      if (slot.frozen && slot.currentResult) {
        results.push(
          createRoundResult(slot, slot.currentResult.optionId, slot.currentResult.label),
        );
      }
    }

    const round = createRoundEntity(state.currentRound);
    round.results = results;
    round.forcedSlotIds = forcedSlotIds.filter((slotId) =>
      results.some((result) => result.slotId === slotId),
    );

    state.roundHistory.push(round);
    state.currentRound += 1;
    state.currentRoundForcedSlotIds = [];
    saveSession();
    return structuredClone(round);
  } catch (error) {
    state = snapshot;
    throw error;
  }
}

/**
 * @returns {import('./types.js').Round}
 */
export function spinUnfrozen() {
  const plan = planSpin(false);
  if (plan.draws.length === 0) {
    throw new Error('No unfrozen slots with options available to spin');
  }
  return commitSpinDraws(plan.draws);
}

/**
 * @returns {import('./types.js').Round}
 */
export function surpriseMe() {
  const plan = planSpin(true);
  if (plan.draws.length === 0) {
    throw new Error('No slots with options available to spin');
  }
  return commitSpinDraws(plan.draws);
}

/**
 * @param {string} slotId
 * @param {string} optionId
 * @returns {import('./types.js').SlotResult}
 */
export function forceSelect(slotId, optionId) {
  const { slotIndex, optionIndex } = requireOption(slotId, optionId);
  const option = eliminateOption(slotIndex, optionIndex);
  const slot = state.slots[slotIndex];

  const result = {
    optionId: option.id,
    label: option.label,
    forced: true,
    revealed: slot.revealMode === REVEAL_MODES.IMMEDIATE,
  };

  state.slots[slotIndex].currentResult = result;

  if (!state.currentRoundForcedSlotIds.includes(slotId)) {
    state.currentRoundForcedSlotIds.push(slotId);
  }

  saveSession();
  return structuredClone(result);
}

/**
 * Reverts a pending forced pick, returning the option to the live pool.
 * No-ops on committed rounds since only the pending (uncommitted) result can be undone.
 * @param {string} slotId
 */
export function clearForceSelect(slotId) {
  const slotIndex = requireSlot(slotId);
  const slot = state.slots[slotIndex];

  if (!slot.currentResult?.forced) {
    throw new Error('Slot has no pending forced pick to revert');
  }

  const { optionId, label } = slot.currentResult;
  const eliminatedIndex = (slot.eliminatedOptions ?? []).findIndex(
    (option) => option.id === optionId,
  );

  const restoredOption =
    eliminatedIndex === -1
      ? createOptionEntity(label)
      : slot.eliminatedOptions[eliminatedIndex];

  if (eliminatedIndex !== -1) {
    slot.eliminatedOptions = slot.eliminatedOptions.filter((_, index) => index !== eliminatedIndex);
  }

  slot.options = [...slot.options, restoredOption];
  slot.currentResult = null;
  state.currentRoundForcedSlotIds = state.currentRoundForcedSlotIds.filter(
    (id) => id !== slotId,
  );

  saveSession();
  return structuredClone(slot);
}

/**
 * @param {string} slotId
 */
export function revealSlot(slotId) {
  const index = requireSlot(slotId);
  const slot = state.slots[index];

  if (!slot.currentResult) {
    throw new Error('No result to reveal');
  }

  if (slot.revealMode !== REVEAL_MODES.GATED) {
    throw new Error('Only gated slots use reveal');
  }

  state.slots[index].currentResult = {
    ...slot.currentResult,
    revealed: true,
  };
  saveSession();
}

export function saveSession() {
  writeRaw(JSON.stringify(state));
}

export function loadSession() {
  const raw = readRaw();

  if (!raw) {
    state = createDefaultSession();
    saveSession();
    return getState();
  }

  try {
    const parsed = JSON.parse(raw);
    state = normalizeSession(parsed);
    normalizeOrders();
    saveSession();
    return getState();
  } catch (error) {
    console.debug('[session] Failed to load persisted state, using defaults.', error);
    state = createDefaultSession();
    saveSession();
    return getState();
  }
}

/** Reset in-memory state without touching storage — for tests. */
export function resetState() {
  state = createDefaultSession();
}

/** Replace in-memory state and persist — for tests. */
export function replaceState(nextState) {
  state = normalizeSession(nextState);
  normalizeOrders();
  saveSession();
}

/** Clear persisted session and reset to defaults — for tests. */
export function clearSession() {
  clearRaw();
  resetState();
}
