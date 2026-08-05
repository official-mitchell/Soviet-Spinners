// Application bootstrap and event wiring — Slot Management UI §2–§7.
// Updated: 2026-08-05 — links mode, link CSV import, and slot action menus.

import { countDrawableSlots } from '../data/spin.js';
import {
  addOption,
  clearSlotOptions,
  clearForceSelect,
  commitSpinDraws,
  createSlot,
  deleteOption,
  deleteSlot,
  forceSelect,
  getState,
  hasSpinDraws,
  importCsvOptions,
  importLinkCsvOptions,
  loadSession,
  planSpin,
  reorderOptions,
  reorderSlots,
  revealSlot,
  setSlotFrozen,
  setSlotEliminateOnSpin,
  setSlotLinksMode,
  setTotalRounds,
  shuffleAll,
  toggleOptionHighlight,
  unlockAll,
  updateOption,
  updateOptionLink,
  updateSlotTitle,
} from '../data/index.js';
import { confirmDialog, initModal, isModalOpen } from './modal.js';
import {
  beginOptionEdit,
  closeAllForceSelectPopups,
  closeAllImportMenus,
  closeAllOptionMenus,
  closeAllSlotActionMenus,
  renderAppShell,
  renderForceSelectPopup,
  renderImportMenu,
  renderOptionMenu,
  renderSlotActionsMenu,
} from './render.js';
import { getDeleteSlotMessage, shouldConfirmSlotDelete } from './slot-actions.js';
import { runSpinAnimation } from './spin-controller.js';
import { openGatedLaunch } from './launch-gate.js';
import { toPresentationModeUrl } from './slides-url.js';
import { wireMachineHandle } from './machine-handle.js';
import { startSpinSoundSequence, stopSpinSoundSequence } from './sound.js';
import {
  captureScrollState,
  flushDeferredRender,
  restoreScrollState,
  shouldDeferRender,
} from './edit-state.js';

/** @type {{ focusSlotTitleId: string | null, focusAddOptionSlotId: string | null, focusAddLinkSlotId: string | null, importSummaries: Record<string, import('../data/types.js').CsvImportSummary>, spinningSlotIds: string[], spinLocked: boolean, spinError: string | null, activeView: 'slots' | 'history', spinDrawLabels: Record<string, string> }} */
const uiState = {
  focusSlotTitleId: null,
  focusAddOptionSlotId: null,
  focusAddLinkSlotId: null,
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

const LAUNCH_FAILURE_MESSAGE =
  'Could not launch the deck. Use a valid Google Slides link and allow pop-ups.';

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
  uiState.focusAddLinkSlotId = next.focusAddLinkSlotId ?? null;
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

  const session = getState();
  const unfrozenDrawable = countDrawableSlots(session.slots, false);
  wireMachineHandle({
    onPull: () => runAnimatedSpin(false),
    disabled: spinInProgress || unfrozenDrawable === 0,
    spinning: spinInProgress,
  });

  restoreScrollState(scrollState);

  uiState.focusSlotTitleId = null;
  uiState.focusAddOptionSlotId = null;
  uiState.focusAddLinkSlotId = null;
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

  startSpinSoundSequence();

  await runSpinAnimation(plan.draws, (draws) => {
    stopSpinSoundSequence();

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
function handleOpenForceSelect(slotId) {
  if (isSpinLocked()) {
    return;
  }

  const slot = getState().slots.find((entry) => entry.id === slotId);
  if (!slot) {
    return;
  }

  renderForceSelectPopup(slotId, slot.options);
}

/**
 * @param {string} slotId
 */
function handleClearForceSelect(slotId) {
  if (isSpinLocked()) {
    return;
  }

  try {
    clearForceSelect(slotId);
    scheduleRender();
  } catch (error) {
    console.debug('[ui] clearForceSelect failed:', error);
  }
}

/**
 * @param {import('../data/types.js').Slot} slot
 * @returns {string}
 */
function resolveRevealUrl(slot) {
  if (!slot.currentResult) {
    throw new Error('No result to reveal');
  }

  const option =
    slot.options.find((entry) => entry.id === slot.currentResult.optionId) ??
    slot.eliminatedOptions?.find((entry) => entry.id === slot.currentResult.optionId);

  if (slot.linksMode && option?.url) {
    return option.url;
  }

  return toPresentationModeUrl(slot.currentResult.label);
}

/**
 * @param {string} slotId
 */
function handleRevealSlot(slotId) {
  if (isSpinLocked()) {
    return;
  }

  try {
    const slot = getState().slots.find((entry) => entry.id === slotId);

    if (!slot?.currentResult) {
      throw new Error('No result to reveal');
    }

    const presentationUrl = resolveRevealUrl(slot);
    openGatedLaunch(presentationUrl);
    revealSlot(slotId);
    spinErrorMessage = null;
    scheduleRender({ spinError: null });
  } catch (error) {
    spinErrorMessage = LAUNCH_FAILURE_MESSAGE;
    console.debug('[ui] reveal launch failed:', error);
    scheduleRender({ spinError: spinErrorMessage });
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
function syncReelHeaderTitle(slotId, title) {
  const headerTitle = document.querySelector(
    `.reel-card[data-slot-id="${slotId}"] .reel-card__header-title`,
  );
  if (headerTitle) {
    headerTitle.textContent = title;
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
  syncReelHeaderTitle(slotId, trimmed);
  scheduleRender();
}

/**
 * @param {string} rawValue
 */
function handleTotalRoundsChange(rawValue) {
  if (isSpinLocked()) {
    return;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    scheduleRender();
    return;
  }

  try {
    setTotalRounds(trimmed);
    scheduleRender();
  } catch (error) {
    console.debug('[ui] setTotalRounds failed:', error);
    scheduleRender();
  }
}

/**
 * @param {string} slotId
 */
async function handleClearSlotOptions(slotId) {
  if (isSpinLocked()) {
    return;
  }

  const slot = getState().slots.find((entry) => entry.id === slotId);
  if (!slot || slot.options.length === 0) {
    return;
  }

  const confirmed = await confirmDialog({
    title: 'Delete all inputs',
    message: `Remove all ${slot.options.length} options from '${slot.title}'?`,
    confirmLabel: 'Delete all inputs',
    cancelLabel: 'Cancel',
  });

  if (!confirmed) {
    return;
  }

  clearSlotOptions(slotId);
  closeAllSlotActionMenus();
  scheduleRender();
}

/**
 * @param {string} slotId
 * @param {string} label
 * @param {string} [url]
 */
function handleAddOption(slotId, label, url) {
  if (isSpinLocked()) {
    return;
  }

  const trimmed = label.trim();
  if (!trimmed) {
    return;
  }

  addOption(slotId, trimmed, url);
  scheduleRender({ focusAddOptionSlotId: slotId });
}

/**
 * @param {string} slotId
 */
function clearAddOptionInputs(slotId) {
  const editor = document.querySelector(`.slot-editor[data-slot-id="${slotId}"]`);
  if (!(editor instanceof HTMLElement)) {
    return;
  }

  const nameInput = editor.querySelector('[data-action="add-option"]');
  const linkInput = editor.querySelector('[data-action="add-option-link"]');

  if (nameInput instanceof HTMLInputElement) {
    nameInput.value = '';
  }

  if (linkInput instanceof HTMLInputElement) {
    linkInput.value = '';
  }
}

/**
 * @param {string} slotId
 */
function readPendingLinkUrl(slotId) {
  const linkInput = document.querySelector(
    `[data-action="add-option-link"][data-slot-id="${slotId}"]`,
  );
  return linkInput instanceof HTMLInputElement ? linkInput.value : '';
}

/**
 * @param {string} slotId
 */
function submitAddOption(slotId) {
  const nameInput = document.querySelector(
    `[data-action="add-option"][data-slot-id="${slotId}"]`,
  );

  if (!(nameInput instanceof HTMLInputElement)) {
    return;
  }

  const slot = getState().slots.find((entry) => entry.id === slotId);
  const url = slot?.linksMode ? readPendingLinkUrl(slotId) : undefined;
  handleAddOption(slotId, nameInput.value, url);
  clearAddOptionInputs(slotId);
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
 * @param {'single' | 'links'} format
 */
async function handleCsvImport(slotId, file, format = 'single') {
  if (isSpinLocked()) {
    return;
  }

  const text = await file.text();
  const summary =
    format === 'links' ? importLinkCsvOptions(slotId, text) : importCsvOptions(slotId, text);

  closeAllImportMenus();
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

  document.addEventListener('input', (event) => {
    if (isSpinLocked()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.action === 'edit-slot-title' && target.dataset.slotId) {
      syncReelHeaderTitle(target.dataset.slotId, target.value);
    }
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
      closeAllSlotActionMenus();
      closeAllImportMenus();
      closeAllForceSelectPopups();
      return;
    }

    const action = actionElement.dataset.action;

    if (isSpinLocked() && action !== 'dismiss-spin-error') {
      return;
    }

    if (action !== 'open-force-select' && action !== 'force-select-option') {
      closeAllForceSelectPopups();
    }

    const slotId = actionElement.dataset.slotId;
    const optionId = actionElement.dataset.optionId;

    switch (action) {
      case 'add-slot':
        handleAddSlot();
        break;
      case 'delete-slot':
        if (slotId) {
          closeAllSlotActionMenus();
          handleDeleteSlot(slotId);
        }
        break;
      case 'clear-slot-options':
        if (slotId) {
          handleClearSlotOptions(slotId);
        }
        break;
      case 'toggle-slot-actions-menu':
        if (slotId) {
          event.stopPropagation();
          renderSlotActionsMenu(slotId);
        }
        break;
      case 'toggle-import-menu':
        if (slotId) {
          event.stopPropagation();
          renderImportMenu(slotId);
        }
        break;
      case 'import-csv-single':
        if (slotId) {
          const fileInput = document.querySelector(
            `[data-action="csv-file"][data-import-format="single"][data-slot-id="${slotId}"]`,
          );
          if (fileInput instanceof HTMLInputElement) {
            fileInput.click();
          }
        }
        break;
      case 'import-csv-links':
        if (slotId) {
          const fileInput = document.querySelector(
            `[data-action="csv-file"][data-import-format="links"][data-slot-id="${slotId}"]`,
          );
          if (fileInput instanceof HTMLInputElement) {
            fileInput.click();
          }
        }
        break;
      case 'focus-add-option':
        if (slotId) {
          scheduleRender({ focusAddOptionSlotId: slotId });
        }
        break;
      case 'focus-add-link':
        if (slotId) {
          scheduleRender({ focusAddLinkSlotId: slotId, focusAddOptionSlotId: slotId });
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
          renderImportMenu(slotId);
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
      case 'open-force-select':
        if (slotId) {
          event.stopPropagation();
          handleOpenForceSelect(slotId);
        }
        break;
      case 'force-select-option':
        if (slotId && optionId) {
          handleForceSelect(slotId, optionId);
          closeAllForceSelectPopups();
        }
        break;
      case 'clear-force-select':
        if (slotId) {
          handleClearForceSelect(slotId);
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

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.action === 'csv-file' && target.files?.[0] && target.dataset.slotId) {
      const format = target.dataset.importFormat === 'links' ? 'links' : 'single';
      handleCsvImport(target.dataset.slotId, target.files[0], format).finally(() => {
        target.value = '';
      });
      return;
    }

    if (target.dataset.action === 'edit-slot-title' && target.dataset.slotId) {
      handleSlotTitleChange(target.dataset.slotId, target.value);
      return;
    }

    if (target.dataset.action === 'edit-total-rounds') {
      handleTotalRoundsChange(target.value);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (isSpinLocked() || isModalOpen()) {
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      const activeRow = document.activeElement?.closest('.option-row');
      if (activeRow instanceof HTMLElement) {
        const slotId = activeRow.dataset.slotId;
        const optionId = activeRow.dataset.optionId;
        const slot = getState().slots.find((entry) => entry.id === slotId);

        if (slot?.linksMode && slotId && optionId) {
          event.preventDefault();
          const option = slot.options.find((entry) => entry.id === optionId);
          const nextUrl = window.prompt('Paste link URL', option?.url ?? '');

          if (nextUrl !== null) {
            updateOptionLink(slotId, optionId, nextUrl);
            scheduleRender();
          }
        }
      }
      return;
    }

    const target = event.target;

    if (
      target instanceof HTMLElement &&
      target.dataset.action === 'open-force-select' &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault();
      const slotId = target.dataset.slotId;
      if (slotId) {
        handleOpenForceSelect(slotId);
      }
      return;
    }

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.action === 'add-option' && event.key === 'Enter') {
      event.preventDefault();
      const slotId = target.dataset.slotId;
      if (slotId) {
        submitAddOption(slotId);
      }
    }

    if (target.dataset.action === 'add-option-link' && event.key === 'Enter') {
      event.preventDefault();
      const slotId = target.dataset.slotId;
      if (slotId) {
        submitAddOption(slotId);
      }
    }

    if (target.dataset.action === 'edit-total-rounds' && event.key === 'Enter') {
      event.preventDefault();
      handleTotalRoundsChange(target.value);
      target.blur();
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

  document.addEventListener('change', (event) => {
    if (isSpinLocked() || isModalOpen()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.action === 'toggle-eliminate-on-spin' && target.dataset.slotId) {
      setSlotEliminateOnSpin(target.dataset.slotId, target.checked);
      scheduleRender();
      return;
    }

    if (target.dataset.action === 'toggle-links-mode' && target.dataset.slotId) {
      setSlotLinksMode(target.dataset.slotId, target.checked);
      scheduleRender();
    }
  });

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
