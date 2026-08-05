// Mechanical slot-machine handle — rotation, drag, keyboard, and spin trigger.
// Created: 2026-08-05 — per instructions/hot-takes-handle-fix.md.

/** Resting angle in degrees from vertical (negative = leans back). */
export const HANDLE_REST_ANGLE = -12;

/** Maximum pull angle in degrees from vertical (positive = pulled down). */
export const HANDLE_MAX_ANGLE = 32;

/** Fraction of travel that arms a spin on release. */
export const HANDLE_ACTIVATION_THRESHOLD = 0.8;

/** Pull animation duration for click/tap in milliseconds. */
export const HANDLE_PULL_MS = 260;

/** Hold at bottom before return in milliseconds. */
export const HANDLE_HOLD_MS = 80;

/** Return-to-rest animation duration in milliseconds. */
export const HANDLE_RETURN_MS = 380;

/** Overshoot past rest on spring return in degrees. */
export const HANDLE_OVERSHOOT_DEG = 3;

const ACTIVATION_ANGLE =
  HANDLE_REST_ANGLE +
  (HANDLE_MAX_ANGLE - HANDLE_REST_ANGLE) * HANDLE_ACTIVATION_THRESHOLD;

/** @typedef {'idle' | 'pressed' | 'dragging' | 'committing' | 'returning' | 'disabled'} HandlePhase */

/** @type {AbortController | null} */
let wireAbort = null;

/** @type {HandlePhase} */
let phase = 'idle';

/** @type {boolean} */
let thresholdCrossed = false;

/** @type {boolean} */
let spinCommitted = false;

/** @type {number | null} */
let activePointerId = null;

/** @type {(() => void) | null} */
let onPullCallback = null;

/** @type {boolean} */
let disabledState = true;

/** @type {boolean} */
let didDragGesture = false;

/** @type {{ x: number, y: number } | null} */
let pointerDownPoint = null;

/**
 * @param {{ x: number, y: number }} pivot
 * @param {{ x: number, y: number }} point
 */
export function pointerToHandleAngle(pivot, point) {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/**
 * @param {number} angle
 * @param {number} [rest]
 * @param {number} [max]
 */
export function clampHandleAngle(angle, rest = HANDLE_REST_ANGLE, max = HANDLE_MAX_ANGLE) {
  return Math.min(max, Math.max(rest, angle));
}

/**
 * @param {number} angle
 * @param {number} [threshold]
 */
export function isHandlePastThreshold(angle, threshold = ACTIVATION_ANGLE) {
  return angle >= threshold;
}

/**
 * @param {number} rawAngle
 * @param {number} [rest]
 * @param {number} [max]
 */
export function applyHandleDragResistance(rawAngle, rest = HANDLE_REST_ANGLE, max = HANDLE_MAX_ANGLE) {
  const clamped = clampHandleAngle(rawAngle, rest, max);
  const range = max - rest;
  const progress = range === 0 ? 0 : (clamped - rest) / range;

  if (progress <= 0.8) {
    return clamped;
  }

  const resistedProgress = 0.8 + (progress - 0.8) * 0.45;
  return rest + resistedProgress * range;
}

/**
 * @param {HTMLElement} handle
 * @param {number} angle
 */
function setHandleAngle(handle, angle) {
  handle.style.setProperty('--handle-angle', `${angle}deg`);
}

/**
 * @param {HTMLElement} handle
 */
function getPivotCenter(handle) {
  const rect = handle.getBoundingClientRect();
  const pivotX = parseFloat(getComputedStyle(handle).getPropertyValue('--pivot-x')) || 50;
  const pivotY = parseFloat(getComputedStyle(handle).getPropertyValue('--pivot-y')) || 72;
  return {
    x: rect.left + (rect.width * pivotX) / 100,
    y: rect.top + (rect.height * pivotY) / 100,
  };
}

/**
 * @param {HTMLElement} handle
 * @param {HandlePhase} next
 */
function setPhase(handle, next) {
  phase = next;
  handle.dataset.handlePhase = next;
  handle.classList.toggle('machine-handle--disabled', next === 'disabled');
}

/**
 * @param {HTMLElement} handle
 */
function resetHandleToRest(handle) {
  setHandleAngle(handle, HANDLE_REST_ANGLE);
  thresholdCrossed = false;
  spinCommitted = false;
  setPhase(handle, disabledState ? 'disabled' : 'idle');
}

/**
 * @param {HTMLElement} handle
 */
function commitSpin(handle) {
  if (spinCommitted || disabledState || phase === 'disabled') {
    return;
  }

  spinCommitted = true;
  setPhase(handle, 'committing');
  onPullCallback?.();
}

/**
 * @param {HTMLElement} handle
 * @param {number} targetAngle
 * @param {number} durationMs
 * @param {string} [easing]
 */
function animateHandleAngle(handle, targetAngle, durationMs, easing = 'var(--ease-mechanical)') {
  const lever = handle.querySelector('.machine-handle__lever');
  if (!(lever instanceof HTMLElement)) {
    setHandleAngle(handle, targetAngle);
    return Promise.resolve();
  }

  lever.style.transition = `transform ${durationMs}ms ${easing}`;
  setHandleAngle(handle, targetAngle);

  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

/**
 * @param {HTMLElement} handle
 */
async function playClickPullAnimation(handle) {
  if (spinCommitted || disabledState) {
    return;
  }

  setPhase(handle, 'committing');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pullMs = reducedMotion ? 120 : HANDLE_PULL_MS;
  const holdMs = reducedMotion ? 30 : HANDLE_HOLD_MS;
  const returnMs = reducedMotion ? 160 : HANDLE_RETURN_MS;
  const overshoot = reducedMotion ? 0 : HANDLE_OVERSHOOT_DEG;

  const lever = handle.querySelector('.machine-handle__lever');
  if (lever instanceof HTMLElement) {
    lever.style.transition = 'none';
  }

  await animateHandleAngle(handle, HANDLE_MAX_ANGLE, pullMs);
  commitSpin(handle);
  await new Promise((resolve) => window.setTimeout(resolve, holdMs));

  setPhase(handle, 'returning');
  if (overshoot > 0) {
    await animateHandleAngle(handle, HANDLE_REST_ANGLE - overshoot, returnMs * 0.55, 'var(--ease-settle)');
    await animateHandleAngle(handle, HANDLE_REST_ANGLE, returnMs * 0.45, 'var(--ease-standard)');
  } else {
    await animateHandleAngle(handle, HANDLE_REST_ANGLE, returnMs, 'var(--ease-standard)');
  }

  spinCommitted = false;
  setPhase(handle, disabledState ? 'disabled' : 'idle');
}

/**
 * @param {HTMLElement} handle
 * @param {PointerEvent} event
 */
function onPointerDown(handle, event) {
  if (disabledState || spinCommitted || phase === 'committing' || phase === 'returning') {
    return;
  }

  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  activePointerId = event.pointerId;
  didDragGesture = false;
  pointerDownPoint = { x: event.clientX, y: event.clientY };
  handle.setPointerCapture(event.pointerId);
  thresholdCrossed = false;
  setPhase(handle, 'pressed');

  const lever = handle.querySelector('.machine-handle__lever');
  if (lever instanceof HTMLElement) {
    lever.style.transition = 'none';
  }
}

/**
 * @param {HTMLElement} handle
 * @param {PointerEvent} event
 */
function onPointerMove(handle, event) {
  if (activePointerId !== event.pointerId || disabledState) {
    return;
  }

  event.preventDefault();
  setPhase(handle, 'dragging');

  if (pointerDownPoint) {
    const dx = event.clientX - pointerDownPoint.x;
    const dy = event.clientY - pointerDownPoint.y;
    if (Math.hypot(dx, dy) > 6) {
      didDragGesture = true;
    }
  }

  const pivot = getPivotCenter(handle);
  const rawAngle = pointerToHandleAngle(pivot, { x: event.clientX, y: event.clientY });
  const angle = applyHandleDragResistance(rawAngle);

  if (isHandlePastThreshold(angle)) {
    thresholdCrossed = true;
  }

  setHandleAngle(handle, angle);
}

/**
 * @param {HTMLElement} handle
 * @param {PointerEvent} event
 */
async function onPointerUp(handle, event) {
  if (activePointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  handle.releasePointerCapture(event.pointerId);
  activePointerId = null;
  pointerDownPoint = null;

  const shouldSpin = thresholdCrossed;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const returnMs = reducedMotion ? 160 : HANDLE_RETURN_MS;
  const overshoot = reducedMotion ? 0 : HANDLE_OVERSHOOT_DEG;

  if (shouldSpin) {
    setPhase(handle, 'committing');
    await animateHandleAngle(handle, HANDLE_MAX_ANGLE, reducedMotion ? 100 : 140);
    commitSpin(handle);
    await new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 30 : HANDLE_HOLD_MS));
  }

  setPhase(handle, 'returning');
  if (overshoot > 0) {
    await animateHandleAngle(handle, HANDLE_REST_ANGLE - overshoot, returnMs * 0.55, 'var(--ease-settle)');
    await animateHandleAngle(handle, HANDLE_REST_ANGLE, returnMs * 0.45, 'var(--ease-standard)');
  } else {
    await animateHandleAngle(handle, HANDLE_REST_ANGLE, returnMs, 'var(--ease-standard)');
  }

  thresholdCrossed = false;
  if (!spinCommitted) {
    spinCommitted = false;
  }
  setPhase(handle, disabledState ? 'disabled' : 'idle');
}

/**
 * @param {HTMLElement} handle
 * @param {PointerEvent} event
 */
function onPointerCancel(handle, event) {
  if (activePointerId !== event.pointerId) {
    return;
  }

  try {
    handle.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer may already be released.
  }

  activePointerId = null;
  resetHandleToRest(handle);
}

/**
 * @param {{ onPull: () => void, disabled?: boolean, spinning?: boolean }} options
 */
export function wireMachineHandle(options) {
  wireAbort?.abort();
  onPullCallback = options.onPull;

  const handle = document.querySelector('.machine-handle');
  if (!(handle instanceof HTMLElement)) {
    return;
  }

  const ac = new AbortController();
  wireAbort = ac;
  const { signal } = ac;

  disabledState = Boolean(options.disabled || options.spinning);
  setPhase(handle, disabledState ? 'disabled' : 'idle');
  handle.toggleAttribute('disabled', disabledState);
  handle.setAttribute('aria-disabled', disabledState ? 'true' : 'false');
  resetHandleToRest(handle);

  if (options.spinning) {
    setHandleAngle(handle, HANDLE_MAX_ANGLE);
    setPhase(handle, 'committing');
    return;
  }

  handle.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType === 'mouse' && disabledState) {
        return;
      }
      onPointerDown(handle, event);
    },
    { signal },
  );

  handle.addEventListener('pointermove', (event) => onPointerMove(handle, event), { signal });
  handle.addEventListener('pointerup', (event) => onPointerUp(handle, event), { signal });
  handle.addEventListener('pointercancel', (event) => onPointerCancel(handle, event), { signal });

  handle.addEventListener(
    'click',
    (event) => {
      if (disabledState || didDragGesture) {
        didDragGesture = false;
        return;
      }

      event.preventDefault();
      playClickPullAnimation(handle);
    },
    { signal },
  );

  handle.addEventListener(
    'keydown',
    (event) => {
      if (disabledState) {
        return;
      }

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        playClickPullAnimation(handle);
      }
    },
    { signal },
  );
}

/** Snaps the handle to a pulled pose while reels are spinning (button-triggered spins). */
export function syncMachineHandleSpinning() {
  const handle = document.querySelector('.machine-handle');
  if (!(handle instanceof HTMLElement)) {
    return;
  }

  disabledState = true;
  handle.toggleAttribute('disabled', true);
  handle.setAttribute('aria-disabled', 'true');
  setPhase(handle, 'committing');
  setHandleAngle(handle, HANDLE_MAX_ANGLE);
}

/**
 * @param {{ disabled?: boolean, spinning?: boolean }} [options]
 */
export function renderMachineHandleMarkup(options = {}) {
  const disabled = Boolean(options.disabled || options.spinning);
  const disabledClass = disabled ? ' machine-handle--disabled' : '';
  const spinningClass = options.spinning ? ' machine-handle--spinning' : '';
  const tabIndex = disabled ? '-1' : '0';
  const disabledAttr = disabled ? ' disabled aria-disabled="true"' : ' aria-disabled="false"';
  const angle = options.spinning ? HANDLE_MAX_ANGLE : HANDLE_REST_ANGLE;

  return `
    <div
      class="machine-handle${disabledClass}${spinningClass}"
      role="button"
      tabindex="${tabIndex}"
      aria-label="Pull handle to spin active slots"
      style="--handle-angle: ${angle}deg"
      ${disabledAttr}
    >
      <div class="machine-handle__track" aria-hidden="true"></div>
      <div class="machine-handle__pivot" aria-hidden="true">
        <span class="machine-handle__pivot-plate"></span>
        <span class="machine-handle__pivot-collar"></span>
        <span class="machine-handle__pivot-bolt machine-handle__pivot-bolt--left"></span>
        <span class="machine-handle__pivot-bolt machine-handle__pivot-bolt--right"></span>
      </div>
      <div class="machine-handle__lever">
        <span class="machine-handle__shaft" aria-hidden="true">
          <span class="machine-handle__shaft-collar" aria-hidden="true"></span>
        </span>
        <span class="machine-handle__grip" aria-hidden="true"></span>
      </div>
      <div class="machine-handle__stop" aria-hidden="true"></div>
    </div>
  `;
}
