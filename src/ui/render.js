// DOM rendering for slot management UI — checklist §2–§3.
// Created: 2026-08-05.

const ACCENT_CLASSES = ['slot-editor--accent-red', 'slot-editor--accent-gold', 'slot-editor--accent-metal'];

/**
 * @param {import('../data/types.js').SessionState} session
 * @param {Object} [uiState]
 * @param {string | null} [uiState.focusSlotTitleId]
 * @param {string | null} [uiState.focusAddOptionSlotId]
 * @param {Record<string, import('../data/types.js').CsvImportSummary>} [uiState.importSummaries]
 */
export function renderAppShell(session, uiState = {}) {
  const app = document.getElementById('app');
  if (!app) {
    return;
  }

  const sortedSlots = [...session.slots].sort((a, b) => a.order - b.order);

  app.innerHTML = `
    ${renderSidebar()}
    <main class="main">
      ${renderPageHeader()}
      ${renderMachineHousing(sortedSlots)}
      ${renderEditorSection(sortedSlots)}
    </main>
    ${renderUtilityRail(session)}
  `;

  applyPostRenderFocus(uiState);
}

function renderSidebar() {
  return `
    <aside class="sidebar" aria-label="Primary navigation">
      <div class="wordmark">
        <span class="wordmark__star" aria-hidden="true">★</span>
        <div class="wordmark__text">
          <span class="wordmark__primary">SOVIET</span>
          <span class="wordmark__secondary">SPINNERS</span>
        </div>
      </div>
      <nav>
        <ul class="nav-list">
          <li><button type="button" class="nav-item nav-item--active"><span aria-hidden="true">▣</span><span>Slots</span></button></li>
          <li><button type="button" class="nav-item" disabled><span aria-hidden="true">◷</span><span>History</span></button></li>
          <li><button type="button" class="nav-item" disabled><span aria-hidden="true">▤</span><span>Templates</span></button></li>
          <li><button type="button" class="nav-item" disabled><span aria-hidden="true">★</span><span>My Games</span></button></li>
          <li><button type="button" class="nav-item" disabled><span aria-hidden="true">⚙</span><span>Settings</span></button></li>
        </ul>
      </nav>
    </aside>
  `;
}

function renderPageHeader() {
  return `
    <header class="page-header">
      <div>
        <h1 class="page-header__title">Game Night Picks</h1>
        <p class="page-header__subtitle">Edit slots, options, and spin controls</p>
      </div>
    </header>
  `;
}

/** @param {import('../data/types.js').Slot[]} slots */
function renderMachineHousing(slots) {
  return `
    <section class="machine-housing" aria-label="Slot machine">
      <h2 class="machine-housing__label">Game Night Picks</h2>
      <div class="reel-row" id="reel-row">
        ${slots.map((slot) => renderReelCard(slot)).join('')}
      </div>
    </section>
  `;
}

/** @param {import('../data/types.js').Slot[]} slots */
function renderEditorSection(slots) {
  return `
    <section class="editor-section" aria-label="Edit slots and options">
      <div class="editor-section__header">
        <h2 class="editor-section__title">Edit slots &amp; options</h2>
        <button type="button" class="btn btn--secondary" data-action="add-slot">Add slot</button>
      </div>
      <div class="slot-editors" id="slot-editors">
        ${slots.map((slot, index) => renderSlotEditor(slot, index, uiState.importSummaries?.[slot.id])).join('')}
        ${renderAddSlotCard()}
      </div>
    </section>
  `;
}

/** @param {import('../data/types.js').SessionState} session */
function renderUtilityRail(session) {
  const activeCount = session.slots.filter((slot) => !slot.frozen).length;
  const frozenCount = session.slots.filter((slot) => slot.frozen).length;

  return `
    <aside class="utility-rail" aria-label="Round and slot utilities">
      <div class="stat-card">
        <p class="stat-card__label">Round</p>
        <p class="stat-card__value">${session.currentRound}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Total rounds</p>
        <p class="stat-card__value">${session.totalRounds}</p>
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
      <button type="button" class="btn btn--secondary btn--block" disabled>Unlock all</button>
      <button type="button" class="btn btn--primary btn--block" data-action="add-slot">Add slot +</button>
    </aside>
  `;
}

/** @param {import('../data/types.js').Slot} slot */
function renderReelCard(slot) {
  const preview = slot.options[0]?.label ?? '—';
  return `
    <article class="reel-card ${slot.frozen ? 'reel-card--frozen' : ''}" data-slot-id="${slot.id}">
      <header class="reel-card__header">${escapeHtml(slot.title)}</header>
      <div class="reel-card__viewport">
        ${
          slot.options.length
            ? `<p class="reel-card__result">${escapeHtml(preview)}</p>`
            : '<p class="reel-card__placeholder">Add options below</p>'
        }
      </div>
    </article>
  `;
}

/**
 * @param {import('../data/types.js').Slot} slot
 * @param {number} index
 * @param {import('../data/types.js').CsvImportSummary} [importSummary]
 */
function renderSlotEditor(slot, index, importSummary) {
  const accentClass = ACCENT_CLASSES[index % ACCENT_CLASSES.length];

  return `
    <article class="slot-editor ${accentClass}" data-slot-id="${slot.id}">
      <header class="slot-editor__header">
        <span class="slot-editor__drag" draggable="true" data-action="drag-slot" data-slot-id="${slot.id}" aria-label="Reorder slot" title="Drag to reorder">⋮⋮</span>
        <input
          type="text"
          class="slot-editor__title-input"
          data-action="edit-slot-title"
          data-slot-id="${slot.id}"
          value="${escapeAttr(slot.title)}"
          maxlength="40"
          aria-label="Slot title"
        />
        <button type="button" class="slot-editor__icon-btn" data-action="focus-add-option" data-slot-id="${slot.id}" aria-label="Add option">+</button>
        <button type="button" class="slot-editor__icon-btn slot-editor__icon-btn--danger" data-action="delete-slot" data-slot-id="${slot.id}" aria-label="Delete slot">🗑</button>
      </header>
      <ul class="slot-editor__options" data-slot-id="${slot.id}">
        ${slot.options.map((option) => renderOptionRow(slot.id, option)).join('')}
      </ul>
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
          />
          <button type="button" class="btn btn--secondary btn--import" data-action="import-csv" data-slot-id="${slot.id}">
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
 * @param {string} slotId
 * @param {import('../data/types.js').Option} option
 */
function renderOptionRow(slotId, option) {
  return `
    <li
      class="option-row"
      data-slot-id="${slotId}"
      data-option-id="${option.id}"
      draggable="true"
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
      >★</button>
      <div class="option-row__menu-wrap">
        <button
          type="button"
          class="option-row__menu-btn"
          data-action="toggle-option-menu"
          data-slot-id="${slotId}"
          data-option-id="${option.id}"
          aria-label="Option menu"
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

function renderAddSlotCard() {
  return `
    <button type="button" class="add-slot-card" data-action="add-slot">
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
