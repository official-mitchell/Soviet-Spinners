// Vertical reel drum markup and transform-based spin animation — checklist §5.2.
// Updated: 2026-08-05 — center marker triangles + brass-framed drum viewport.

import { REVEAL_MODES } from '../data/constants.js';
import { SPIN_SEQUENCE_MS } from './sound.js';

/** @typedef {{ prev: string, center: string, next: string }} ReelDrumCells */

/** @typedef {'preview' | 'selected' | 'spin' | 'masked'} DrumCellVariant */

const GATED_MASK_LABEL = '••••••';
const GENERIC_SPIN_FILLER = '···';

/**
 * @returns {{
 *   staggerMs: number,
 *   travelMs: number,
 *   settleMs: number,
 *   cellHeight: number,
 *   viewportHeight: number,
 *   overshootPx: number,
 * }}
 */
function readReelMotionTokens() {
  const styles = getComputedStyle(document.documentElement);

  return {
    staggerMs: parseCssMs(styles.getPropertyValue('--reel-stagger-ms'), 140),
    travelMs: parseCssMs(styles.getPropertyValue('--reel-spin-travel-ms'), 1200),
    settleMs: parseCssMs(styles.getPropertyValue('--reel-spin-settle-ms'), 110),
    cellHeight: parseCssMs(styles.getPropertyValue('--reel-cell-height'), 80),
    viewportHeight: parseCssMs(styles.getPropertyValue('--reel-viewport-height'), 280),
    overshootPx: parseCssMs(styles.getPropertyValue('--reel-settle-overshoot-px'), 8),
  };
}

/**
 * @param {string} raw
 * @param {number} fallback
 */
function parseCssMs(raw, fallback) {
  const parsed = parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {import('../data/types.js').Slot} slot
 * @param {import('./reveal.js').ReelDisplayState} display
 * @returns {ReelDrumCells}
 */
export function getReelDrumCells(slot, display) {
  if (display.kind === 'gated-prompt') {
    return {
      prev: '—',
      center: 'Reveal & Launch',
      next: '—',
    };
  }

  if (display.kind === 'result' || display.kind === 'preview') {
    const center = display.text;
    const pool = slot.options.map((option) => option.label).filter((label) => label !== center);
    return {
      prev: pool[0] ?? '—',
      center,
      next: pool[1] ?? pool[0] ?? '—',
    };
  }

  return {
    prev: '—',
    center: display.text,
    next: '—',
  };
}

/**
 * @param {import('../data/types.js').Slot} slot
 * @param {string} targetLabel
 * @returns {string[]}
 */
export function buildSpinStripLabels(slot, targetLabel) {
  const isGated = slot.revealMode === REVEAL_MODES.GATED;

  if (isGated) {
    /** @type {string[]} */
    const strip = [];
    for (let index = 0; index < 11; index += 1) {
      strip.push(GATED_MASK_LABEL);
    }
    return strip;
  }

  const pool = slot.options.map((option) => option.label);
  const filler =
    pool.length > 1
      ? pool.filter((label) => label !== targetLabel)
      : [GENERIC_SPIN_FILLER, GENERIC_SPIN_FILLER];
  /** @type {string[]} */
  const strip = [GENERIC_SPIN_FILLER, GENERIC_SPIN_FILLER];

  for (let index = 0; index < 8; index += 1) {
    strip.push(filler[index % filler.length] ?? GENERIC_SPIN_FILLER);
  }

  strip.push(targetLabel);
  return strip;
}

/**
 * @param {string} label
 * @param {DrumCellVariant} [variant]
 * @param {{ forced?: boolean }} [options]
 */
function renderDrumCell(label, variant = 'preview', options = {}) {
  const forcedClass = options.forced ? ' reel-drum__cell--forced' : '';
  return `<div class="reel-drum__cell reel-drum__cell--${variant}${forcedClass}">${escapeHtml(label)}</div>`;
}

function renderDrumMarker() {
  return `
    <div class="reel-drum__marker" aria-hidden="true">
      <span class="reel-drum__marker-triangle reel-drum__marker-triangle--left"></span>
      <span class="reel-drum__marker-triangle reel-drum__marker-triangle--right"></span>
    </div>
  `;
}

/**
 * @param {import('../data/types.js').Slot} slot
 * @param {import('./reveal.js').ReelDisplayState} display
 * @param {boolean} spinning
 * @param {string} [spinTargetLabel]
 */
export function renderReelDrumViewport(slot, display, spinning, spinTargetLabel) {
  const isGated = slot.revealMode === REVEAL_MODES.GATED;

  if (spinning && spinTargetLabel) {
    const stripLabels = buildSpinStripLabels(slot, spinTargetLabel);
    const cells = stripLabels
      .map((label, index) => {
        const isLast = index === stripLabels.length - 1;
        const variant = isGated ? 'masked' : isLast ? 'selected' : 'spin';
        return renderDrumCell(label, variant);
      })
      .join('');

    return `
      <div class="reel-drum reel-drum--spinning${isGated ? ' reel-drum--gated-spin' : ''}" data-reel-drum="${slot.id}">
        <div class="reel-drum__window" aria-label="${isGated ? 'Spinning — result hidden until reveal' : 'Spinning'}">
          <div class="reel-drum__strip" data-reel-strip="${slot.id}" ${isGated ? 'aria-hidden="true"' : ''}>
            ${cells}
          </div>
          ${renderDrumMarker()}
        </div>
      </div>
    `;
  }

  const cells = getReelDrumCells(slot, display);
  const centerVariant = display.kind === 'empty' ? 'preview' : 'selected';

  return `
    <div class="reel-drum" data-reel-drum="${slot.id}">
      <div class="reel-drum__window">
        <div class="reel-drum__strip reel-drum__strip--idle">
          ${renderDrumCell(cells.prev, 'preview')}
          ${renderDrumCell(cells.center, centerVariant, { forced: display.forced })}
          ${renderDrumCell(cells.next, 'preview')}
        </div>
        ${renderDrumMarker()}
      </div>
    </div>
  `;
}

/**
 * @param {string[]} spinningSlotIds
 */
export function pulseFrozenReels(spinningSlotIds) {
  const spinning = new Set(spinningSlotIds);

  document.querySelectorAll('.reel-card--frozen').forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    if (spinning.has(element.dataset.slotId ?? '')) {
      return;
    }

    element.classList.add('reel-card--lock-pulse');
    window.setTimeout(() => {
      element.classList.remove('reel-card--lock-pulse');
    }, readReelMotionTokens().staggerMs);
  });
}

/**
 * @param {number} drawCount
 * @param {number} [staggerMs]
 * @returns {ReturnType<typeof readReelMotionTokens>}
 */
export function computeSpinMotion(drawCount, staggerMs = 120) {
  const motion = readReelMotionTokens();
  const count = Math.max(1, drawCount);
  const settlePad = 40;
  const travelMs = Math.max(
    900,
    SPIN_SEQUENCE_MS - settlePad - (count - 1) * staggerMs,
  );

  return {
    ...motion,
    staggerMs,
    travelMs,
  };
}

/**
 * @param {import('../data/spin.js').SpinDraw[]} draws
 * @returns {Promise<void>}
 */
export function playReelDrumSequence(draws) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, 500);
    });
  }

  pulseFrozenReels(draws.map((draw) => draw.slotId));

  const motion = computeSpinMotion(draws.length);
  const animations = draws.map((draw, index) =>
    animateReelDrum(draw.slotId, index * motion.staggerMs, motion),
  );

  return Promise.all(animations).then(() => undefined);
}

/**
 * @param {string} slotId
 * @param {number} delayMs
 * @param {ReturnType<typeof readReelMotionTokens>} motion
 */
function animateReelDrum(slotId, delayMs, motion) {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const drum = document.querySelector(`[data-reel-drum="${slotId}"]`);
      const strip = drum?.querySelector('[data-reel-strip]');

      if (!(strip instanceof HTMLElement)) {
        resolve();
        return;
      }

      const cellCount = strip.children.length;
      const targetIndex = cellCount - 1;
      const centerOffset = motion.viewportHeight / 2 - motion.cellHeight / 2;
      const finalOffset = centerOffset - targetIndex * motion.cellHeight;
      const overshootOffset = finalOffset - motion.overshootPx;
      const settleAt = motion.travelMs - motion.settleMs;

      strip.style.transition = `transform ${motion.travelMs}ms var(--ease-mechanical), filter 300ms var(--ease-standard)`;
      strip.style.transform = `translateY(${overshootOffset}px)`;
      strip.style.filter = 'blur(1.4px)';
      drum?.classList.add('reel-drum--spinning');

      window.setTimeout(() => {
        strip.style.transition = `transform ${motion.settleMs}ms var(--ease-settle), filter 180ms var(--ease-standard)`;
        strip.style.transform = `translateY(${finalOffset}px)`;
        strip.style.filter = 'blur(0)';
        drum?.classList.remove('reel-drum--spinning');
        drum?.classList.add('reel-drum--settled');
      }, settleAt);

      window.setTimeout(() => {
        resolve();
      }, motion.travelMs + 40);
    }, delayMs);
  });
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
