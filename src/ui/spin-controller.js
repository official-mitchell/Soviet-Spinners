// Spin animation orchestration — plan → reel drums → commit (§4.1, §5.2).
// Updated: 2026-08-05 — staggered reel drum sequence per design handoff §10.

import { playReelDrumSequence } from './reel-drum.js';

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
  await delay(16);
  await playReelDrumSequence(draws);
  onCommit(draws);
}
