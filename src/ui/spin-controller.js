// Spin animation timing — defers result commit until animation completes (§4.1).
// Created: 2026-08-05.

export const SPIN_ANIMATION_MS = 1200;

/**
 * @param {number} ms
 */
export function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * @param {import('../data/spin.js').SpinDraw[]} draws
 * @param {(draws: import('../data/spin.js').SpinDraw[]) => void} onCommit
 */
export async function runSpinAnimation(draws, onCommit) {
  await delay(SPIN_ANIMATION_MS);
  onCommit(draws);
}
