// Session store: Slot/option CRUD, CSV import, derived getters, and localStorage persistence.
// Created: 2026-08-05 — Data layer store for Hot Takes Night (checklist §1, §2.3, §3).

import { DEFAULT_SLOT_TITLE } from './constants.js';
import {
  createDefaultSession,
  createOptionEntity,
  createSlotEntity,
  normalizeSession,
} from './models.js';
import { clearRaw, readRaw, writeRaw } from './storage.js';
import { processCsvForImport } from './csv-import.js';

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
 * @param {string} slotId
 * @param {string} label
 * @returns {import('./types.js').Option}
 */
export function addOption(slotId, label) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error('Option label cannot be empty');
  }

  const slotIndex = requireSlot(slotId);
  const option = createOptionEntity(trimmed);
  state.slots[slotIndex].options.push(option);
  saveSession();
  return structuredClone(option);
}

/**
 * @param {string} slotId
 * @param {string} optionId
 * @param {string} label
 * @returns {import('./types.js').Option}
 */
export function updateOption(slotId, optionId, label) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error('Option label cannot be empty');
  }

  const { slotIndex, optionIndex } = requireOption(slotId, optionId);
  state.slots[slotIndex].options[optionIndex] = {
    ...state.slots[slotIndex].options[optionIndex],
    label: trimmed,
  };
  saveSession();
  return structuredClone(state.slots[slotIndex].options[optionIndex]);
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

/** @param {number} totalRounds */
export function setTotalRounds(totalRounds) {
  state.totalRounds = totalRounds;
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
