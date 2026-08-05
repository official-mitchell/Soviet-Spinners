// Shared-display interstitial countdown and Slides redirect — checklist §6.1.
// Created: 2026-08-05.

import {
  LAUNCH_COUNTDOWN_SECONDS,
  consumeLaunchPayload,
  parseLaunchTokenFromHash,
} from './launch-gate.js';
import { extractPresentationId } from './slides-url.js';

export const LAUNCH_STATUS_COPY = 'Stand by…';
export const LAUNCH_ERROR_COPY = 'Unable to launch presentation.';
export const LAUNCH_BRAND_COPY = 'Game Night Picks';

/**
 * @param {number} secondsRemaining
 * @returns {string}
 */
export function formatCountdownValue(secondsRemaining) {
  return String(Math.max(0, secondsRemaining));
}

/**
 * @returns {string}
 */
export function getInterstitialVisibleText() {
  return [LAUNCH_BRAND_COPY, LAUNCH_STATUS_COPY, formatCountdownValue(LAUNCH_COUNTDOWN_SECONDS)].join(
    '\n',
  );
}

/**
 * @param {string} visibleText
 * @param {string} secretUrl
 * @returns {boolean}
 */
export function interstitialTextLeaksUrl(visibleText, secretUrl) {
  if (!secretUrl) {
    return false;
  }

  if (visibleText.includes(secretUrl)) {
    return true;
  }

  const presentationId = extractPresentationId(secretUrl);
  if (presentationId && visibleText.includes(presentationId)) {
    return true;
  }

  return false;
}

/**
 * @param {number} countdownSeconds
 * @param {(secondsRemaining: number) => void} onTick
 * @param {() => void} onComplete
 * @param {{
 *   setIntervalFn?: typeof setInterval,
 *   clearIntervalFn?: typeof clearInterval,
 * }} [options]
 * @returns {() => void}
 */
export function startCountdown(countdownSeconds, onTick, onComplete, options = {}) {
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  let secondsRemaining = countdownSeconds;

  onTick(secondsRemaining);

  /** @type {ReturnType<typeof setInterval>} */
  let timerId = 0;
  timerId = setIntervalFn(() => {
    secondsRemaining -= 1;

    if (secondsRemaining <= 0) {
      clearIntervalFn(timerId);
      onComplete();
      return;
    }

    onTick(secondsRemaining);
  }, 1000);

  return () => clearIntervalFn(timerId);
}

/**
 * @param {{
 *   location?: Location,
 *   storage?: Storage,
 *   document?: Document,
 *   requestFullscreen?: () => Promise<void>,
 *   replaceLocation?: (url: string) => void,
 *   onError?: (message: string) => void,
 *   onNavigate?: (url: string) => void,
 *   countdownSeconds?: number,
 * }} [deps]
 */
export function runLaunchInterstitial(deps = {}) {
  const location = deps.location ?? globalThis.location;
  const storage = deps.storage ?? sessionStorage;
  const documentRef = deps.document ?? globalThis.document;
  const requestFullscreen =
    deps.requestFullscreen ??
    (() => documentRef?.documentElement?.requestFullscreen?.() ?? Promise.resolve());
  const replaceLocation =
    deps.replaceLocation ??
    ((url) => {
      location.replace(url);
    });
  const onError = deps.onError ?? showLaunchError;
  const onNavigate = deps.onNavigate ?? replaceLocation;
  const countdownSeconds = deps.countdownSeconds ?? LAUNCH_COUNTDOWN_SECONDS;
  const startCountdownFn = deps.startCountdown ?? startCountdown;

  const token = parseLaunchTokenFromHash(location.hash);

  if (!token) {
    onError(LAUNCH_ERROR_COPY, documentRef);
    return;
  }

  const presentationUrl = consumeLaunchPayload(token, storage);

  if (!presentationUrl) {
    onError(LAUNCH_ERROR_COPY, documentRef);
    return;
  }

  if (interstitialTextLeaksUrl(getInterstitialVisibleText(), presentationUrl)) {
    onError(LAUNCH_ERROR_COPY, documentRef);
    return;
  }

  const countdownElement = documentRef?.querySelector('[data-countdown]');

  requestFullscreen().catch(() => undefined);

  startCountdownFn(
    countdownSeconds,
    (secondsRemaining) => {
      if (countdownElement && 'textContent' in countdownElement) {
        countdownElement.textContent = formatCountdownValue(secondsRemaining);
      }
    },
    () => {
      onNavigate(presentationUrl);
    },
  );
}

/**
 * @param {string} message
 * @param {Document | undefined} documentRef
 */
function showLaunchError(message, documentRef = document) {
  const stage = documentRef?.querySelector('.launch-stage');
  const status = documentRef?.querySelector('.launch-stage__status');
  const countdown = documentRef?.querySelector('[data-countdown]');

  if (countdown instanceof HTMLElement) {
    countdown.hidden = true;
  }

  if (status instanceof HTMLElement) {
    status.textContent = message;
  }

  if (stage instanceof HTMLElement) {
    stage.classList.add('launch-stage--error');
  }
}

if (typeof document !== 'undefined' && document.currentScript?.type === 'module') {
  runLaunchInterstitial();
}
