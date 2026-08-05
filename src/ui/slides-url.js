// Google Slides URL normalization for gated deck launch — checklist §6.1.
// Created: 2026-08-05.

const SLIDES_ID_PATTERN = /\/presentation\/d\/([a-zA-Z0-9-_]+)/;
const URL_FRAGMENT_PATTERN = /(https?:\/\/|www\.|docs\.google\.com|\.com\/|\.org\/|\.net\/|slides|presentation)/i;

/**
 * @param {string} input
 * @returns {string | null}
 */
export function extractPresentationId(input) {
  const trimmed = input.trim();
  const match = trimmed.match(SLIDES_ID_PATTERN);
  return match ? match[1] : null;
}

/**
 * @param {string} input
 * @returns {boolean}
 */
export function isGoogleSlidesUrl(input) {
  return extractPresentationId(input) !== null;
}

/**
 * @param {string} input
 * @returns {string}
 */
export function toPresentationModeUrl(input) {
  const presentationId = extractPresentationId(input);

  if (!presentationId) {
    throw new Error('Deck option must be a Google Slides presentation link.');
  }

  return `https://docs.google.com/presentation/d/${presentationId}/present`;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function textLeaksUrlFragment(text) {
  return URL_FRAGMENT_PATTERN.test(text);
}
