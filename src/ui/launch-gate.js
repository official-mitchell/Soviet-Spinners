// Host-side gated launch orchestration — checklist §6.1.
// Created: 2026-08-05.

/** @typedef {{ token: string, launchPath: string }} LaunchHandle */

export const LAUNCH_COUNTDOWN_SECONDS = 4;
export const LAUNCH_STORAGE_PREFIX = 'soviet-spinners:launch:';
export const LAUNCH_PAGE_PATH = 'launch.html';

/**
 * @returns {string}
 */
export function createLaunchToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replaceAll('-', '');
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {string} token
 * @param {string} presentationUrl
 * @param {Storage} [storage]
 */
export function storeLaunchPayload(token, presentationUrl, storage = sessionStorage) {
  storage.setItem(`${LAUNCH_STORAGE_PREFIX}${token}`, presentationUrl);
}

/**
 * @param {string} token
 * @param {string} presentationUrl
 * @param {Storage} [storage]
 * @returns {LaunchHandle}
 */
export function prepareGatedLaunch(token, presentationUrl, storage = sessionStorage) {
  storeLaunchPayload(token, presentationUrl, storage);
  return {
    token,
    launchPath: `${LAUNCH_PAGE_PATH}#${token}`,
  };
}

/**
 * @param {string} presentationUrl
 * @param {{
 *   createToken?: () => string,
 *   openWindow?: (url: string) => Window | null,
 *   storage?: Storage,
 * }} [options]
 * @returns {LaunchHandle}
 */
export function openGatedLaunch(presentationUrl, options = {}) {
  const createToken = options.createToken ?? createLaunchToken;
  const openWindow =
    options.openWindow ??
    ((url) => {
      if (typeof window === 'undefined') {
        return null;
      }

      return window.open(url, '_blank', 'noopener,noreferrer');
    });
  const storage = options.storage ?? sessionStorage;

  const token = createToken();
  const handle = prepareGatedLaunch(token, presentationUrl, storage);
  const popup = openWindow(handle.launchPath);

  if (popup === null) {
    storage.removeItem(`${LAUNCH_STORAGE_PREFIX}${token}`);
    throw new Error('Pop-up blocked. Allow pop-ups for this site to launch the deck.');
  }

  return handle;
}

/**
 * @param {string} token
 * @param {Storage} [storage]
 * @returns {string | null}
 */
export function consumeLaunchPayload(token, storage = sessionStorage) {
  const key = `${LAUNCH_STORAGE_PREFIX}${token}`;
  const presentationUrl = storage.getItem(key);
  storage.removeItem(key);
  return presentationUrl;
}

/**
 * @param {string} hash
 * @returns {string | null}
 */
export function parseLaunchTokenFromHash(hash) {
  const token = hash.replace(/^#/, '').trim();
  return token.length > 0 ? token : null;
}
