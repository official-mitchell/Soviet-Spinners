// DOM rendering for slot management UI — checklist §2–§7.
// Updated: 2026-08-05 — eliminated options panel per slot editor.

import { countDrawableSlots } from '../data/spin.js';
import { getForcedSlotTitles, isForcedRoundResult, resolveHistorySlotTitle } from './history-display.js';
import { renderReelDrumViewport } from './reel-drum.js';
import { getReelDisplayState } from './reveal.js';

const ACCENT_CLASSES = ['slot-editor--accent-red', 'slot-editor--accent-gold', 'slot-editor--accent-metal'];

/**
 * @param {import('../data/types.js').SessionState} session
 * @param {Object} [uiState]
 * @param {string | null} [uiState.focusSlotTitleId]
 * @param {string | null} [uiState.focusAddOptionSlotId]
 * @param {Record<string, import('../data/types.js').CsvImportSummary>} [uiState.importSummaries]
 * @param {string[]} [uiState.spinningSlotIds]
 * @param {boolean} [uiState.spinLocked]
 * @param {string | null} [uiState.spinError]
 * @param {'slots' | 'history'} [uiState.activeView]
 * @param {Record<string, string>} [uiState.spinDrawLabels]
 */
export function renderAppShell(session, uiState = {}) {
  const app = document.getElementById('app');
  if (!app) {
    return;
  }

  const activeView = uiState.activeView === 'history' ? 'history' : 'slots';
  const sortedSlots = [...session.slots].sort((a, b) => a.order - b.order);
  const activeCount = sortedSlots.filter((slot) => !slot.frozen).length;
  const spinLocked = Boolean(uiState.spinLocked);
  const unfrozenDrawable = countDrawableSlots(sortedSlots, false);
  const anyDrawable = countDrawableSlots(sortedSlots, true);
  const spinControls = {
    spinLocked,
    spinUnfrozenDisabled: spinLocked || unfrozenDrawable === 0,
    surpriseDisabled: spinLocked || anyDrawable === 0,
    shuffleDisabled: spinLocked,
    unfrozenDrawable,
    anyDrawable,
  };

  app.innerHTML = `
    ${renderSidebar(activeView)}
    <main class="main">
      ${renderPageHeader(activeView)}
      ${
        activeView === 'history'
          ? renderHistoryView(session)
          : `
            ${renderMachineHousing(sortedSlots, uiState, spinControls)}
            ${renderEditorSection(sortedSlots, uiState, spinLocked)}
          `
      }
    </main>
    ${renderUtilityRail(session, activeCount, spinLocked, activeView)}
  `;

  applyPostRenderFocus(uiState);
}

/** @param {'slots' | 'history'} activeView */
function renderSidebar(activeView) {
  return `
    <aside class="sidebar surface-metal" aria-label="Primary navigation">
      <div class="wordmark">
        <span class="wordmark__star" aria-hidden="true">★</span>
        <div class="wordmark__text">
          <span class="wordmark__primary">SOVIET</span>
          <span class="wordmark__secondary">SPINNERS</span>
        </div>
      </div>
      <nav>
        <ul class="nav-list">
          <li>${renderNavItem('slots', '▣', 'Slots', activeView)}</li>
          <li>${renderNavItem('history', '◷', 'History', activeView)}</li>
          <li>${renderNavItem('templates', '▤', 'Templates', activeView, true)}</li>
          <li>${renderNavItem('my-games', '★', 'My Games', activeView, true)}</li>
          <li>${renderNavItem('settings', '⚙', 'Settings', activeView, true)}</li>
        </ul>
      </nav>
    </aside>
  `;
}

/**
 * @param {string} view
 * @param {string} icon
 * @param {string} label
 * @param {'slots' | 'history'} activeView
 * @param {boolean} [stubOnly]
 */
function renderNavItem(view, icon, label, activeView, stubOnly = false) {
  const isActive = !stubOnly && activeView === view;
  const activeClass = isActive ? ' nav-item--active' : '';
  const disabled = stubOnly ? 'disabled' : '';
  const action = stubOnly ? '' : `data-action="nav-${view}"`;

  return `
    <button type="button" class="nav-item${activeClass}" ${action} ${disabled}>
      <span class="nav-item__icon" aria-hidden="true">${icon}</span>
      <span>${label}</span>
    </button>
  `;
}

/** @param {'slots' | 'history'} activeView */
function renderPageHeader(activeView) {
  const title = activeView === 'history' ? 'Round History' : 'Game Night Picks';
  const subtitle =
    activeView === 'history'
      ? 'Append-only log of completed rounds'
      : 'Edit slots, options, and spin controls';

  return `
    <header class="page-header">
      <div>
        <h1 class="page-header__title">${title}</h1>
        <p class="page-header__subtitle">${subtitle}</p>
      </div>
    </header>
  `;
}

/** @param {import('../data/types.js').SessionState} session */
function renderHistoryView(session) {
  const rounds = [...session.roundHistory].reverse();
  const slotById = new Map(session.slots.map((slot) => [slot.id, slot]));

  if (rounds.length === 0) {
    return `
      <section class="history-panel surface-gold-frame" aria-label="Round history">
        <p class="history-panel__empty">No rounds completed yet. Spin the machine to start logging history.</p>
      </section>
    `;
  }

  const rows = rounds
    .map((round) => {
      const summary = round.results
        .map((result) => {
          const forced = isForcedRoundResult(round, result.slotId);
          const label = result.label ?? 'Unknown';
          const title = resolveHistorySlotTitle(result, slotById);
          const forcedClass = forced ? ' history-table__entry--forced' : '';
          const prefix = forced ? '⚡ ' : '';
          return `<span class="history-table__entry${forcedClass}">${prefix}${escapeHtml(title)}: ${escapeHtml(label)}</span>`;
        })
        .join(' · ');

      const forcedTitles = getForcedSlotTitles(round, slotById);
      const forcedBadges =
        forcedTitles.length > 0
          ? forcedTitles
              .map(
                (title) =>
                  `<span class="history-table__forced-badge">⚡ ${escapeHtml(title)}</span>`,
              )
              .join('')
          : '<span class="history-table__forced-badge history-table__forced-badge--none">—</span>';

      return `
        <tr>
          <th scope="row">Round ${round.roundNumber}</th>
          <td class="history-table__results">${summary}</td>
          <td class="history-table__flags">${forcedBadges}</td>
          <td class="history-table__time">${formatRoundTime(round.timestamp)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <section class="history-panel surface-gold-frame" aria-label="Round history">
      <table class="history-table">
        <thead>
          <tr>
            <th scope="col">Round</th>
            <th scope="col">Results</th>
            <th scope="col">Forced</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

/** @param {number} timestamp */
function formatRoundTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** @param {import('../data/types.js').Slot[]} slots */
function renderMachineHousing(slots, uiState, spinControls) {
  return `
    <section class="machine-housing surface-gold-frame" aria-label="Slot machine">
      <h2 class="machine-housing__label">Game Night Picks</h2>
      ${renderSpinError(uiState.spinError)}
      <div class="reel-row" id="reel-row">
        ${slots.map((slot) => renderReelCard(slot, uiState, spinControls.spinLocked)).join('')}
      </div>
      ${renderSpinControls(spinControls)}
    </section>
  `;
}

/**
 * @param {string | null | undefined} message
 */
function renderSpinError(message) {
  if (!message) {
    return '';
  }

  return `
    <div class="spin-error" role="alert">
      <p class="spin-error__message">${escapeHtml(message)}</p>
      <button type="button" class="btn btn--secondary" data-action="dismiss-spin-error">Try again</button>
    </div>
  `;
}

/**
 * @param {{
 *   spinUnfrozenDisabled: boolean,
 *   surpriseDisabled: boolean,
 *   shuffleDisabled: boolean,
 *   unfrozenDrawable: number,
 *   anyDrawable: number,
 * }} spinControls
 */
function renderSpinControls(spinControls) {
  const spinUnfrozenAttr = spinControls.spinUnfrozenDisabled ? 'disabled' : '';
  const surpriseAttr = spinControls.surpriseDisabled ? 'disabled' : '';
  const shuffleAttr = spinControls.shuffleDisabled ? 'disabled' : '';
  const supportText = spinControls.unfrozenDrawable === 0
    ? 'Unfreeze at least one slot with options'
    : `${spinControls.unfrozenDrawable} active slot${spinControls.unfrozenDrawable === 1 ? '' : 's'} will spin`;

  return `
    <div class="spin-controls">
      <button type="button" class="btn btn--secondary btn--shuffle" data-action="shuffle-all" ${shuffleAttr}>Shuffle all</button>
      <button type="button" class="btn btn--spin surface-red-enamel" data-action="spin-unfrozen" ${spinUnfrozenAttr}>
        <span class="btn--spin__icon" aria-hidden="true">◎</span>
        <span class="btn--spin__label">Spin unfrozen slots</span>
        <span class="btn--spin__support">${supportText}</span>
      </button>
      <button type="button" class="btn btn--secondary btn--surprise" data-action="surprise-me" ${surpriseAttr}>Surprise me</button>
    </div>
  `;
}

/** @param {import('../data/types.js').Slot[]} slots */
function renderEditorSection(slots, uiState, spinLocked) {
  const lockedClass = spinLocked ? ' editor-section--locked' : '';
  const lockedAttr = spinLocked ? 'disabled' : '';

  return `
    <section class="editor-section${lockedClass}" aria-label="Edit slots and options">
      <div class="editor-section__header">
        <h2 class="editor-section__title">Edit slots &amp; options</h2>
        <button type="button" class="btn btn--secondary" data-action="add-slot" ${lockedAttr}>Add slot</button>
      </div>
      <div class="slot-editors" id="slot-editors">
        ${slots.map((slot, index) => renderSlotEditor(slot, index, uiState.importSummaries?.[slot.id], spinLocked)).join('')}
        ${renderAddSlotCard(spinLocked)}
      </div>
    </section>
  `;
}

/** @param {import('../data/types.js').SessionState} session */
function renderUtilityRail(session, activeCount, spinLocked, activeView) {
  const frozenCount = session.slots.filter((slot) => slot.frozen).length;
  const unlockDisabled = frozenCount === 0 || spinLocked ? 'disabled' : '';
  const hideOnHistory = activeView === 'history' ? ' utility-rail--history' : '';
  const roundOverClass =
    session.currentRound > session.totalRounds ? ' stat-card--over-target' : '';

  return `
    <aside class="utility-rail${hideOnHistory}" aria-label="Round and slot utilities">
      <div class="stat-card${roundOverClass}">
        <p class="stat-card__label">Round</p>
        <p class="stat-card__value">${session.currentRound}</p>
        <p class="stat-card__hint">of ${session.totalRounds}</p>
      </div>
      <div class="stat-card">
        <label class="stat-card__label" for="total-rounds-input">Total rounds</label>
        <input
          id="total-rounds-input"
          class="stat-card__input"
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          value="${session.totalRounds}"
          data-action="edit-total-rounds"
          ${spinLocked ? 'disabled' : ''}
        />
      </div>
      <div class="stat-row">
        <div class="stat-chip stat-chip--active">
          <span class="stat-chip__value">${activeCount}</span>
          <span class="stat-chip__label">Active</span>
        </div>
        <div class="stat-chip stat-chip--frozen">
          <span class="stat-chip__value">${frozenCount}</span>
          <span class="stat-chip__label">Frozen</span>
        </div>
      </div>
      <button type="button" class="btn btn--secondary btn--block" data-action="unlock-all" ${unlockDisabled}>Unlock all</button>
      <button type="button" class="btn btn--primary btn--block" data-action="add-slot" ${spinLocked ? 'disabled' : ''}>Add slot +</button>
    </aside>
  `;
}

/** @param {import('../data/types.js').Slot} slot */
function renderReelCard(slot, uiState = {}, spinLocked = false) {
  const spinning = uiState.spinningSlotIds?.includes(slot.id);
  const display = getReelDisplayState(slot);
  const controlDisabled = spinLocked ? 'disabled' : '';
  const spinTargetLabel = uiState.spinDrawLabels?.[slot.id];
  const frozenBadge = slot.frozen
    ? `<span class="reel-card__frozen-badge"><span aria-hidden="true">🔒</span> Frozen</span>`
    : '';
  const eliminatedCount = slot.eliminatedOptions?.length ?? 0;
  const poolMeta =
    eliminatedCount > 0
      ? `<p class="reel-card__pool-meta">${slot.options.length} in pool · ${eliminatedCount} eliminated</p>`
      : slot.options.length > 0
        ? `<p class="reel-card__pool-meta">${slot.options.length} in pool</p>`
        : '';

  const drumMarkup = renderReelDrumViewport(slot, display, Boolean(spinning), spinTargetLabel);

  const forceSelectOptions = slot.options.length
    ? slot.options
        .map(
          (option) =>
            `<option value="${escapeAttr(option.id)}">${escapeHtml(option.label)}</option>`,
        )
        .join('')
    : '<option value="">No options</option>';

  return `
    <article class="reel-card ${slot.frozen ? 'reel-card--frozen' : ''}" data-slot-id="${slot.id}">
      ${frozenBadge}
      <header class="reel-card__header">${escapeHtml(slot.title)}</header>
      ${poolMeta}
      <div class="reel-card__viewport ${display.kind === 'gated-prompt' ? 'reel-card__viewport--gated' : ''}">
        ${drumMarkup}
      </div>
      <div class="reel-card__controls">
        <button
          type="button"
          class="btn btn--secondary btn--freeze"
          data-action="toggle-freeze"
          data-slot-id="${slot.id}"
          ${controlDisabled}
        >${slot.frozen ? 'Unfreeze' : 'Freeze'}</button>
        <label class="reel-card__force-select">
          <span class="sr-only">Force select for ${escapeAttr(slot.title)}</span>
          <select data-action="force-select" data-slot-id="${slot.id}" ${slot.options.length === 0 || spinLocked ? 'disabled' : ''}>
            <option value="">Force select…</option>
            ${forceSelectOptions}
          </select>
        </label>
      </div>
      ${
        display.kind === 'gated-prompt'
          ? `<button type="button" class="btn btn--secondary btn--block reel-card__reveal" data-action="reveal-slot" data-slot-id="${slot.id}">Reveal &amp; Launch</button>`
          : ''
      }
    </article>
  `;
}

/**
 * @param {import('../data/types.js').Slot} slot
 * @param {number} index
 * @param {import('../data/types.js').CsvImportSummary} [importSummary]
 * @param {boolean} [spinLocked]
 */
function renderSlotEditor(slot, index, importSummary, spinLocked = false) {
  const accentClass = ACCENT_CLASSES[index % ACCENT_CLASSES.length];
  const lockedAttr = spinLocked ? 'disabled' : '';
  const dragEnabled = spinLocked ? 'false' : 'true';

  return `
    <article class="slot-editor ${accentClass}" data-slot-id="${slot.id}">
      <header class="slot-editor__header">
        <span class="slot-editor__drag" draggable="${dragEnabled}" data-action="drag-slot" data-slot-id="${slot.id}" aria-label="Reorder slot" title="Drag to reorder">⋮⋮</span>
        <input
          type="text"
          class="slot-editor__title-input"
          data-action="edit-slot-title"
          data-slot-id="${slot.id}"
          value="${escapeAttr(slot.title)}"
          maxlength="40"
          aria-label="Slot title"
          ${lockedAttr}
        />
        <button type="button" class="slot-editor__icon-btn" data-action="focus-add-option" data-slot-id="${slot.id}" aria-label="Add option" ${lockedAttr}>+</button>
        <button type="button" class="slot-editor__icon-btn slot-editor__icon-btn--danger" data-action="delete-slot" data-slot-id="${slot.id}" aria-label="Delete slot" ${lockedAttr}>🗑</button>
      </header>
      <ul class="slot-editor__options" data-slot-id="${slot.id}">
        ${slot.options.map((option) => renderOptionRow(slot.id, option, spinLocked)).join('')}
      </ul>
      ${renderEliminatedOptions(slot)}
      <footer class="slot-editor__footer">
        ${importSummary ? renderImportSummary(importSummary) : ''}
        <div class="slot-editor__footer-actions">
          <input
            type="text"
            class="add-option-input"
            data-action="add-option"
            data-slot-id="${slot.id}"
            placeholder="+ Add option"
            aria-label="Add option to ${escapeAttr(slot.title)}"
            ${lockedAttr}
          />
          <button type="button" class="btn btn--secondary btn--import" data-action="import-csv" data-slot-id="${slot.id}" ${lockedAttr}>
            Import CSV
          </button>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          class="sr-only"
          data-action="csv-file"
          data-slot-id="${slot.id}"
          aria-hidden="true"
          tabindex="-1"
        />
      </footer>
    </article>
  `;
}

/**
 * @param {import('../data/types.js').Slot} slot
 */
function renderEliminatedOptions(slot) {
  const eliminated = slot.eliminatedOptions ?? [];

  if (eliminated.length === 0) {
    return '';
  }

  return `
    <section class="slot-editor__eliminated" aria-label="Eliminated options for ${escapeAttr(slot.title)}">
      <h3 class="slot-editor__eliminated-title">Eliminated (${eliminated.length})</h3>
      <ul class="slot-editor__eliminated-list">
        ${eliminated
          .map(
            (option) =>
              `<li class="eliminated-option"><span class="eliminated-option__label">${escapeHtml(option.label)}</span></li>`,
          )
          .join('')}
      </ul>
    </section>
  `;
}

/**
 * @param {string} slotId
 * @param {import('../data/types.js').Option} option
 * @param {boolean} [spinLocked]
 */
function renderOptionRow(slotId, option, spinLocked = false) {
  const lockedAttr = spinLocked ? 'disabled' : '';
  const dragEnabled = spinLocked ? 'false' : 'true';

  return `
    <li
      class="option-row"
      data-slot-id="${slotId}"
      data-option-id="${option.id}"
      draggable="${dragEnabled}"
      data-action="drag-option"
    >
      <span class="option-row__drag" aria-hidden="true">⋮⋮</span>
      <span class="option-row__label" data-action="edit-option" data-slot-id="${slotId}" data-option-id="${option.id}">${escapeHtml(option.label)}</span>
      <button
        type="button"
        class="option-row__star ${option.highlighted ? 'option-row__star--active' : ''}"
        data-action="toggle-highlight"
        data-slot-id="${slotId}"
        data-option-id="${option.id}"
        aria-label="${option.highlighted ? 'Remove highlight' : 'Highlight option'}"
        aria-pressed="${option.highlighted ? 'true' : 'false'}"
        ${lockedAttr}
      >★</button>
      <div class="option-row__menu-wrap">
        <button
          type="button"
          class="option-row__menu-btn"
          data-action="toggle-option-menu"
          data-slot-id="${slotId}"
          data-option-id="${option.id}"
          aria-label="Option menu"
          ${lockedAttr}
        >⋯</button>
      </div>
    </li>
  `;
}

function renderImportSummary(summary) {
  const malformedList = summary.malformedRows.length
    ? `<ul class="import-summary__list">${summary.malformedRows
        .map((row) => `<li>${escapeHtml(row)}</li>`)
        .join('')}</ul>`
    : '';

  return `
    <div class="import-summary" role="status">
      <p class="import-summary__message">${escapeHtml(formatImportSummaryText(summary))}</p>
      ${malformedList}
    </div>
  `;
}

function formatImportSummaryText(summary) {
  return `${summary.added} added, ${summary.duplicatesSkipped} duplicates skipped, ${summary.malformedCount} malformed rows`;
}

function renderAddSlotCard(spinLocked = false) {
  const disabledAttr = spinLocked ? 'disabled' : '';

  return `
    <button type="button" class="add-slot-card" data-action="add-slot" ${disabledAttr}>
      <span class="add-slot-card__star" aria-hidden="true">★</span>
      <h3 class="add-slot-card__title">Add another slot</h3>
      <p class="add-slot-card__copy">Create as many slots as you want</p>
    </button>
  `;
}

/** @param {Object} uiState */
function applyPostRenderFocus(uiState) {
  if (uiState.focusSlotTitleId) {
    const input = document.querySelector(
      `[data-action="edit-slot-title"][data-slot-id="${uiState.focusSlotTitleId}"]`,
    );
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }

  if (uiState.focusAddOptionSlotId) {
    const input = document.querySelector(
      `[data-action="add-option"][data-slot-id="${uiState.focusAddOptionSlotId}"]`,
    );
    if (input instanceof HTMLInputElement) {
      input.focus();
    }
  }
}

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** @param {string} value */
function escapeAttr(value) {
  return escapeHtml(value);
}

/**
 * @param {string} slotId
 * @param {string} optionId
 */
export function renderOptionMenu(slotId, optionId) {
  closeAllOptionMenus();

  const button = document.querySelector(
    `[data-action="toggle-option-menu"][data-slot-id="${slotId}"][data-option-id="${optionId}"]`,
  );

  if (!(button instanceof HTMLElement)) {
    return;
  }

  const wrap = button.closest('.option-row__menu-wrap');
  if (!wrap) {
    return;
  }

  const menu = document.createElement('div');
  menu.className = 'option-row__menu';
  menu.innerHTML = `
    <button type="button" class="option-row__menu-item" data-action="move-option-up" data-slot-id="${slotId}" data-option-id="${optionId}">Move up</button>
    <button type="button" class="option-row__menu-item" data-action="move-option-down" data-slot-id="${slotId}" data-option-id="${optionId}">Move down</button>
    <button type="button" class="option-row__menu-item option-row__menu-item--danger" data-action="delete-option" data-slot-id="${slotId}" data-option-id="${optionId}">Remove</button>
  `;
  wrap.appendChild(menu);
}

export function closeAllOptionMenus() {
  document.querySelectorAll('.option-row__menu').forEach((menu) => menu.remove());
}

/**
 * @param {string} slotId
 * @param {string} optionId
 * @param {string} currentLabel
 */
export function beginOptionEdit(slotId, optionId, currentLabel) {
  const label = document.querySelector(
    `.option-row[data-slot-id="${slotId}"][data-option-id="${optionId}"] .option-row__label`,
  );

  if (!(label instanceof HTMLElement)) {
    return;
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'option-row__label-input';
  input.value = currentLabel;
  input.dataset.action = 'commit-option-edit';
  input.dataset.slotId = slotId;
  input.dataset.optionId = optionId;
  label.replaceWith(input);
  input.focus();
  input.select();
}
