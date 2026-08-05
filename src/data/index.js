// Public exports for the Hot Takes Night data layer.
// Created: 2026-08-05 — Barrel file for session store and models.

export {
  DEFAULT_SLOT_TITLE,
  DEFAULT_TOTAL_ROUNDS,
  REVEAL_MODES,
  STORAGE_KEY,
} from './constants.js';

export {
  createDefaultSession,
  createOptionEntity,
  createRoundEntity,
  createSlotEntity,
  generateId,
  isValidSession,
  normalizeSession,
} from './models.js';

export {
  clearRaw,
  createMemoryStorage,
  readRaw,
  setStorageBackend,
  writeRaw,
} from './storage.js';

export {
  clearSession,
  createSlot,
  deleteSlot,
  getActiveSlotCount,
  getCurrentRound,
  getFrozenSlotCount,
  getRoundHistory,
  getSlots,
  getState,
  getTotalRounds,
  loadSession,
  reorderSlots,
  replaceState,
  resetState,
  saveSession,
  setTotalRounds,
  updateSlotTitle,
  addOption,
  updateOption,
  deleteOption,
  reorderOptions,
  toggleOptionHighlight,
  importCsvOptions,
  shuffleAll,
  planSpin,
  commitSpinDraws,
  spinUnfrozen,
  surpriseMe,
  forceSelect,
  setSlotFrozen,
  unlockAll,
  setSlotRevealMode,
  revealSlot,
} from './store.js';

export {
  buildSpinPlan,
  countDrawableSlots,
  hasSpinDraws,
  pickRandomIndex,
  shuffleArray,
} from './spin.js';

export {
  extractFirstCsvField,
  formatImportSummaryMessage,
  isMalformedRow,
  isPlainLabel,
  parseSingleColumnCsv,
  processCsvForImport,
  skipDetectedHeaderRow,
} from './csv-import.js';
