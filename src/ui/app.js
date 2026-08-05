// Application bootstrap and event wiring — Slot Management UI §2–§4.
// Updated: 2026-08-05 — spin lock, atomic commit errors, preserved spinning state.

import {
  addOption,
  commitSpinDraws,
  createSlot,
  deleteOption,
  deleteSlot,
  forceSelect,
  getState,
  hasSpinDraws,
  importCsvOptions,
  loadSession,
  planSpin,
  reorderOptions,
  reorderSlots,
  revealSlot,
  setSlotFrozen,
  shuffleAll,
  toggleOptionHighlight,
  unlockAll,
  updateOption,
  updateSlotTitle,
} from '../data/index.js';
import { confirmDialog, initModal, isModalOpen } from './modal.js';
import {
  beginOptionEdit,
  closeAllOptionMenus,
  renderAppShell,
  renderOptionMenu,
} from './render.js';
import { getDeleteSlotMessage, shouldConfirmSlotDelete } from './slot-actions.js';
import { runSpinAnimation } from './spin-controller.js';
import {
  captureScrollState,
  flushDeferredRender,
  restoreScrollState,
  shouldDeferRender,
} from './edit-state.js';

/** @type {{ focusSlotTitleId: string | null, focusAddOptionSlotId: string | null, importSummaries: Record<string, import('../data/types.js').CsvImportSummary>, spinningSlotIds: string[], spinLocked: boolean, spinError: string | null, activeView: 'slots' | 'history', spinDrawLabels: Record<string, string> }} */
const uiState = {
  focusSlotTitleId: null,
  focusAddOptionSlotId: null,
  importSummaries: {},
  spinningSlotIds: [],
  spinLocked: false,
  spinError: null,
  activeView: 'slots',
  spinDrawLabels: {},
};

/** @type {boolean} */
let spinInProgress = false;

/** @type {string[]} */
let activeSpinningSlotIds = [];

/** @type {string | null} */
let spinErrorMessage = null;

const SPIN_FAILURE_MESSAGE =
  'The spin could not be completed. Your previous results were preserved.';

/** @returns {boolean} */
function isSpinLocked() {
  return spinInProgress;
}

/** @type {Partial<typeof uiState> | null} */
let pendingRender = null;

/** @type {{ type: 'slot' | 'option', id: string, slotId?: string } | null} */
let dragPayload = null;

/** @type {string | null} */
let dropTargetOptionId = null;

/** @type {string | null} */
let dropTargetSlotId = null;

/**
 * @param {Partial<typeof uiState>} [next]
 */
function doRender(next = {}) {
  const scrollState = captureScrollState();

  uiState.focusSlotTitleId = next.focusSlotTitleId ?? null;
  uiState.focusAddOptionSlotId = next.focusAddOptionSlotId ?? null;
  if (next.importSummaries) {
    uiState.importSummaries = next.importSummaries;
  }
  if ('spinningSlotIds' in next) {
    activeSpinningSlotIds = next.spinningSlotIds ?? [];
  }
  if ('spinError' in next) {
    spinErrorMessage = next.spinError ?? null;
  }
  if (next.activeView) {
    uiState.activeView = next.activeView;
  }
  if (next.spinDrawLabels) {
    uiState.spinDrawLabels = next.spinDrawLabels;
  }

  uiState.spinLocked = spinInProgress;
  uiState.spinningSlotIds = spinInProgress ? [...activeSpinningSlotIds] : [];
  uiState.spinError = spinErrorMessage;

  renderAppShell(getState(), uiState);

  restoreScrollState(scrollState);

  uiState.focusSlotTitleId = null;
  uiState.focusAddOptionSlotId = null;
  if (!spinInProgress) {
    uiState.spinDrawLabels = {};
  }
}

/**
 * @param {boolean} includeFrozen
 */
async function runAnimatedSpin(includeFrozen) {
  if (spinInProgress) {
    return;
  }

  const plan = planSpin(includeFrozen);
  if (!hasSpinDraws(plan)) {
    return;
  }

  spinInProgress = true;
  spinErrorMessage = null;
  activeSpinningSlotIds = plan.draws.map((draw) => draw.slotId);
  const spinDrawLabels = Object.fromEntries(plan.draws.map((draw) => [draw.slotId, draw.label]));
  scheduleRender({ spinningSlotIds: activeSpinningSlotIds, spinDrawLabels, spinError: null });

  await runSpinAnimation(plan.draws, (draws) => {
    try {
      commitSpinDraws(draws);
      spinErrorMessage = null;
    } catch (error) {
      spinErrorMessage = SPIN_FAILURE_MESSAGE;
      console.debug('[ui] commitSpinDraws failed:', error);
    }

    spinInProgress = false;
    activeSpinningSlotIds = [];
    scheduleRender({ spinningSlotIds: [], spinError: spinErrorMessage });
  });
}

function handleDismissSpinError() {
  spinErrorMessage = null;
  scheduleRender({ spinError: null });
}

/**
 * @param {'slots' | 'history'} view
 */
function handleNavView(view) {
  if (isSpinLocked()) {
    return;
  }

  uiState.activeView = view;
  scheduleRender({ activeView: view });
}

function handleShuffleAll() {
  if (isSpinLocked()) {
    return;
  }

  shuffleAll();
  scheduleRender();
}

/**
 * @param {string} slotId
 */
function handleToggleFreeze(slotId) {
  if (isSpinLocked()) {
    return;
  }

  const slot = getState().slots.find((entry) => entry.id === slotId);
  if (!slot) {
    return;
  }

  setSlotFrozen(slotId, !slot.frozen);
  scheduleRender();
}

function handleUnlockAll() {
  if (isSpinLocked()) {
    return;
  }

  unlockAll();
  scheduleRender();
}

/**
 * @param {string} slotId
 * @param {string} optionId
 */
function handleForceSelect(slotId, optionId) {
  if (isSpinLocked() || !optionId) {
    return;
  }

  try {
    forceSelect(slotId, optionId);
    scheduleRender();
  } catch (error) {
    console.debug('[ui] forceSelect failed:', error);
  }
}

/**
 * @param {string} slotId
 */
function handleRevealSlot(slotId) {
  if (isSpinLocked()) {
    return;
  }

  try {
    revealSlot(slotId);
    scheduleRender();
  } catch (error) {
    console.debug('[ui] revealSlot failed:', error);
  }
}

/**
 * @param {Partial<typeof uiState>} [next]
 */
function scheduleRender(next = {}) {
  const merged = {
    ...pendingRender,
    ...next,
    importSummaries: next.importSummaries ?? pendingRender?.importSummaries,
  };

  if (shouldDeferRender()) {
    pendingRender = merged;
    return;
  }

  pendingRender = null;
  doRender(merged);
}

function flushPendingRender() {
  if (!pendingRender || shouldDeferRender()) {
    return;
  }

  const next = pendingRender;
  pendingRender = null;
  doRender(next);
}

function handleAddSlot() {
  if (isSpinLocked()) {
    return;
  }

  const slot = createSlot();
  scheduleRender({ focusSlotTitleId: slot.id });
}

/**
 * @param {string} slotId
 */
async function handleDeleteSlot(slotId) {
  if (isSpinLocked()) {
    return;
  }

  const slot = getState().slots.find((entry) => entry.id === slotId);
  if (!slot) {
    return;
  }

  if (shouldConfirmSlotDelete(slot)) {
    const confirmed = await confirmDialog({
      title: 'Delete slot',
      message: getDeleteSlotMessage(slot),
      confirmLabel: 'Delete anyway',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) {
      return;
    }
  }

  try {
    deleteSlot(slotId);
    scheduleRender();
  } catch (error) {
    console.debug('[ui] deleteSlot blocked:', error);
  }
}

/**
 * @param {string} slotId
 * @param {string} title
 */
function handleSlotTitleChange(slotId, title) {
  if (isSpinLocked()) {
    return;
  }

  const trimmed = title.trim();
  if (!trimmed) {
    scheduleRender({ focusSlotTitleId: slotId });
    return;
  }

  updateSlotTitle(slotId, trimmed);
  scheduleRender();
}

/**
 * @param {string} slotId
 * @param {string} label
 */
function handleAddOption(slotId, label) {
  if (isSpinLocked()) {
    return;
  }

  const trimmed = label.trim();
  if (!trimmed) {
    return;
  }

  addOption(slotId, trimmed);
  scheduleRender({ focusAddOptionSlotId: slotId });
}

/**
 * @param {string} slotId
 * @param {string} optionId
 * @param {string} label
 * @param {string} fallback
 */
function handleOptionEdit(slotId, optionId, label, fallback) {
  if (isSpinLocked()) {
    return;
  }

  const trimmed = label.trim();
  if (!trimmed) {
    updateOption(slotId, optionId, fallback);
    scheduleRender();
    return;
  }

  updateOption(slotId, optionId, trimmed);
  scheduleRender();
}

/**
 * @param {string} slotId
 * @param {string} optionId
 * @param {number} direction
 */
function handleMoveOption(slotId, optionId, direction) {
  if (isSpinLocked()) {
    return;
  }

  const slot = getState().slots.find((entry) => entry.id === slotId);
  if (!slot) {
    return;
  }

  const ids = slot.options.map((option) => option.id);
  const index = ids.indexOf(optionId);
  const targetIndex = index + direction;

  if (index === -1 || targetIndex < 0 || targetIndex >= ids.length) {
    return;
  }

  [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
  reorderOptions(slotId, ids);
  closeAllOptionMenus();
  scheduleRender();
}

/**
 * @param {string} sourceSlotId
 * @param {string} targetSlotId
 */
function handleSlotDrop(sourceSlotId, targetSlotId) {
  if (isSpinLocked()) {
    return;
  }

  if (sourceSlotId === targetSlotId) {
    return;
  }

  const ids = [...getState().slots]
    .sort((a, b) => a.order - b.order)
    .map((slot) => slot.id);

  const fromIndex = ids.indexOf(sourceSlotId);
  const toIndex = ids.indexOf(targetSlotId);

  if (fromIndex === -1 || toIndex === -1) {
    return;
  }

  ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, sourceSlotId);
  reorderSlots(ids);
  scheduleRender();
}

/**
 * @param {string} slotId
 * @param {string} sourceOptionId
 * @param {string} targetOptionId
 */
function handleOptionDrop(slotId, sourceOptionId, targetOptionId) {
  if (isSpinLocked()) {
    return;
  }

  if (sourceOptionId === targetOptionId) {
    return;
  }

  const slot = getState().slots.find((entry) => entry.id === slotId);
  if (!slot) {
    return;
  }

  const ids = slot.options.map((option) => option.id);
  const fromIndex = ids.indexOf(sourceOptionId);
  const toIndex = ids.indexOf(targetOptionId);

  if (fromIndex === -1 || toIndex === -1) {
    return;
  }

  ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, sourceOptionId);
  reorderOptions(slotId, ids);
  scheduleRender();
}

/**
 * @param {string} slotId
 * @param {File} file
 */
async function handleCsvImport(slotId, file) {
  if (isSpinLocked()) {
    return;
  }

  const text = await file.text();
  const summary = importCsvOptions(slotId, text);

  scheduleRender({
    importSummaries: {
      ...uiState.importSummaries,
      [slotId]: summary,
    },
  });
}

function bindEvents() {
  document.addEventListener('focusout', () => {
    flushDeferredRender(flushPendingRender);
  });

  document.addEventListener('click', (event) => {
    if (isModalOpen()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest('[data-action]');
    if (!(actionElement instanceof HTMLElement)) {
      closeAllOptionMenus();
      return;
    }

    const action = actionElement.dataset.action;

    if (isSpinLocked() && action !== 'dismiss-spin-error') {
      return;
    }

    const slotId = actionElement.dataset.slotId;
    const optionId = actionElement.dataset.optionId;

    switch (action) {
      case 'add-slot':
        handleAddSlot();
        break;
      case 'delete-slot':
        if (slotId) {
          handleDeleteSlot(slotId);
        }
        break;
      case 'focus-add-option':
        if (slotId) {
          scheduleRender({ focusAddOptionSlotId: slotId });
        }
        break;
      case 'toggle-highlight':
        if (slotId && optionId) {
          toggleOptionHighlight(slotId, optionId);
          scheduleRender();
        }
        break;
      case 'toggle-option-menu':
        if (slotId && optionId) {
          event.stopPropagation();
          renderOptionMenu(slotId, optionId);
        }
        break;
      case 'delete-option':
        if (slotId && optionId) {
          deleteOption(slotId, optionId);
          closeAllOptionMenus();
          scheduleRender();
        }
        break;
      case 'move-option-up':
        if (slotId && optionId) {
          handleMoveOption(slotId, optionId, -1);
        }
        break;
      case 'move-option-down':
        if (slotId && optionId) {
          handleMoveOption(slotId, optionId, 1);
        }
        break;
      case 'import-csv':
        if (slotId) {
          const fileInput = document.querySelector(
            `[data-action="csv-file"][data-slot-id="${slotId}"]`,
          );
          if (fileInput instanceof HTMLInputElement) {
            fileInput.click();
          }
        }
        break;
      case 'shuffle-all':
        handleShuffleAll();
        break;
      case 'spin-unfrozen':
        runAnimatedSpin(false);
        break;
      case 'surprise-me':
        runAnimatedSpin(true);
        break;
      case 'toggle-freeze':
        if (slotId) {
          handleToggleFreeze(slotId);
        }
        break;
      case 'unlock-all':
        handleUnlockAll();
        break;
      case 'reveal-slot':
        if (slotId) {
          handleRevealSlot(slotId);
        }
        break;
      case 'dismiss-spin-error':
        handleDismissSpinError();
        break;
      case 'nav-slots':
        handleNavView('slots');
        break;
      case 'nav-history':
        handleNavView('history');
        break;
      case 'edit-option':
        if (slotId && optionId) {
          const slot = getState().slots.find((entry) => entry.id === slotId);
          const option = slot?.options.find((entry) => entry.id === optionId);
          if (option) {
            beginOptionEdit(slotId, optionId, option.label);
          }
        }
        break;
      default:
        closeAllOptionMenus();
        break;
    }
  });

  document.addEventListener('change', (event) => {
    if (isSpinLocked()) {
      return;
    }

    const target = event.target;

    if (target instanceof HTMLSelectElement && target.dataset.action === 'force-select') {
      const slotId = target.dataset.slotId;
      const optionId = target.value;
      if (slotId && optionId) {
        handleForceSelect(slotId, optionId);
        target.value = '';
      }
      return;
    }

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.action === 'csv-file' && target.files?.[0] && target.dataset.slotId) {
      handleCsvImport(target.dataset.slotId, target.files[0]).finally(() => {
        target.value = '';
      });
      return;
    }

    if (target.dataset.action === 'edit-slot-title' && target.dataset.slotId) {
      handleSlotTitleChange(target.dataset.slotId, target.value);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (isSpinLocked()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.action === 'add-option' && event.key === 'Enter') {
      event.preventDefault();
      const slotId = target.dataset.slotId;
      if (slotId) {
        handleAddOption(slotId, target.value);
        target.value = '';
      }
    }

    if (target.dataset.action === 'commit-option-edit') {
      const slotId = target.dataset.slotId;
      const optionId = target.dataset.optionId;
      if (!slotId || !optionId) {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const slot = getState().slots.find((entry) => entry.id === slotId);
        const option = slot?.options.find((entry) => entry.id === optionId);
        handleOptionEdit(slotId, optionId, target.value, option?.label ?? '');
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        scheduleRender();
      }
    }
  });

  document.addEventListener('blur', (event) => {
    if (isSpinLocked()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.action === 'commit-option-edit') {
      const slotId = target.dataset.slotId;
      const optionId = target.dataset.optionId;
      if (!slotId || !optionId) {
        return;
      }

      const slot = getState().slots.find((entry) => entry.id === slotId);
      const option = slot?.options.find((entry) => entry.id === optionId);
      handleOptionEdit(slotId, optionId, target.value, option?.label ?? '');
    }
  }, true);

  document.addEventListener('dragstart', (event) => {
    if (isSpinLocked()) {
      event.preventDefault();
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;
    if (action === 'drag-slot' && target.dataset.slotId) {
      dragPayload = { type: 'slot', id: target.dataset.slotId };
      event.dataTransfer?.setData('text/plain', target.dataset.slotId);
      return;
    }

    const row = target.closest('[data-action="drag-option"]');
    if (row instanceof HTMLElement && row.dataset.slotId && row.dataset.optionId) {
      dragPayload = {
        type: 'option',
        id: row.dataset.optionId,
        slotId: row.dataset.slotId,
      };
      row.classList.add('option-row--dragging');
      event.dataTransfer?.setData('text/plain', row.dataset.optionId);
    }
  });

  document.addEventListener('dragend', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement) {
      target.classList.remove('option-row--dragging');
    }

    document.querySelectorAll('.option-row--drop-target').forEach((element) => {
      element.classList.remove('option-row--drop-target');
    });

    dragPayload = null;
    dropTargetOptionId = null;
    dropTargetSlotId = null;
  });

  document.addEventListener('dragover', (event) => {
    if (isSpinLocked() || !dragPayload) {
      return;
    }

    event.preventDefault();
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (dragPayload.type === 'slot') {
      const editor = target.closest('.slot-editor');
      if (editor instanceof HTMLElement && editor.dataset.slotId) {
        dropTargetSlotId = editor.dataset.slotId;
      }
      return;
    }

    const row = target.closest('.option-row');
    if (row instanceof HTMLElement && row.dataset.optionId) {
      dropTargetOptionId = row.dataset.optionId;
      document.querySelectorAll('.option-row--drop-target').forEach((element) => {
        element.classList.remove('option-row--drop-target');
      });
      row.classList.add('option-row--drop-target');
    }
  });

  document.addEventListener('drop', (event) => {
    event.preventDefault();

    if (isSpinLocked() || !dragPayload) {
      return;
    }

    if (dragPayload.type === 'slot' && dropTargetSlotId) {
      handleSlotDrop(dragPayload.id, dropTargetSlotId);
      return;
    }

    if (
      dragPayload.type === 'option' &&
      dragPayload.slotId &&
      dropTargetOptionId
    ) {
      handleOptionDrop(dragPayload.slotId, dragPayload.id, dropTargetOptionId);
    }
  });
}

export function initApp() {
  const modalRoot = document.getElementById('modal-root');
  if (!(modalRoot instanceof HTMLElement)) {
    throw new Error('Missing #modal-root element');
  }

  initModal(modalRoot);
  loadSession();
  bindEvents();
  scheduleRender();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
